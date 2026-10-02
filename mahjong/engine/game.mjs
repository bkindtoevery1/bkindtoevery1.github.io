import {typeOf,counts,shuffledWall} from './tiles.mjs';
import {ruleset} from './rules.mjs';
import {scoreHand,winningTiles} from './score.mjs';

const actionKey=a=>JSON.stringify(a);
const meldView=m=>({type:m.type,tile:m.tile,open:m.open,from:m.from});
export function activeSeats(s){return s.players.map((p,i)=>p.won?null:i).filter(i=>i!==null);}
export function nextActive(s,seat){for(let i=1;i<=4;i++)if(!s.players[(seat+i)%4].won)return (seat+i)%4;throw new Error('No active player');}
const event=(s,e)=>s.events.push({n:s.events.length,...e});
const handTypes=p=>p.hand.map(typeOf);
const scoreContext=(s,seat,method,t)=>({method,winTile:t,seatWind:27+(seat-s.dealer+4)%4});
export function createGame({seed=1,rules={},dealer=0,wall=null}={}){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||!Number.isInteger(dealer)||dealer<0||dealer>3)throw new Error('Invalid seed/dealer');
  const r=ruleset(rules),w=wall?[...wall]:shuffledWall(seed);
  if(w.length!==136||new Set(w).size!==136||w.some(t=>!Number.isInteger(t)||t<0||t>=136))throw new Error('Invalid wall');
  const s={version:1,seed,rules:r,dealer,wall:w,dead:[],players:Array.from({length:4},()=>({hand:[],melds:[],river:[],score:0,won:false,win:null,passLock:false,drawn:null,forbidden:[],stats:{winReceipt:0,dealInLoss:0,tsumoPaid:0,drawLoss:0,drawGain:0,ronDeclined:0,closedKans:0}})),phase:'init',turn:dealer,draws:0,kans:0,winners:[],events:[],reaction:null,ledger:[],end:null};
  if(r.deadWallTiles)s.dead=s.wall.splice(s.wall.length-r.deadWallTiles);
  for(let n=0;n<13;n++)for(let off=0;off<4;off++)s.players[(dealer+off)%4].hand.push(s.wall.shift());
  for(const p of s.players)p.hand.sort((a,b)=>a-b);
  draw(s,dealer);assertInvariants(s);return s;
}
function transfer(s,from,to,amount,kind){if(amount<0||!Number.isSafeInteger(amount))throw new Error('Invalid transfer');s.players[from].score-=amount;s.players[to].score+=amount;s.ledger.push({from,to,amount,kind});if(kind==='ron'){s.players[from].stats.dealInLoss+=amount;s.players[to].stats.winReceipt+=amount;}else if(kind==='tsumo'){s.players[from].stats.tsumoPaid+=amount;s.players[to].stats.winReceipt+=amount;}else{s.players[from].stats.drawLoss+=amount;s.players[to].stats.drawGain+=amount;}}
function draw(s,seat,kan=false){
  if(!s.wall.length){settleDraw(s);return;}
  const p=s.players[seat],id=kan?s.wall.pop():s.wall.shift();p.hand.push(id);p.hand.sort((a,b)=>a-b);p.drawn=id;p.passLock=false;p.forbidden=[];s.turn=seat;s.phase='turn';s.reaction=null;s.draws++;event(s,{type:kan?'kanDraw':'draw',seat,id});
}
function win(s,seat,method,source,tile){
  const p=s.players[seat];if(p.won)throw new Error('Already won');
  const ts=handTypes(p);if(method==='ron')ts.push(typeOf(tile));
  const score=scoreHand(ts,p.melds,scoreContext(s,seat,method,typeOf(tile)),s.rules);if(!score)throw new Error('Illegal win');
  const payers=method==='ron'?[source]:activeSeats(s).filter(i=>i!==seat);
  for(const from of payers)transfer(s,from,seat,score.total+(method==='tsumo'?s.rules.tsumoBonusPerPayer:0),method);
  p.won=true;p.win={method,source,tile,order:s.winners.length+1,drawNumber:s.draws,score};p.drawn=null;p.forbidden=[];s.winners.push(seat);event(s,{type:'win',seat,...p.win});
}
function finishOrDraw(s,previous){if(s.winners.length>=3){s.end='three-winners';s.phase='end';s.reaction=null;event(s,{type:'end',reason:s.end});}else draw(s,nextActive(s,previous));}
export function visibleCounts(s,seat){
  const out=Array(34).fill(0);const add=id=>out[typeOf(id)]++;
  for(let i=0;i<4;i++){
    const p=s.players[i];for(const m of p.melds)for(const id of m.ids)add(id);
    for(const d of p.river)if(!d.claimed)add(d.id);
    if(i===seat||p.won&&s.rules.revealWinnerHand)for(const id of p.hand){if(i!==seat&&p.win.method==='tsumo'&&!s.rules.revealTsumoWinningTile&&id===p.win.tile)continue;add(id);}
  }
  return out;
}
export function settleDraw(s){
  if(s.phase==='end')throw new Error('Already ended');
  if(s.wall.length)throw new Error('Cannot settle before wall exhaustion');
  const active=activeSeats(s),ready=[];
  for(const seat of active){const p=s.players[seat],visible=visibleCounts(s,seat);let waits=winningTiles(handTypes(p),p.melds,scoreContext(s,seat,'ron'),s.rules);
    if(s.rules.drawWaitAvailability==='public-possible')waits=waits.filter(w=>visible[w.tile]<4);
    if(waits.length)ready.push({seat,amount:Math.max(...waits.map(w=>s.rules.drawIncludesBonuses?w.score.total:w.score.base)),waits:waits.map(w=>w.tile)});
  }
  for(const from of active.filter(i=>!ready.some(x=>x.seat===i)))for(const to of ready)transfer(s,from,to.seat,to.amount,'draw');
  s.phase='end';s.reaction=null;s.end='exhaustive-draw';event(s,{type:'drawSettlement',ready});event(s,{type:'end',reason:s.end});
}
function canRon(s,seat){
  const p=s.players[seat],r=s.reaction,t=typeOf(r.id);
  if(p.won||seat===r.source||p.passLock)return null;
  if(s.rules.selfDiscardFuriten){const waits=winningTiles(handTypes(p),p.melds,scoreContext(s,seat,'ron'),s.rules);if(waits.some(w=>p.river.some(d=>typeOf(d.id)===w.tile)))return null;}
  return scoreHand([...handTypes(p),t],p.melds,scoreContext(s,seat,'ron',t),s.rules);
}
export function actor(s){if(s.phase==='turn')return s.turn;if(s.phase==='reaction')return s.reaction.pending[0];return null;}
export function legalActions(s,seat=actor(s)){
  if(seat===null||seat!==actor(s))return [];
  const p=s.players[seat],c=counts(handTypes(p)),actions=[];
  if(s.phase==='turn'){
    if(p.drawn!==null&&scoreHand(handTypes(p),p.melds,scoreContext(s,seat,'tsumo',typeOf(p.drawn)),s.rules))actions.push({type:'tsumo'});
    if(p.drawn!==null&&s.wall.length&&s.kans<s.rules.maxKans){
      for(let t=0;t<34;t++)if(c[t]===4)actions.push({type:'ankan',tile:t});
      p.melds.forEach((m,i)=>{if(m.type==='pon'&&c[m.tile])actions.push({type:'kakan',meld:i});});
    }
    for(let t=0;t<34;t++)if(c[t]&&!p.forbidden.includes(t))actions.push({type:'discard',tile:t});
  }else{
    const r=s.reaction,t=typeOf(r.id),ron=canRon(s,seat);
    if(ron)actions.push({type:'ron'});
    if(ron&&!s.rules.ronPassAllowed)return actions;
    actions.push({type:'pass'});
    if(r.kind==='discard'&&s.wall.length){
      if(c[t]>=2)actions.push({type:'pon',tile:t});
      if(c[t]>=3&&s.kans<s.rules.maxKans)actions.push({type:'minkan',tile:t});
      const chiSeat=s.rules.chiFrom==='next-active'?nextActive(s,r.source):(r.source+1)%4;
      if(seat===chiSeat&&t<27)for(let start=Math.max(Math.floor(t/9)*9,t-2);start<=Math.min(Math.floor(t/9)*9+6,t);start++){
        const need=[start,start+1,start+2].filter(x=>x!==t);if(need.every(x=>c[x]>0))actions.push({type:'chi',tile:start});
      }
    }
  }
  return actions;
}
function removeTypes(p,types){const out=[];for(const t of types){const i=p.hand.findIndex(id=>typeOf(id)===t);if(i<0)throw new Error('Missing tile');out.push(...p.hand.splice(i,1));}return out;}
function beginReaction(s,source,id,kind,extra={}){
  const pending=[];for(let n=1;n<4;n++){const i=(source+n)%4;if(!s.players[i].won)pending.push(i);}
  s.phase='reaction';s.reaction={source,id,kind,pending,answers:[],...extra};
}
function completeKan(s,seat){s.kans++;event(s,{type:'kan',seat});draw(s,seat,true);}
function resolveReaction(s){
  const r=s.reaction;let rons=r.answers.filter(x=>x.action.type==='ron');if(s.rules.multipleRon==='nearest')rons=rons.slice(0,1);
  if(rons.length){
    if(r.kind==='kakan'){const p=s.players[r.source];const idx=p.hand.indexOf(r.id);p.hand.splice(idx,1);p.river.push({id:r.id,claimed:false,robbedKan:true});}
    for(const {seat}of rons)win(s,seat,'ron',r.source,r.id);
    finishOrDraw(s,r.source);return;
  }
  if(r.kind==='kakan'){
    const p=s.players[r.source],m=p.melds[r.meld];m.ids.push(...removeTypes(p,[m.tile]));m.type='kan';completeKan(s,r.source);return;
  }
  const calls=r.answers.filter(x=>['pon','minkan','chi'].includes(x.action.type));
  calls.sort((a,b)=>(a.action.type==='chi')-(b.action.type==='chi'));
  if(!calls.length){finishOrDraw(s,r.source);return;}
  const {seat,action:a}=calls[0],p=s.players[seat],t=typeOf(r.id);
  const needed=a.type==='chi'?[a.tile,a.tile+1,a.tile+2].filter(x=>x!==t):Array(a.type==='minkan'?3:2).fill(t);
  const ids=[...removeTypes(p,needed),r.id];s.players[r.source].river.at(-1).claimed=true;
  p.melds.push({type:a.type==='chi'?'chi':a.type==='minkan'?'kan':'pon',tile:a.tile,open:true,from:r.source,ids});
  p.drawn=null;p.forbidden=s.rules.allowKuikae?[]:[t];s.turn=seat;s.phase='turn';s.reaction=null;event(s,{type:'call',seat,action:a,from:r.source});
  if(a.type==='minkan')completeKan(s,seat);
}
export function step(s,seat,a,{validate=true}={}){
  if(!a||!legalActions(s,seat).some(x=>actionKey(x)===actionKey(a)))throw new Error(`Illegal action by ${seat}: ${JSON.stringify(a)}`);
  const p=s.players[seat];event(s,{type:'action',seat,action:{...a}});
  if(s.phase==='reaction'){
    const r=s.reaction;if(a.type!=='ron'&&canRon(s,seat)){p.stats.ronDeclined++;if(s.rules.passRonLock==='until-draw')p.passLock=true;}
    r.answers.push({seat,action:{...a}});r.pending.shift();if(!r.pending.length)resolveReaction(s);
  }else if(a.type==='tsumo'){win(s,seat,'tsumo',seat,p.drawn);finishOrDraw(s,seat);}
  else if(a.type==='discard'){
    const [id]=removeTypes(p,[a.tile]);p.river.push({id,claimed:false});p.drawn=null;p.forbidden=[];beginReaction(s,seat,id,'discard');
  }else if(a.type==='ankan'){
    const ids=removeTypes(p,Array(4).fill(a.tile));p.melds.push({type:'kan',tile:a.tile,open:false,from:seat,ids});p.stats.closedKans++;completeKan(s,seat);
  }else if(a.type==='kakan'){
    const id=p.hand.find(id=>typeOf(id)===p.melds[a.meld].tile);
    if(s.rules.addedKanRobAllowed)beginReaction(s,seat,id,'kakan',{meld:a.meld});
    else {const m=p.melds[a.meld];m.ids.push(...removeTypes(p,[m.tile]));m.type='kan';completeKan(s,seat);}
  }
  if(validate)assertInvariants(s);return s;
}
// This is the entire policy boundary. No state, seed, tile IDs, wall order or concealed opponent hands.
export function observation(s,seat=actor(s)){
  if(seat!==actor(s))throw new Error('Not this player’s decision');const p=s.players[seat];
  const players=s.players.map((p,i)=>({seat:i,won:p.won,score:p.score,handSize:p.hand.length,melds:p.melds.map(meldView),discards:p.river.map(d=>({tile:typeOf(d.id),claimed:d.claimed})),revealed:p.won&&s.rules.revealWinnerHand?p.hand.filter(id=>s.rules.revealTsumoWinningTile||p.win.method!=='tsumo'||id!==p.win.tile).map(typeOf):[]}));
  return {seat,dealer:s.dealer,rules:structuredClone(s.rules),hand:handTypes(p),melds:p.melds.map(meldView),players,visible:visibleCounts(s,seat),activeCount:activeSeats(s).length,wallRemaining:s.wall.length,draws:s.draws,phase:s.phase,lastDiscard:s.reaction?{seat:s.reaction.source,tile:typeOf(s.reaction.id),kind:s.reaction.kind}:null,legalActions:legalActions(s,seat)};
}
export function assertInvariants(s){
  const all=[...s.wall,...s.dead];for(const p of s.players){all.push(...p.hand);for(const m of p.melds)all.push(...m.ids);for(const d of p.river)if(!d.claimed)all.push(d.id);}
  if(all.length!==136||new Set(all).size!==136||all.some(id=>!Number.isInteger(id)||id<0||id>135))throw new Error('Tile conservation violated');
  if(s.players.reduce((n,p)=>n+p.score,0)!==0)throw new Error('Score conservation violated');
  for(let seat=0;seat<4;seat++){
    const p=s.players[seat],eff=p.hand.length+3*p.melds.length;
    const turnExtra=(s.phase==='turn'&&s.turn===seat)||(s.phase==='reaction'&&s.reaction.kind==='kakan'&&s.reaction.source===seat);
    const expected=p.won?(p.win.method==='tsumo'?14:13):turnExtra?14:13;
    if(eff!==expected)throw new Error(`Hand size violated seat ${seat}: ${eff} != ${expected}`);
    if(p.won&&(s.phase==='turn'&&s.turn===seat||s.phase==='reaction'&&s.reaction.pending.includes(seat)))throw new Error('Winner acting again');
    for(const m of p.melds){const ts=m.ids.map(typeOf).sort((a,b)=>a-b),wanted=m.type==='chi'?[m.tile,m.tile+1,m.tile+2]:Array(m.type==='kan'?4:3).fill(m.tile);if(JSON.stringify(ts)!==JSON.stringify(wanted))throw new Error('Illegal meld');}
    const st=p.stats;if(p.score!==st.winReceipt+st.drawGain-st.dealInLoss-st.tsumoPaid-st.drawLoss)throw new Error('Ledger attribution violated');
  }
  if(s.winners.length>3||s.winners.length!==s.players.filter(p=>p.won).length)throw new Error('Winner count violated');
  return true;
}
