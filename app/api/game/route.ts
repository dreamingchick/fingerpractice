import { env } from "cloudflare:workers";
import { isMobileRequest } from "../../../lib/mobile-access.mjs";
import { mobileRankingCutoff } from "../../../lib/mobile-ranking.mjs";
import {
  hitStartWindow, validReaction, normalizedNickname,
  NICKNAME_WINDOW_MS, START_RATE_WINDOW_MS,
  MAX_STARTS_PER_WINDOW, START_COOLDOWN_MS,
} from "../../../lib/attempt-validation.mjs";

export const dynamic = "force-dynamic";
type GameRequest = { action?: unknown; id?: unknown; ms?: unknown; nickname?: unknown };
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
const player = (r: Request) =>
  r.headers.get("cookie")?.match(/(?:^|; )zero_player=([a-f0-9-]{36})(?:;|$)/)?.[1];
const uuid = (id: unknown): id is string =>
  typeof id === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id);
const dayKst = (at: number) => new Date(at + 9 * 3600000).toISOString().slice(0, 10);

export async function GET(r: Request) {
  if (!isMobileRequest(r)) return json({ error: "모바일에서만 이용할 수 있습니다." }, 403);
  try {
    const db = env.DB!;
    const cutoff = await mobileRankingCutoff(db);
    const today = dayKst(Date.now());
    const daily = new URL(r.url).searchParams.get("period") === "today";
    // Only explicitly registered, completed attempts enter public rankings.
    const rows = await db.prepare(
      `WITH best AS (
        SELECT *, ROW_NUMBER() OVER(PARTITION BY player ORDER BY reaction, finished) rn
        FROM attempts
        WHERE nickname IS NOT NULL AND reaction BETWEEN 0 AND 30000 AND started >= ? ${daily ? "AND day = ?" : ""}
      ), ranked AS (
        SELECT nickname,reaction,player,RANK() OVER(ORDER BY reaction) rank
        FROM best WHERE rn=1
      )
      SELECT nickname,reaction,rank, CASE WHEN player=? THEN 1 ELSE 0 END mine
      FROM ranked ORDER BY reaction,rank LIMIT 50`
    ).bind(...(daily ? [cutoff, today, player(r) || ""] : [cutoff, player(r) || ""])).all();
    const mine = await db.prepare(
      `SELECT MIN(reaction) best FROM attempts
       WHERE player=? AND nickname IS NOT NULL AND reaction BETWEEN 0 AND 30000 AND started >= ?
       ${daily ? "AND day=?" : ""}`
    ).bind(...(daily ? [player(r) || "", cutoff, today] : [player(r) || "", cutoff])).first();
    return json({ rows: rows.results, best: mine?.best ?? null });
  } catch (error) {
    console.error("[fingerpractice] ranking GET failed", error);
    return json({ error: "랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, 503);
  }
}

export async function POST(r: Request) {
  if (!isMobileRequest(r)) return json({ error: "모바일에서만 플레이할 수 있습니다." }, 403);
  const origin = r.headers.get("origin");
  if ((origin && origin !== new URL(r.url).origin) ||
      r.headers.get("sec-fetch-site") === "cross-site") {
    return json({ error: "허용되지 않은 요청입니다." }, 403);
  }
  if (!r.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "JSON 요청만 허용합니다." }, 415);
  }
  let body: GameRequest;
  try {
    const raw: unknown = await r.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return json({ error: "잘못된 요청입니다." }, 400);
    }
    body = raw as GameRequest;
  } catch {
    return json({ error: "요청 형식을 확인해 주세요." }, 400);
  }

  try {
    const db = env.DB!;
    const cutoff = await mobileRankingCutoff(db);
    const pid = player(r);
    const now = Date.now();

    if (body.action === "start") {
      const currentPlayer = pid || crypto.randomUUID();
      // Single browser/device: limit burst challenge farming.
      const recent = await db.prepare(
        "SELECT COUNT(*) total, MAX(started) latest FROM attempts WHERE player=? AND started>=?"
      ).bind(currentPlayer, Math.max(now - START_RATE_WINDOW_MS, cutoff))
        .first<{ total: number; latest: number | null }>();
      if (Number(recent?.total ?? 0) >= MAX_STARTS_PER_WINDOW ||
          (recent?.latest != null && now - Number(recent.latest) < START_COOLDOWN_MS)) {
        return json({ error: "도전 요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요." },
          429, { "Retry-After": "2" });
      }
      const id = crypto.randomUUID();
      await db.prepare("INSERT INTO attempts(id,player,started) VALUES(?,?,?)")
        .bind(id, currentPlayer, now).run();
      const secure = new URL(r.url).protocol === "https:" ? "Secure; " : "";
      return json({ id }, 200, {
        "Set-Cookie": `zero_player=${currentPlayer}; Path=/; HttpOnly; ${secure}SameSite=Lax; Max-Age=31536000`,
      });
    }

    if (!pid || !uuid(body.id)) return json({ error: "유효한 도전이 없습니다." }, 400);

    if (body.action === "hit") {
      // The browser reports the result immediately upon pointer-down, BEFORE
      // nickname entry. D1 checks a bounded server-time window atomically.
      if (!validReaction(body.ms)) {
        return json({ error: "측정 기록은 0~30000ms의 정수여야 합니다." }, 400);
      }
      const ms = body.ms as number;
      const window = hitStartWindow(now, ms)!;
      const row = await db.prepare(
        `UPDATE attempts SET finished=?, reaction=?, day=?
         WHERE id=? AND player=? AND finished IS NULL
         AND started >= ? AND started <= ? RETURNING id`
      ).bind(now, ms, dayKst(now), body.id, pid, Math.max(window.earliest, cutoff), window.latest).first();
      if (!row) return json({
        error: "도전 시간이 일치하지 않거나 이미 기록된 입력입니다. 다시 도전해 주세요.",
      }, 409);
      return json({ ok: true });
    }

    if (body.action === "submit") {
      // A nickname cannot change a previously committed reaction time.
      const nickname = normalizedNickname(body.nickname);
      if (!nickname) return json({ error: "닉네임을 1~12자로 입력해 주세요." }, 400);
      const row = await db.prepare(
        `UPDATE attempts SET nickname=?
         WHERE id=? AND player=? AND finished IS NOT NULL
         AND nickname IS NULL AND finished >= ? AND started >= ? RETURNING id`
      ).bind(nickname, body.id, pid, now - NICKNAME_WINDOW_MS, cutoff).first();
      if (!row) return json({
        error: "등록 가능한 검증 기록이 없거나 등록 시간이 지났습니다. 다시 도전해 주세요.",
      }, 409);
      return json({ ok: true });
    }

    return json({ error: "지원하지 않는 요청입니다." }, 400);
  } catch (error) {
    console.error("[fingerpractice] game POST failed", error);
    return json({ error: "서버 연결에 실패했습니다. 다시 시도해 주세요." }, 503);
  }
}
