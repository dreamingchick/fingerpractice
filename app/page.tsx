"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, RotateCcw, Trophy, Crosshair, X, Check, Share2, Smartphone } from 'lucide-react';
import {supportsMobilePlay} from '../lib/mobile-access.mjs';
import {judge, remaining, MIN_REACTION_MS} from '../lib/timing.mjs';
type Phase='idle'|'loading'|'waiting'|'go'|'success'|'cancelled';
type Row={nickname:string,reaction:number,rank:number,mine:number};
export default function Home(){
 const [phase,setPhase]=useState<Phase>('idle'), [count,setCount]=useState(10),[ms,setMs]=useState(0),[best,setBest]=useState<number|null>(null),[recent,setRecent]=useState<number[]>([]),[nickname,setNickname]=useState(''),[period,setPeriod]=useState('today'),[rows,setRows]=useState<Row[]>([]),[rankBest,setRankBest]=useState<number|null>(null),[rankStatus,setRankStatus]=useState('loading'),[notice,setNotice]=useState(''),[saved,setSaved]=useState(false),[saving,setSaving]=useState(false),[help,setHelp]=useState(false);
 const state=useRef<Phase>('idle'),deadline=useRef(0),attempt=useRef(''),frame=useRef(0),gen=useRef(0),saveLock=useRef(false);
 const [deviceStatus,setDeviceStatus]=useState<'checking'|'allowed'|'blocked'>('checking');
 const proof=useRef<Promise<boolean>|null>(null);
 const [verifying,setVerifying]=useState(false);
 useEffect(()=>{
  const coarse=window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const allowed=supportsMobilePlay({userAgent:navigator.userAgent,touchPoints:navigator.maxTouchPoints||0,coarsePointer:coarse});
  setDeviceStatus(allowed?'allowed':'blocked');
 },[]);
 const active=phase==='waiting'||phase==='go';
 function change(p:Phase){state.current=p;setPhase(p)}
 async function ranks(p=period){setRankStatus('loading');try{const r=await fetch('/api/game?period='+p);const b=await r.json() as {error?:string,rows:Row[],best:number|null};if(!r.ok)throw Error(b.error);setRows(b.rows);setRankBest(b.best);setRankStatus('ok')}catch{setRankStatus('error')}}
 useEffect(()=>{if(deviceStatus!=='allowed')return;try{setNickname(localStorage.getItem('zero-name')||'');const b=localStorage.getItem('zero-mobile-v1-best');if(b!==null&&Number.isFinite(+b)&&+b>=MIN_REACTION_MS)setBest(+b);setRecent(JSON.parse(localStorage.getItem('zero-mobile-v1-recent')||'[]').filter((v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=MIN_REACTION_MS).slice(0,5))}catch{};const cancel=()=>{if(document.hidden||!document.hasFocus()){if(['waiting','go','loading'].includes(state.current)){gen.current++;cancelAnimationFrame(frame.current);change('cancelled');setNotice('화면을 벗어나 도전이 취소되었습니다.')}}};document.addEventListener('visibilitychange',cancel);window.addEventListener('blur',cancel);return()=>{gen.current++;cancelAnimationFrame(frame.current);document.removeEventListener('visibilitychange',cancel);window.removeEventListener('blur',cancel)}},[deviceStatus]);
 useEffect(()=>{if(deviceStatus==='allowed')ranks(period)},[period,deviceStatus]);
 async function start(){if(deviceStatus!=='allowed'||['waiting','go','loading'].includes(state.current))return;change('loading');setNotice('');setSaved(false);setVerifying(false);proof.current=null;setCount(10);const g=++gen.current;try{const r=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start'})});const b=await r.json() as {error?:string,id:string};if(!r.ok)throw Error(b.error);if(gen.current!==g)return;attempt.current=b.id;deadline.current=performance.now()+10000;change('waiting');const tick=()=>{if(!['waiting','go'].includes(state.current))return;const now=performance.now();setCount(remaining(deadline.current,now));if(now>=deadline.current&&state.current==='waiting')change('go');if(now-deadline.current>30000){change('cancelled');setNotice('입력 시간이 지났습니다. 다시 도전해 주세요.');return}frame.current=requestAnimationFrame(tick)};frame.current=requestAnimationFrame(tick)}catch(e){if(gen.current===g){change('idle');setNotice(e instanceof Error?e.message:'연결에 실패했습니다.')}}}
 function hit(at:number){
  if(deviceStatus!=='allowed'||!['waiting','go'].includes(state.current))return;
  const result=judge(deadline.current,at);
  if(result.kind==='ignored')return;
  cancelAnimationFrame(frame.current);
  if(result.ms>30000){change('cancelled');setNotice('입력 시간이 지났습니다.');return}
  setMs(result.ms);change('success');
  const next=[result.ms,...recent].slice(0,5);setRecent(next);
  const pb=best===null?result.ms:Math.min(best,result.ms);setBest(pb);
  try{localStorage.setItem('zero-mobile-v1-best',String(pb));localStorage.setItem('zero-mobile-v1-recent',JSON.stringify(next))}catch{}
  const currentId=attempt.current;
  setVerifying(true);
  // Capture the result at the time of the touch, not after nickname entry.
  proof.current=(async()=>{
    try{
      const r=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'hit',id:currentId,ms:result.ms})});
      const b=await r.json() as {error?:string};
      if(!r.ok)throw Error(b.error||'서버에서 기록을 확인하지 못했습니다.');
      return true;
    }catch(e){
      if(attempt.current===currentId)setNotice(e instanceof Error?e.message:'서버 기록 검증에 실패했습니다.');
      return false;
    }finally{
      if(attempt.current===currentId)setVerifying(false);
    }
  })();
 }
 async function save(){
  if(deviceStatus!=='allowed'||saveLock.current||saved||phase!=='success')return;
  const name=nickname.trim();
  if(!name||[...name].length>12){setNotice('닉네임을 1~12자로 입력해 주세요.');return}
  saveLock.current=true;setSaving(true);setNotice('');
  try{
    if(!proof.current||!(await proof.current))throw Error('서버에서 확인되지 않은 기록입니다. 다시 도전해 주세요.');
    const r=await fetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submit',id:attempt.current,nickname:name})});
    const b=await r.json() as {error?:string};
    if(!r.ok)throw Error(b.error||'랭킹 등록에 실패했습니다.');
    setSaved(true);
    try{localStorage.setItem('zero-name',name)}catch{}
    await ranks();
  }catch(e){setNotice(e instanceof Error?e.message:'등록에 실패했습니다.')}
  finally{saveLock.current=false;setSaving(false)}
 }
 async function share(){const text=`찰나의 해적 · 나의 0초 타이밍 기록 ${ms}ms. 10초의 기다림, 승부는 그다음 찰나.`;try{if(navigator.share)await navigator.share({title:'찰나의 해적',text,url:location.href});else{await navigator.clipboard.writeText(text+' '+location.href);setNotice('기록과 주소를 복사했습니다.')}}catch{setNotice('공유가 취소되었거나 지원되지 않습니다.')}}
 const bubbleValue=phase==='waiting'?String(count):phase==='go'?'0':phase==='success'?String(ms):phase==='cancelled'?'—':'10';
 if(deviceStatus!=='allowed')return <main className="device-only-page">
  <header><a className="wordmark" href="/" aria-label="찰나의 해적 홈">찰나의 <span>해적</span><i/></a><span className="edition">THE MOMENT PIRATE</span></header>
  <section className="device-only-panel" role={deviceStatus==='blocked'?'alert':'status'}>
   <div className="device-only-icon"><Smartphone size={40}/></div>
   {deviceStatus==='checking'
    ? <><h1>접속 환경을 확인하고 있습니다.</h1><p>기기 유형을 확인한 뒤 게임 화면을 표시합니다.</p></>
    : <><div className="device-only-eyebrow">MOBILE ONLY</div><h1>이 게임은 모바일에서만 플레이할 수 있습니다.</h1><p>스마트폰 또는 태블릿의 터치 브라우저로 접속해 주세요.<br/>PC에서는 게임 플레이와 랭킹 등록을 이용할 수 없습니다.</p></>}
  </section>
  <footer><span>찰나의 해적</span><a href="https://garu-arcade-hub.snugbrink3.chatgpt.site/#install-guide" target="_blank" rel="noopener noreferrer">오락실 앱 설치 ↗</a><p>작은 숫자, 커다란 승부.</p></footer>
 </main>;
 return <main><header><a className="wordmark" href="/" aria-label="찰나의 해적 홈">찰나의 <span>해적</span><i/></a><span className="edition">THE MOMENT PIRATE</span><button className="help" onClick={()=>setHelp(!help)}>플레이 방법 <span>↗</span></button></header>
 <div className="intro"><div className="eyebrow"><span/> TEN SECONDS. ONE MOMENT.</div><h1>찰나의 <em>해적</em></h1><p>0초가 되는 순간, 단 한 번의 터치.<br className="mobile"/> 당신의 타이밍은 몇 밀리초인가요?</p></div>
 {help&&<aside className="instructions"><button onClick={()=>setHelp(false)} aria-label="설명 닫기"><X size={18}/></button><strong>기다리고, 한 번만 터치하세요.</strong><p>도전 시작 → 10초 카운트다운 → 0초 이후 중앙 원 터치. 0초 이전의 터치는 무시되고, 0초부터 새로 누른 첫 터치가 기록됩니다. 최소 101ms 제한은 없으며 0ms 기록도 유효합니다. 기록은 0초를 기준으로 밀리초 단위로 계산합니다. 미리 누르고 있어도 기록되지 않으며, 0초 이후 새로 눌러야 합니다. 화면을 벗어나면 취소됩니다. 기록이 작을수록 높은 순위입니다. 고정 카운트다운이므로 예측하는 타이밍 감각도 포함됩니다.</p></aside>}
 <div className="layout"><section className={'arena '+(phase==='go'?'ready':'')}>
 <div className="arena-top"><span><Crosshair size={15}/> PIRATE CHALLENGE</span><span className="live-dot">{active?'도전 진행 중':'10초 타이밍'}</span></div>
 <div className="play-area"><div className="status" aria-live="polite">{phase==='waiting'?'아직이에요. 0초까지 기다리세요.':phase==='go'?'지금 터치하세요!':phase==='success'?'기록 측정 완료':phase==='cancelled'?'도전이 취소되었습니다':'가장 짧은 순간을 잡아보세요'}</div>
 <div className="crystal-stage" role="group" aria-label="수정 터치 패널">
  <img className="crystal-art" src="/crystal-touch-v3.webp" alt="푸른 수정과 샘, 수정 위에 카운트다운 말풍선" draggable={false} />
  <div className={'crystal-clock '+(phase==='success'?'is-result ':'')+'clock-len-'+Math.min(5,bubbleValue.length)} aria-hidden="true">
   <span>{bubbleValue}</span>
  </div>
  <button type="button" className="crystal-hitbox" aria-label="0초 이후 수정 그림을 터치하세요" disabled={!active}
   onPointerDown={e=>{if(e.isTrusted&&e.isPrimary&&e.pointerType==='touch'){e.preventDefault();hit(performance.now())}}}/>
 </div>
 <p className="target-caption">{phase==='success'?`${(ms/1000).toFixed(3)}초, 당신이 잡아낸 찰나.`:'0초 이전 터치는 무시 · 수정 그림을 터치하세요'}</p>
 </div>
 {phase==='success'?<div className="result-actions"><div className="register"><input aria-label="랭킹 닉네임" placeholder="닉네임 (1~12자)" maxLength={24} value={nickname} disabled={saving||saved} onChange={e=>setNickname(e.target.value)}/><button onClick={save} disabled={saving||saved||verifying}>{saved?<><Check size={16}/> 등록 완료</>:verifying?'서버 기록 확인 중…':saving?'등록 중…':'랭킹 등록'}</button></div><div className="result-buttons"><button className="start" disabled={saving||verifying} onClick={start}><RotateCcw size={17}/> 다시 도전</button><button className="share" onClick={share} aria-label="기록 공유"><Share2 size={18}/></button></div><p className="registration-note">랭킹 등록은 측정 후 1분 안에 해주세요.</p></div>:<button className="start" onClick={start} disabled={active||phase==='loading'}>{active?'0초 이후 중앙 원을 터치하세요':phase==='loading'?'도전을 준비하고 있어요…':phase==='idle'?'도전 시작':'다시 도전'}{!active&&<ArrowRight size={19}/>}</button>}
 {notice&&<p role="status" className="notice">{notice}</p>}
 <div className="arena-bottom"><span>01 <b>10초 기다리기</b></span><span>02 <b>0초 직후 터치</b></span><span>03 <b>기록에 도전</b></span></div>
 </section>
 <aside className="side"><section className="personal"><div className="section-label">MY PERSONAL BEST <Crosshair size={16}/></div><div className="best">{best===null?'—':best}<span>ms</span></div><p>{best===null?'첫 번째 기록을 남겨보세요.':'이 기기에 저장된 나의 가장 빠른 순간'}</p><div className="recent-title">최근 기록 <span>LAST 5</span></div><div className="recent">{recent.length?recent.map((r,i)=><span key={i}>{r}<small>ms</small></span>):<span className="empty-recent">아직 도전 기록이 없어요</span>}</div></section>
 <section className="leaderboard"><div className="rank-heading"><h2><Trophy size={18}/> 명예의 전당</h2><button onClick={()=>ranks()} aria-label="랭킹 새로고침"><RotateCcw size={15}/></button></div><div className="tabs"><button className={period==='today'?'selected':''} onClick={()=>setPeriod('today')}>오늘의 기록</button><button className={period==='all'?'selected':''} onClick={()=>setPeriod('all')}>전체 기록</button></div><div className="table-head"><span>순위 / 도전자</span><span>기록</span></div><div className="rank-rows">{rankStatus==='loading'?<div className="rank-empty">기록을 불러오고 있어요…</div>:rankStatus==='error'?<div className="rank-empty">랭킹에 연결하지 못했어요.<button onClick={()=>ranks()}>다시 불러오기 ↗</button></div>:rows.length?rows.map((r,i)=><div className={'rank-row '+(r.mine?'mine':'')} key={i}><span className={'rank-number n'+r.rank}>{String(r.rank).padStart(2,'0')}</span><span className="rank-name">{r.nickname}{!!r.mine&&<small>나</small>}</span><b>{r.reaction}<small>ms</small></b></div>):<div className="rank-empty"><Trophy size={26}/><p>아직 기록이 없어요.<br/>첫 번째 도전자가 되어보세요.</p></div>}</div><div className="rank-footer">{rankBest===null?'가장 빠른 순간이 여기에 남습니다.':`내 등록 최고 기록 ${rankBest}ms`}</div></section></aside></div>
 <footer><span>찰나의 해적</span><a href="https://garu-arcade-hub.snugbrink3.chatgpt.site/#install-guide" target="_blank" rel="noopener noreferrer">오락실 앱 설치 ↗</a><p>작은 숫자, 커다란 승부. <span>일간 랭킹은 한국 시간 00시에 초기화됩니다.</span></p><span className="footer-mark">MADE FOR THE MOMENT <ArrowUpRight size={14}/></span></footer>
 </main>
}
