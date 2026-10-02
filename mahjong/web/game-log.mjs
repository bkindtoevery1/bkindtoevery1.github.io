import {step,assertInvariants} from '../engine/game.mjs';
import {tileName,typeOf} from '../engine/tiles.mjs';

export const LOG_FORMAT='h-mahjong-log/v1';
const PREFIX='h-mahjong-log-v1:',INDEX=PREFIX+'index',MAX_LOGS=10,MAX_CHARS=1500000;
const clone=value=>structuredClone(value);
const scores=game=>game.players.map(player=>player.score);
const seats=['동','남','서','북'];
const signed=value=>`${value>0?'+':''}${value}`;

export function beforeAction(game){
  return {scores:scores(game),active:game.players.flatMap((p,i)=>p.won?[]:[i]),events:game.events.length,ledger:game.ledger.length};
}

export function actionRecord(game,seat,action,before,error=null){
  const after=scores(game),payments=clone(game.ledger.slice(before.ledger)),issues=[];
  const delta=after.map((value,i)=>value-before.scores[i]),ledgerDelta=[0,0,0,0];
  for(const payment of payments){ledgerDelta[payment.from]-=payment.amount;ledgerDelta[payment.to]+=payment.amount;}
  if(delta.some((value,i)=>value!==ledgerDelta[i]))issues.push('점수 변화와 실제 이체 내역이 일치하지 않습니다.');
  const wins=game.events.slice(before.events).filter(e=>e.type==='win').map(win=>{
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
  return {seat,action:clone(action),before:before.scores,after,delta,payments,wins,draws,issues,...error?{error:String(error.message??error)}:{}};
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
  summary(){const log=this.current;if(!log)return null;return {id:log.id,startedAt:log.startedAt,updatedAt:log.updatedAt,mode:log.mode,seed:log.game.seed??null,seat:log.humanSeat,status:log.game.end??'in-progress',score:log.game.players[log.humanSeat].score,actions:log.actions.length,issues:log.actions.reduce((n,a)=>n+a.issues.length,0)+log.errors.length};}
  list(){const all=this.index().filter(x=>x.id!==this.current?.id);return this.current?[this.summary(),...all]:all;}
  read(id=this.current?.id){
    if(id===this.current?.id)return clone(this.current);
    try{const log=JSON.parse(this.storage?.getItem(PREFIX+id)??'null');return log?.format===LOG_FORMAT&&log.id===id?log:null;}catch{return null;}
  }
  save(game){
    if(!this.current)return false;
    this.current.game=clone(game);this.current.updatedAt=this.now();this.persisted=false;
    if(!this.storage)return false;
    const text=JSON.stringify(this.current),summary={...this.summary(),chars:text.length};
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
  const game=log.game,lines=['H룰 마작 대국 로그',`시작: ${log.startedAt}`,`최근 저장: ${log.updatedAt}`,`모드: ${log.mode==='practice'?'혼자 연습':'4인 대국 (받은 공개 정보와 내 손패)'}`,`내 자리: ${seats[log.humanSeat]}`,`배패 번호: ${game.seed??'서버 비공개'}`,`화면 버전: ${log.build??'미기록'}`,`쯔모 보너스: 지급자마다 ${game.rules.tsumoBonusPerPayer}점`,
    `최종 점수: ${scores(game).map((score,i)=>`${seats[i]} ${signed(score)}`).join(' / ')}`,''];
  for(const entry of log.actions){
    const action=entry.action,tile=Number.isInteger(action.tile)?` ${tileName(action.tile)}`:'';
    lines.push(`#${entry.n+1} ${seats[entry.seat]} ${action.type}${tile} | 전 ${entry.before.join(', ')} → 후 ${entry.after.join(', ')}`);
    for(const win of entry.wins)lines.push(`  ${seats[win.seat]} ${win.score.name} ${win.method==='tsumo'?'쯔모':'론'}: 역 ${win.score.base} + 가산 ${win.score.bonus} + 쯔모 ${win.tsumoBonus}, 지급자 ${win.payers.length}명, 규칙상 ${win.expectedReceipt}, 실제 수입 ${win.actualReceipt}`);
    for(const payment of entry.payments)lines.push(`  ${seats[payment.from]} → ${seats[payment.to]}: ${payment.amount}점 (${payment.kind})`);
    for(const draw of entry.draws)lines.push(`  ${seats[draw.seat]} ${draw.type==='kanDraw'?'보충패':'뽑은 패'}: ${tileName(typeOf(draw.id))}`);
    for(const issue of entry.issues)lines.push(`  [정산 확인 필요] ${issue}`);
    if(entry.error)lines.push(`  [실행 오류] ${entry.error}`);
  }
  for(const entry of log.observations)lines.push(`수신 ${entry.revision}: ${entry.before.join(', ')} → ${entry.after.join(', ')} (수신 사이의 개별 행동은 서버에서 확인 필요)`);
  lines.push('','현재 손패·후로 (JSON에는 원본 패 번호와 상세 기록 포함)');
  for(let seat=0;seat<4;seat++){const p=game.players[seat];lines.push(`${seats[seat]}: ${p.hand.map(id=>tileName(typeOf(id))).join(' ')} / ${p.melds.map(m=>`${m.type} ${m.ids.map(id=>tileName(typeOf(id))).join(' ')}`).join(' / ')}`);}
  for(const error of log.errors)lines.push(`[오류 ${error.at}] ${error.message}`);
  return lines.join('\n')+'\n';
}

export function replayPracticeLog(log){
  if(log?.format!==LOG_FORMAT||log.mode!=='practice')throw new Error('혼자 연습 JSON 로그가 필요합니다.');
  const game=clone(log.initialGame);assertInvariants(game);
  for(const entry of log.actions){
    if(entry.error)throw new Error(`${entry.n+1}번째 행동에서 기록된 오류: ${entry.error}`);
    const before=beforeAction(game);
    step(game,entry.seat,entry.action);
    const actual=actionRecord(game,entry.seat,entry.action,before);
    for(const field of ['before','after','delta','payments','wins','draws','issues'])if(JSON.stringify(actual[field])!==JSON.stringify(entry[field]))throw new Error(`${entry.n+1}번째 행동의 ${field} 재현 불일치`);
  }
  if(JSON.stringify(game)!==JSON.stringify(log.game))throw new Error('마지막 대국 상태가 기록과 다릅니다.');
  return {actions:log.actions.length,scores:scores(game),end:game.end,issues:log.actions.flatMap(a=>a.issues)};
}
