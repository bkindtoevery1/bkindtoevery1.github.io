import {step,assertInvariants} from '../game/engine.mjs';
import {tileName,typeOf} from '../engine/tiles.mjs';

export const LOG_FORMAT='h-mahjong-log/v1';
export const COMPACT_FORMAT='wellness-mahjong-log/v2';
const PREFIX='h-mahjong-log-v1:',INDEX=PREFIX+'index',MAX_LOGS=10,MAX_CHARS=1500000;
const clone=value=>structuredClone(value);
const scores=game=>game.players.map(player=>player.score);
const seats=['동','남','서','북'];
const seatLabels=game=>game.rules.variant==='S'?seats.map((_,i)=>seats[(i-game.dealer+4)%4]):seats;
const signed=value=>`${value>0?'+':''}${value}`;
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);

export function beforeAction(game){
  return {scores:scores(game),active:game.players.flatMap((p,i)=>p.won?[]:[i]),events:game.events.length,ledger:game.ledger.length,pot:game.pot??0};
}

export function actionRecord(game,seat,action,before,error=null){
  const seats=seatLabels(game);
  const after=scores(game),payments=clone(game.ledger.slice(before.ledger)),issues=[];
  const delta=after.map((value,i)=>value-before.scores[i]),ledgerDelta=[0,0,0,0];
  for(const payment of payments){if(Number.isInteger(payment.from))ledgerDelta[payment.from]-=payment.amount;if(Number.isInteger(payment.to))ledgerDelta[payment.to]+=payment.amount;}
  if(delta.some((value,i)=>value!==ledgerDelta[i]))issues.push('점수 변화와 실제 이체 내역이 일치하지 않습니다.');
  const wins=game.events.slice(before.events).filter(e=>e.type==='win').map(win=>{
    if(game.rules.variant==='S'){
      const actual=payments.filter(p=>p.to===win.seat),actualReceipt=actual.reduce((n,p)=>n+p.amount,0),expected=[],pao=win.score.yakuman?game.players[win.seat].pao:null;
      if(pao!==null&&pao!==undefined){if(win.method==='tsumo'||win.source===pao)expected.push({from:pao,amount:win.score.total});else expected.push({from:pao,amount:win.score.total/2},{from:win.source,amount:win.score.total/2});}
      else if(win.method==='ron')expected.push({from:win.source,amount:win.score.points.ron});
      else for(let from=0;from<4;from++)if(from!==win.seat)expected.push({from,amount:from===game.dealer?win.score.points.tsumoDealer:win.score.points.tsumoOther});
      if(before.pot)expected.push({from:'pot',amount:before.pot});
      const expectedReceipt=expected.reduce((n,p)=>n+p.amount,0),problems=[];
      if(actual.length!==expected.length||expected.some(e=>actual.filter(p=>p.from===e.from&&p.amount===e.amount).length!==1)||actualReceipt!==delta[win.seat])problems.push('S룰 지급자 또는 지급액이 적용 규칙과 다릅니다.');
      issues.push(...problems.map(text=>`${seats[win.seat]}: ${text}`));
      return {seat:win.seat,method:win.method,order:win.order,score:clone(win.score),payers:expected.map(p=>p.from),expectedReceipt,actualReceipt,scoreBefore:before.scores[win.seat],scoreAfter:after[win.seat],payments:actual,issues:problems};
    }
    const payers=win.method==='tsumo'?before.active.filter(i=>i!==win.seat):[win.source];
    const actual=payments.filter(p=>p.to===win.seat&&p.kind===win.method);
    const tsumoBonus=win.method==='tsumo'?game.rules.tsumoBonusPerPayer:0;
    const perPayer=win.score.total+tsumoBonus,expectedReceipt=perPayer*payers.length,actualReceipt=actual.reduce((sum,p)=>sum+p.amount,0);
    const problems=[];
    if(actual.length!==payers.length||payers.some(i=>actual.filter(p=>p.from===i&&p.amount===perPayer).length!==1))problems.push('지급자 또는 지급액이 적용 규칙과 다릅니다.');
    if((win.score.yaku==='pinfu'||win.score.name==='핑후')&&(win.score.base!==100||win.score.bonus!==0||win.score.total!==100))problems.push('핑후 역 점수 또는 가산점이 잘못되었습니다.');
    if(actualReceipt!==expectedReceipt||delta[win.seat]!==actualReceipt)problems.push('화료 수입과 점수 변화가 다릅니다.');
    issues.push(...problems.map(text=>`${seats[win.seat]}: ${text}`));
    return {seat:win.seat,method:win.method,order:win.order,score:clone(win.score),tsumoBonus,payers,perPayer,expectedReceipt,actualReceipt,scoreBefore:before.scores[win.seat],scoreAfter:after[win.seat],payments:actual,issues:problems};
  });
  const draws=game.events.slice(before.events).filter(e=>e.type==='draw'||e.type==='kanDraw').map(({type,seat,id})=>({type,seat,id}));
  return {seat,action:clone(action),before:before.scores,after,delta,payments,wins,draws,issues,eventRange:[before.events,game.events.length],...error?{error:String(error.message??error)}:{}};
}

export class GameJournal{
  constructor({storage=null,now=()=>new Date().toISOString(),newId=()=>crypto.randomUUID()}={}){this.storage=storage;this.now=now;this.newId=newId;this.current=null;this.persisted=false;}
  begin(game,{mode='practice',seat=0,policy=null,profile=null,room=null,gameNumber=null,build=null}={}){
    this.current={format:LOG_FORMAT,id:this.newId(),startedAt:this.now(),updatedAt:this.now(),mode,humanSeat:seat,policy,profile,room,gameNumber,build,
      initialGame:clone(game),actions:[],observations:[],errors:[],game:clone(game)};
    this.save(game);return this.current;
  }
  record(game,seat,action,before,error=null){
    if(!this.current||this.current.mode!=='practice')return;
    this.current.actions.push({n:this.current.actions.length,at:this.now(),...actionRecord(game,seat,action,before,error)});
  }
  observe(game,revision){
    if(!this.current||this.current.mode!=='online')return;
    if(this.current.observations.at(-1)?.revision===revision)return;
    const before=scores(this.current.game),after=scores(game);
    this.current.observations.push({revision,at:this.now(),before,after,delta:after.map((score,i)=>score-before[i]),events:clone(game.events)});
    this.save(game);
  }
  error(game,error){if(!this.current)return;this.current.errors.push({at:this.now(),message:String(error.message??error)});this.save(game);}
  index(){try{const value=JSON.parse(this.storage?.getItem(INDEX)??'[]');return Array.isArray(value)?value.filter(x=>x&&typeof x.id==='string'&&typeof x.updatedAt==='string'&&Number.isSafeInteger(x.chars)&&x.chars>=0):[];}catch{return [];}}
  summary(){const log=this.current;if(!log)return null;return {id:log.id,startedAt:log.startedAt,updatedAt:log.updatedAt,mode:log.mode,seed:log.game.seed??null,seat:log.humanSeat,seatName:seatLabels(log.game)[log.humanSeat],status:log.game.end??'in-progress',score:log.game.players[log.humanSeat].score,actions:log.actions.length,issues:log.actions.reduce((n,a)=>n+a.issues.length,0)+log.errors.length};}
  list(){const all=this.index().filter(x=>x.id!==this.current?.id);return this.current?[this.summary(),...all]:all;}
  read(id=this.current?.id){
    if(id===this.current?.id)return clone(this.current);
    try{const log=expandLog(JSON.parse(this.storage?.getItem(PREFIX+id)??'null'));return log?.format===LOG_FORMAT&&log.id===id?log:null;}catch{return null;}
  }
  save(game){
    if(!this.current)return false;
    this.current.game=clone(game);this.current.updatedAt=this.now();this.persisted=false;
    if(!this.storage)return false;
    const text=JSON.stringify(compactLog(this.current)),summary={...this.summary(),chars:text.length};
    // Never evict old logs just to make room for an unbounded current record.
    if(text.length>MAX_CHARS)return false;
    const previous=this.index().filter(x=>x.id!==summary.id).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
    const keep=[summary],remove=[];let size=text.length;
    for(const entry of previous){if(keep.length<MAX_LOGS&&size+(entry.chars??0)<=MAX_CHARS){keep.push(entry);size+=entry.chars??0;}else remove.push(entry);}
    try{
      // Write the new log before pruning so a quota failure preserves history.
      this.storage.setItem(PREFIX+summary.id,text);
      this.storage.setItem(INDEX,JSON.stringify(keep));
      for(const entry of remove)this.storage.removeItem(PREFIX+entry.id);
      this.persisted=true;
    }catch{return false;}
    return true;
  }
}

export function logText(log){
  log=expandLog(log);const game=log.game,seats=seatLabels(game),variant=game.rules.variant==='S'?'S':'H',lines=[`${variant}룰 마작 대국 로그`,`${log.startedAt} · ${log.mode==='practice'?'혼자 연습':'4인 대국'} · 내 자리 ${seats[log.humanSeat]}`,`배패 번호: ${game.seed??'서버 비공개'} · 화면 버전: ${log.build??'미기록'}`,
    `${variant==='S'?'이번 국 증감':'최종 점수'}: ${scores(game).map((score,i)=>`${seats[i]} ${signed(score)}`).join(' / ')}`,''];
  if(game.startingScores)lines.push(`반장 누적 (종료 공탁 별도): ${game.startingScores.map((n,i)=>seats[i]+' '+(n+game.players[i].score)).join(' / ')}`,'');
  for(const entry of log.actions){
    const action=entry.action,tile=Number.isInteger(action.tile)?` ${tileName(action.tile)}`:'';
    if(action.type!=='pass')lines.push(`#${entry.n+1} ${seats[entry.seat]} ${({discard:'버림',riichi:'리치·버림',tsumo:'쯔모',ron:'론',chi:'치',pon:'퐁',ankan:'안깡',minkan:'명깡',kakan:'가깡'})[action.type]??action.type}${tile}`);
    for(const win of entry.wins){const detail=variant==='S'?`${win.score.yakuman?'역만':win.score.han+'판'}`:`역 ${win.score.base}${win.score.bonus?' + 가산 '+win.score.bonus:''}${win.tsumoBonus?' + 쯔모 '+win.tsumoBonus:''}`;lines.push(`  ${seats[win.seat]} ${win.score.name} (${detail})`);if(win.issues.length)lines.push(`  규칙상 ${win.expectedReceipt}, 실제 수입 ${win.actualReceipt}`);}
    for(const payment of entry.payments)lines.push(`  ${seats[payment.from]??'공탁'} → ${seats[payment.to]??'공탁'}: ${payment.amount}점`);
    for(const draw of entry.draws)lines.push(`  ${seats[draw.seat]} ${draw.type==='kanDraw'?'보충패':'뽑은 패'}: ${tileName(typeOf(draw.id))}`);
    for(const issue of entry.issues)lines.push(`  [정산 확인 필요] ${issue}`);
    if(entry.error)lines.push(`  [실행 오류] ${entry.error}`);
  }
  for(const entry of log.observations)if(entry.delta.some(Boolean))lines.push(`수신 ${entry.revision} 점수 변동: ${entry.delta.map((v,i)=>v?seats[i]+' '+signed(v):'').filter(Boolean).join(' / ')}`);
  lines.push('','현재 손패·후로 (JSON에는 원본 패 번호와 상세 기록 포함)');
  for(let seat=0;seat<4;seat++){const p=game.players[seat];lines.push(`${seats[seat]}: ${p.hand.map(id=>tileName(typeOf(id))).join(' ')} / ${p.melds.map(m=>`${m.type} ${m.ids.map(id=>tileName(typeOf(id))).join(' ')}`).join(' / ')}`);}
  for(const error of log.errors)lines.push(`[오류 ${error.at}] ${error.message}`);
  return lines.join('\n')+'\n';
}

export function reviewText(input){
 const log=expandLog(input),game=log.game,seats=seatLabels(game),s=game.rules.variant==='S',lines=[`${s?'S':'H'}룰 · ${game.seed??log.room}`,`${s?'이번 국 증감':'최종'}: ${game.players.map((p,i)=>seats[i]+' '+signed(p.score)).join(' / ')}`];
 for(const e of log.actions){
  if(['ankan','minkan','kakan'].includes(e.action.type))lines.push(`${seats[e.seat]} ${e.action.type==='ankan'?'안깡':e.action.type==='minkan'?'명깡':'가깡'}${Number.isInteger(e.action.tile)?' · '+tileName(e.action.tile):''} (이때는 점수 이동 없음)`);
  for(const win of e.wins){const extra=Object.entries(win.score.bonuses??{}).filter(([,value])=>typeof value==='number'&&value).map(([name,value])=>`${({kan:'깡',dragon:'삼원패',roundWind:'장풍',seatWind:'자풍'})[name]??name} ${value}`);
   lines.push(`${seats[win.seat]} ${win.score.name} ${win.method==='ron'?'론':'쯔모'} · ${s?(win.score.yakuman?'역만':win.score.han+'판'):`역 ${win.score.base}${extra.length?' + '+extra.join(' + '):''}${win.tsumoBonus?' + 쯔모 '+win.tsumoBonus+' / 지급자':''}`}`);
  }
  for(const p of e.payments)lines.push(`  ${seats[p.from]??'공탁'} → ${seats[p.to]??'공탁'}: ${p.amount}점`);
  for(const issue of e.issues)lines.push(`[정산 확인 필요] ${issue}`);
 }
 if(log.mode==='online')for(const entry of log.observations)if(entry.delta.some(Boolean))lines.push(`수신 ${entry.revision}: ${entry.delta.map((v,i)=>v?seats[i]+' '+signed(v):'').filter(Boolean).join(' / ')}`);
 return lines.join('\n');
}

export function replayPracticeLog(log){
  log=expandLog(log);
  if(log?.format!==LOG_FORMAT||log.mode!=='practice')throw new Error('혼자 연습 JSON 로그가 필요합니다.');
  const game=clone(log.initialGame);assertInvariants(game);
  for(const entry of log.actions){
    if(entry.error)throw new Error(`${entry.n+1}번째 행동에서 기록된 오류: ${entry.error}`);
    const before=beforeAction(game);
    step(game,entry.seat,entry.action);
    const actual=actionRecord(game,entry.seat,entry.action,before);
    for(const field of ['before','after','delta','payments','wins','draws','issues'])if(canonical(actual[field])!==canonical(entry[field]))throw new Error(`${entry.n+1}번째 행동의 ${field} 재현 불일치`);
  }
  if(canonical(game)!==canonical(log.game))throw new Error('마지막 대국 상태가 기록과 다릅니다.');
  return {actions:log.actions.length,scores:scores(game),end:game.end,issues:log.actions.flatMap(a=>a.issues)};
}

// The transfer ledger is the sole stored source of individual payments. An
// action stores only its event range and, when points change, the new balance.
// V1 remains readable; the in-memory diagnostics stay exact for bug analysis.
export function compactLog(input){
  const log=expandLog(input);if(!log||log.format!==LOG_FORMAT)throw new Error('지원하지 않는 대국 로그입니다.');
  const game=clone(log.game),actionEvents=game.events.filter(e=>e.type==='action');
  for(const p of game.players)if(p.win){const win=game.events.find(e=>e.type==='win'&&e.seat===game.players.indexOf(p));if(win?.order)p.win={event:win.n??game.events.indexOf(win)};}
  for(const e of game.events)if(e.type==='win'&&e.payments){e.paymentIndexes=game.ledger.flatMap((p,i)=>p.to===e.seat&&['ron','tsumo','pot'].includes(p.kind)?[i]:[]);delete e.payments;}
  const actions=log.actions.map((a,i)=>({seat:a.seat,action:a.action,at:a.at,events:a.eventRange??[actionEvents[i]?.n??game.events.length,actionEvents[i+1]?.n??game.events.length],
    ...a.delta.some(Boolean)?{scores:a.after}:{},...a.payments.length?{transfers:a.payments.length}:{},...a.issues.length?{issues:a.issues}:{},...a.error?{error:a.error}:{}}));
  const observations=log.observations.map(o=>({revision:o.revision,at:o.at,eventCount:o.events.length,...o.delta.some(Boolean)?{scores:o.after}:{}}));
  return {...log,format:COMPACT_FORMAT,actions,observations,game};
}
export function expandLog(input){
  if(!input||input.format!==COMPACT_FORMAT)return input;
  const log=clone(input),game=log.game;log.format=LOG_FORMAT;
  for(const e of game.events)if(e.paymentIndexes){e.payments=e.paymentIndexes.map(i=>clone(game.ledger[i]));delete e.paymentIndexes;}
  for(const p of game.players)if(p.win&&Object.hasOwn(p.win,'event')){const event=game.events.find((e,i)=>(e.n??i)===p.win.event);if(!event)throw new Error('화료 기록 참조가 잘못되었습니다.');const {n,type,seat,...win}=event;p.win=clone(win);}
  let previous=scores(log.initialGame),cursor=log.initialGame.ledger?.length??0,active=log.initialGame.players.flatMap((p,i)=>p.won?[]:[i]),pot=log.initialGame.pot??0;
  log.actions=log.actions.map((a,n)=>{
    const after=a.scores??previous,end=cursor+(a.transfers??0),snapshot={...game,players:game.players.map((p,i)=>({...p,score:after[i]})),events:game.events.slice(0,a.events[1]),ledger:game.ledger.slice(0,end)};
    const entry={n,at:a.at,...actionRecord(snapshot,a.seat,a.action,{scores:previous,active,events:a.events[0],ledger:cursor,pot},a.error)};
    entry.issues=a.issues??entry.issues;
    for(const p of entry.payments){if(p.to==='pot')pot+=p.amount;if(p.from==='pot')pot-=p.amount;}
    for(const w of entry.wins)active=active.filter(i=>i!==w.seat);
    previous=after;cursor=end;return entry;
  });
  previous=scores(log.initialGame);
  log.observations=log.observations.map(o=>{const after=o.scores??previous,entry={revision:o.revision,at:o.at,before:previous,after,delta:after.map((v,i)=>v-previous[i]),events:game.events.slice(0,o.eventCount)};previous=after;return entry;});
  return log;
}
