// A once-per-release D1 reset, performed on the first valid mobile API request.
// The metadata row makes the reset idempotent across Cloudflare Worker isolates;
// the stable timestamp protects new mobile records from later cold starts.
export const MOBILE_RANKING_RELEASE = "mobile-only-v1";
let resetPromise = null;

export async function initializeMobileRanking(db, timestamp = Date.now()) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS leaderboard_reset (release TEXT PRIMARY KEY NOT NULL, reset_at INTEGER NOT NULL)"
  ).run();
  await db.prepare(
    "INSERT OR IGNORE INTO leaderboard_reset(release,reset_at) VALUES (?,?)"
  ).bind(MOBILE_RANKING_RELEASE, timestamp).run();

  const row = await db.prepare(
    "SELECT reset_at FROM leaderboard_reset WHERE release=?"
  ).bind(MOBILE_RANKING_RELEASE).first();
  const resetAt = Number(row?.reset_at);
  if (!Number.isSafeInteger(resetAt) || resetAt <= 0) {
    throw new Error("Mobile ranking release marker is missing.");
  }

  // This physically removes pre-release records but preserves later entries,
  // even if several Worker instances initialize at the same time.
  await db.prepare("DELETE FROM attempts WHERE started < ?").bind(resetAt).run();
  return resetAt;
}

export function mobileRankingCutoff(db) {
  if (!resetPromise) {
    resetPromise = initializeMobileRanking(db).catch((error) => {
      resetPromise = null;
      throw error;
    });
  }
  return resetPromise;
}
