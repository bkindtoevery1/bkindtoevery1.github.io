import {typeOf,counts,shuffledWall} from '../engine/tiles.mjs';
import {sRules} from './rules.mjs';
import {scoreS,shapeWaits} from './score.mjs';

const handTypes=p=>p.hand.map(typeOf),event=(s,e)=>s.events.push({n:s.events.length,...e});
const meldView=m=>({type:m.type,tile:m.tile,open:m.open,from:m.from});
const key=a=>JSON.stringify(a),same=(a,b)=>key(a)===key(b);
export const actor=s=>s.phase==='turn'?s.turn:s.phase==='reaction'?s.reaction.pending[0]:null;
export const indicators=(s,ura=false)=>Array.from({length:s.kans+1},(_,n)=>typeOf(s.dead[4+2*n+(ura?1:0)]));
function context(s,seat,method,tile){const p=s.players[seat];return {method,winTile:tile,seatWind:27+(seat-s.dealer+4)%4,dealer:seat===s.dealer,riichi:p.riichi,ippatsu:p.ippatsu,
  rinshan:p.drawSource==='kan',lastTile:s.wall.length===0,chankan:method==='ron'&&s.reaction?.kind==='kakan',doraIndicators:indicators(s),uraIndicators:indicators(s,true)};}
export function createGame({seed=1,rules={},dealer=0,wall=null,pot=0,startingScores=null}={}){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(dealer)||dealer<0||dealer>3||!Number.isSafeInteger(pot)||pot<0||pot%1000)throw new Error('Invalid seed/dealer/pot');
  if(startingScores!==null&&(!Array.isArray(startingScores)||startingScores.length!==4||startingScores.some(n=>!Number.isSafeInteger(n))))throw new Error('Invalid starting scores');
  const w=wall?[...wall]:shuffledWall(seed);
  if(w.length!==136||new Set(w).size!==136||w.some(id=>!Number.isInteger(id)||id<0||id>=136))throw new Error('Invalid wall');
  const s={version:1,seed,rules:sRules(rules),dealer,wall:w,dead:w.splice(122),pot,initialPot:pot,
    ...startingScores?{startingScores:[...startingScores]}:{},
    players:Array.from({length:4},()=>({hand:[],melds:[],river:[],score:0,won:false,win:null,passLock:false,drawn:null,drawSource:null,forbidden:[],
      riichi:false,riichiFuriten:false,riichiWaits:[],ippatsu:false,pao:null,stats:{winReceipt:0,dealInLoss:0,tsumoPaid:0,drawLoss:0,drawGain:0,ronDeclined:0,closedKans:0,riichiPaid:0}})),
    phase:'init',turn:dealer,draws:0,kans:0,winners:[],events:[],reaction:null,ledger:[],end:null};
  for(let n=0;n<13;n++)for(let off=0;off<4;off++)s.players[(dealer+off)%4].hand.push(s.wall.shift());
  for(const p of s.players)p.hand.sort((a,b)=>a-b);
  draw(s,dealer);assertInvariants(s);return s;
}
function transfer(s,from,to,amount,kind){
  if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('Invalid transfer');
  if(from==='pot')s.pot-=amount;else s.players[from].score-=amount;
  if(to==='pot')s.pot+=amount;else s.players[to].score+=amount;
  s.ledger.push({from,to,amount,kind});
  if(kind==='riichi')s.players[from].stats.riichiPaid+=amount;
  else if(kind==='pot')s.players[to].stats.winReceipt+=amount;
  else if(kind==='draw'){s.players[from].stats.drawLoss+=amount;s.players[to].stats.drawGain+=amount;}
  else{s.players[from].stats[kind==='ron'?'dealInLoss':'tsumoPaid']+=amount;s.players[to].stats.winReceipt+=amount;}
}
function draw(s,seat,kan=false){
  if(!s.wall.length){settleDraw(s);return;}
  const p=s.players[seat];let id;
  if(kan){const index=s.kans-1;id=s.dead[index];s.dead[index]=s.wall.pop();}else id=s.wall.shift();
  p.hand.push(id);p.hand.sort((a,b)=>a-b);p.drawn=id;p.drawSource=kan?'kan':'wall';p.passLock=false;p.forbidden=[];
  s.turn=seat;s.phase='turn';s.reaction=null;s.draws++;event(s,{type:kan?'kanDraw':'draw',seat,id});
}
function end(s,reason){s.end=reason;s.phase='end';s.reaction=null;event(s,{type:'end',reason});}
function win(s,seat,method,source,tile){
  const p=s.players[seat],tiles=handTypes(p);if(method==='ron')tiles.push(typeOf(tile));
  const score=scoreS(tiles,p.melds,context(s,seat,method,typeOf(tile)),s.rules);if(!score)throw new Error('Illegal S win');
  const first=s.ledger.length,pao=score.yakuman?p.pao:null;
  if(pao!==null){
    if(method==='tsumo'||source===pao)transfer(s,pao,seat,score.points.ron,method);
    else{transfer(s,pao,seat,score.points.ron/2,method);transfer(s,source,seat,score.points.ron/2,method);}
  }else if(method==='ron')transfer(s,source,seat,score.points.ron,method);
  else for(let from=0;from<4;from++)if(from!==seat)transfer(s,from,seat,from===s.dealer?score.points.tsumoDealer:score.points.tsumoOther,method);
  if(s.pot)transfer(s,'pot',seat,s.pot,'pot');
  const payments=structuredClone(s.ledger.slice(first));
  p.won=true;p.win={method,source,tile,order:1,drawNumber:s.draws,score,payments,receipt:payments.reduce((n,p)=>n+p.amount,0)};
  p.drawn=null;s.winners.push(seat);event(s,{type:'win',seat,...p.win});end(s,'win');
}
export function visibleCounts(s,seat){
  const out=Array(34).fill(0),add=id=>out[typeOf(id)]++;
  for(let i=0;i<4;i++){const p=s.players[i];for(const m of p.melds)for(const id of m.ids)add(id);for(const d of p.river)if(!d.claimed)add(d.id);if(i===seat||p.won&&s.rules.revealWinnerHand)for(const id of p.hand)add(id);}
  for(const t of indicators(s))out[t]++;return out;
}
export function settleDraw(s){
  if(s.phase==='end'||s.wall.length)throw new Error('Cannot settle this game');
  const ready=s.players.flatMap((p,seat)=>{const waits=shapeWaits(handTypes(p),p.melds,s.rules);return waits.length?[{seat,waits}]:[];});
  if(ready.length&&ready.length<4){const due=ready.map(p=>({seat:p.seat,amount:3000/ready.length}));for(let from=0;from<4;from++)if(!ready.some(x=>x.seat===from)){let debt=3000/(4-ready.length);for(const to of due){const amount=Math.min(debt,to.amount);if(amount){transfer(s,from,to.seat,amount,'draw');debt-=amount;to.amount-=amount;}}}}
  event(s,{type:'drawSettlement',ready});end(s,'exhaustive-draw');
}
function canRon(s,seat){
  const p=s.players[seat],r=s.reaction;if(seat===r.source||p.passLock||p.riichiFuriten)return null;
  const waits=shapeWaits(handTypes(p),p.melds,s.rules);
  if(p.river.some(d=>waits.includes(typeOf(d.id))))return null;
  return scoreS([...handTypes(p),typeOf(r.id)],p.melds,context(s,seat,'ron',typeOf(r.id)),s.rules);
}
export function legalActions(s,seat=actor(s)){
  if(seat===null||seat!==actor(s))return [];
  const p=s.players[seat],tiles=handTypes(p),c=counts(tiles),out=[];
  if(s.phase==='turn'){
    if(p.drawn!==null&&scoreS(tiles,p.melds,context(s,seat,'tsumo',typeOf(p.drawn)),s.rules))out.push({type:'tsumo'});
    if(p.drawn!==null&&s.wall.length&&s.kans<4){
      for(let t=0;t<34;t++)if(c[t]===4){
        const waits=()=>shapeWaits(tiles.filter(x=>x!==t),[...p.melds,{type:'kan',tile:t,open:false}],s.rules);
        if(!p.riichi||typeOf(p.drawn)===t&&same(waits(),p.riichiWaits))out.push({type:'ankan',tile:t});
      }
      if(!p.riichi)p.melds.forEach((m,i)=>{if(m.type==='pon'&&c[m.tile])out.push({type:'kakan',meld:i});});
    }
    for(let t=0;t<34;t++)if(c[t]&&!p.forbidden.includes(t)&&(!p.riichi||t===typeOf(p.drawn))){
      out.push({type:'discard',tile:t});
      if(!p.riichi&&p.melds.every(m=>!m.open)&&(s.startingScores?.[seat]??s.rules.startingPoints)+p.score>=1000&&s.wall.length>=4){const next=[...tiles];next.splice(next.indexOf(t),1);if(shapeWaits(next,p.melds,s.rules).length)out.push({type:'riichi',tile:t});}
    }
  }else{
    const r=s.reaction,t=typeOf(r.id);if(canRon(s,seat))out.push({type:'ron'});out.push({type:'pass'});
    if(!p.riichi&&r.kind==='discard'&&s.wall.length){
      if(c[t]>=2)out.push({type:'pon',tile:t});if(c[t]>=3&&s.kans<4)out.push({type:'minkan',tile:t});
      if(seat===(r.source+1)%4&&t<27)for(let start=Math.max(Math.floor(t/9)*9,t-2);start<=Math.min(Math.floor(t/9)*9+6,t);start++)if([start,start+1,start+2].filter(x=>x!==t).every(x=>c[x]))out.push({type:'chi',tile:start});
    }
  }
  return out;
}
function remove(p,types){const ids=[];for(const t of types){const i=p.hand.findIndex(id=>typeOf(id)===t);if(i<0)throw new Error('Missing tile');ids.push(...p.hand.splice(i,1));}return ids;}
function reaction(s,source,id,kind,extra={}){s.phase='reaction';s.reaction={source,id,kind,pending:[1,2,3].map(n=>(source+n)%4),answers:[],...extra};}
function cancelIppatsu(s){for(const p of s.players)p.ippatsu=false;}
function completeKan(s,seat){cancelIppatsu(s);s.kans++;event(s,{type:'kan',seat});draw(s,seat,true);}
function acceptRiichi(s,r){if(!r.riichi)return;const p=s.players[r.source];p.riichi=true;p.ippatsu=true;p.riichiWaits=shapeWaits(handTypes(p),p.melds,s.rules);transfer(s,r.source,'pot',1000,'riichi');event(s,{type:'riichi',seat:r.source});}
function resolve(s){
  const r=s.reaction,ron=r.answers.find(x=>x.action.type==='ron');
  if(ron){if(r.kind==='kakan'){const p=s.players[r.source];p.hand.splice(p.hand.indexOf(r.id),1);p.river.push({id:r.id,claimed:false,robbedKan:true});}win(s,ron.seat,'ron',r.source,r.id);return;}
  if(r.kind==='kakan'){const p=s.players[r.source],m=p.melds[r.meld];m.ids.push(...remove(p,[m.tile]));m.type='kan';completeKan(s,r.source);return;}
  acceptRiichi(s,r);
  const calls=r.answers.filter(x=>['pon','minkan','chi'].includes(x.action.type)).sort((a,b)=>(a.action.type==='chi')-(b.action.type==='chi'));
  if(!calls.length){draw(s,(r.source+1)%4);return;}
  cancelIppatsu(s);const {seat,action:a}=calls[0],p=s.players[seat],t=typeOf(r.id),ids=[...remove(p,a.type==='chi'?[a.tile,a.tile+1,a.tile+2].filter(x=>x!==t):Array(a.type==='minkan'?3:2).fill(t)),r.id];
  s.players[r.source].river.at(-1).claimed=true;p.melds.push({type:a.type==='chi'?'chi':a.type==='minkan'?'kan':'pon',tile:a.tile,open:true,from:r.source,ids});
  const open=p.melds.filter(m=>m.open&&m.type!=='chi');if(t>=31&&open.filter(m=>m.tile>=31).length===3||t>=27&&t<31&&open.filter(m=>m.tile>=27&&m.tile<31).length===4)p.pao=r.source;
  p.drawn=null;p.drawSource=null;p.forbidden=s.rules.allowKuikae?[]:[t];s.turn=seat;s.phase='turn';s.reaction=null;event(s,{type:'call',seat,action:a,from:r.source});
  if(a.type==='minkan')completeKan(s,seat);
}
export function step(s,seat,a,{validate=true}={}){
  if(!a||!legalActions(s,seat).some(x=>same(x,a)))throw new Error(`Illegal action by ${seat}: ${key(a)}`);
  const p=s.players[seat];event(s,{type:'action',seat,action:{...a}});
  if(s.phase==='reaction'){const r=s.reaction;if(a.type!=='ron'&&canRon(s,seat)){p.passLock=true;p.stats.ronDeclined++;if(p.riichi)p.riichiFuriten=true;}r.answers.push({seat,action:{...a}});r.pending.shift();if(!r.pending.length)resolve(s);}
  else if(a.type==='tsumo')win(s,seat,'tsumo',seat,p.drawn);
  else if(a.type==='discard'||a.type==='riichi'){
    const id=p.riichi?p.hand.splice(p.hand.indexOf(p.drawn),1)[0]:remove(p,[a.tile])[0];
    if(p.riichi)p.ippatsu=false;p.river.push({id,claimed:false,...a.type==='riichi'?{riichi:true}:{}});p.drawn=null;p.forbidden=[];reaction(s,seat,id,'discard',{riichi:a.type==='riichi'});
  }else if(a.type==='ankan'){p.melds.push({type:'kan',tile:a.tile,open:false,from:seat,ids:remove(p,Array(4).fill(a.tile))});p.stats.closedKans++;completeKan(s,seat);}
  else if(a.type==='kakan'){cancelIppatsu(s);reaction(s,seat,p.hand.find(id=>typeOf(id)===p.melds[a.meld].tile),'kakan',{meld:a.meld});}
  if(validate)assertInvariants(s);return s;
}
export function observation(s,seat=actor(s)){
  if(seat!==actor(s))throw new Error('Not this player’s decision');const p=s.players[seat];
  const players=s.players.map((p,i)=>({seat:i,won:p.won,score:p.score,handSize:p.hand.length,riichi:p.riichi,melds:p.melds.map(meldView),discards:p.river.map(d=>({tile:typeOf(d.id),claimed:d.claimed,riichi:!!d.riichi})),revealed:p.won&&s.rules.revealWinnerHand?handTypes(p):[]}));
  return {seat,dealer:s.dealer,rules:structuredClone(s.rules),hand:handTypes(p),melds:p.melds.map(meldView),players,visible:visibleCounts(s,seat),riichi:p.riichi,pot:s.pot,doraIndicators:indicators(s),activeCount:4,wallRemaining:s.wall.length,draws:s.draws,phase:s.phase,lastDiscard:s.reaction?{seat:s.reaction.source,tile:typeOf(s.reaction.id),kind:s.reaction.kind}:null,legalActions:legalActions(s,seat)};
}
export function assertInvariants(s){
  const all=[...s.wall,...s.dead];for(const p of s.players){all.push(...p.hand);for(const m of p.melds)all.push(...m.ids);for(const d of p.river)if(!d.claimed)all.push(d.id);}
  if(all.length!==136||new Set(all).size!==136||all.some(id=>!Number.isInteger(id)||id<0||id>135))throw new Error('Tile conservation violated');
  if(s.players.reduce((n,p)=>n+p.score,0)+s.pot!==s.initialPot||s.pot<0)throw new Error('Score conservation violated');
  for(let seat=0;seat<4;seat++){
    const p=s.players[seat],extra=s.phase==='turn'&&s.turn===seat||s.phase==='reaction'&&s.reaction.kind==='kakan'&&s.reaction.source===seat||p.win?.method==='tsumo';
    if(p.hand.length+3*p.melds.length!==(extra?14:13))throw new Error(`Hand size violated seat ${seat}`);
    for(const m of p.melds){const wanted=m.type==='chi'?[m.tile,m.tile+1,m.tile+2]:Array(m.type==='kan'?4:3).fill(m.tile);if(!same(m.ids.map(typeOf).sort((a,b)=>a-b),wanted))throw new Error('Illegal meld');}
    const st=p.stats;if(p.score!==st.winReceipt+st.drawGain-st.dealInLoss-st.tsumoPaid-st.drawLoss-st.riichiPaid)throw new Error('Ledger attribution violated');
  }
  if(s.dead.length!==14||s.kans>4||s.winners.length>1||s.winners.length!==s.players.filter(p=>p.won).length)throw new Error('S round invariant violated');
  return true;
}
