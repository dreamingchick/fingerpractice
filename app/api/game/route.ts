import { env } from "cloudflare:workers";
import { MIN_REACTION_MS } from "../../../lib/timing.mjs";
export const dynamic = "force-dynamic";
const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{"Cache-Control":"no-store",...headers}});
const player=(r:Request)=>r.headers.get("cookie")?.match(/(?:^|; )zero_player=([a-f0-9-]{36})(?:;|$)/)?.[1];
export async function GET(r:Request){
 try {
 const db=env.DB!; const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const daily=new URL(r.url).searchParams.get("period")==="today";
 const rows=await db.prepare(`WITH best AS (SELECT *, ROW_NUMBER() OVER(PARTITION BY player ORDER BY reaction, finished) rn FROM attempts WHERE reaction >= ${MIN_REACTION_MS} ${daily?"AND day = ?":""}), ranked AS (SELECT nickname,reaction,player,RANK() OVER(ORDER BY reaction) rank FROM best WHERE rn=1) SELECT nickname,reaction,rank, CASE WHEN player=? THEN 1 ELSE 0 END mine FROM ranked ORDER BY reaction,rank LIMIT 50`).bind(...(daily?[today,player(r)||""]:[player(r)||""])).all();
 const mine=await db.prepare(`SELECT MIN(reaction) best FROM attempts WHERE player=? AND reaction >= ${MIN_REACTION_MS} ${daily?"AND day=?":""}`).bind(...(daily?[player(r)||"",today]:[player(r)||""])).first();
 return json({rows:rows.results,best:mine?.best??null});
 } catch {return json({error:"랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."},503)}
}
export async function POST(r:Request){
 if(r.headers.get("origin") && r.headers.get("origin")!==new URL(r.url).origin) return json({error:"허용되지 않은 요청입니다."},403);
 try {
 const db=env.DB!; const b=await r.json() as {action:string,id?:string,ms?:number,nickname?:string};const pid=player(r)||crypto.randomUUID();const now=Date.now();
 if(b.action==="start"){
 const last=await db.prepare("SELECT started FROM attempts WHERE player=? ORDER BY started DESC LIMIT 1").bind(pid).first<{started:number}>();
 if(last && now-last.started<1500)return json({error:"잠시 후 다시 시작해 주세요."},429);
 const id=crypto.randomUUID(); await db.prepare("INSERT INTO attempts(id,player,started) VALUES(?,?,?)").bind(id,pid,now).run();
 return json({id},200,{"Set-Cookie":`zero_player=${pid}; Path=/; HttpOnly; ${new URL(r.url).protocol==="https:"?"Secure; ":""}SameSite=Lax; Max-Age=31536000`});
 }
 if(b.action!=="submit" || !player(r))return json({error:"유효한 도전이 없습니다."},400);
 const ms=b.ms; const nickname=typeof b.nickname==="string"?b.nickname.trim().normalize("NFC"):"";
 if(!Number.isInteger(ms)||ms!<MIN_REACTION_MS||ms!>30000||!nickname||[...nickname].length>12||/[\p{C}<>]/u.test(nickname))return json({error:"닉네임(1~12자)과 기록(101ms 이상)을 확인해 주세요."},400);
 const day=new Date(now+9*3600000).toISOString().slice(0,10);
 const row=await db.prepare("UPDATE attempts SET finished=?,reaction=?,nickname=?,day=? WHERE id=? AND player=? AND finished IS NULL AND started <= ? AND started >= ? RETURNING id").bind(now,ms,nickname,day,b.id||"",pid,now-10000-ms!,now-120000).first();
 if(!row)return json({error:"이미 등록했거나 유효 시간이 지난 도전입니다."},409);
 return json({ok:true});
 }catch{return json({error:"서버 연결에 실패했습니다. 다시 시도해 주세요."},503)}
}
