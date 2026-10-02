import {createGame,actor as engineActor,legalActions as engineLegal,observation as engineObservation,step} from '../engine/game.mjs';
import {tileName,typeOf} from '../engine/tiles.mjs';
import {chooseAction,POLICIES,OPPONENT_PROFILES} from '../policies/index.mjs';
import {handDisplay,needsAutomaticPass as localAutomaticPass,nextDelay,practiceSeat,SEAT_NAMES,displayedTurn,resolveAiReactions} from './practice-flow.mjs';
import {actionLabel,strategyRecommendations} from './recommendations.mjs';
import {tileFace} from './tile-view.mjs';
import {canSelectTile,selectedDiscard,seatPositions} from './selection.mjs';
import {RoomClient} from './multiplayer.mjs';
const $=id=>document.getElementById(id);let state=null,auto=false,timer=null,humanSeat=0;
let recommendationRevision=0,currentRecommendations=[],selectedTileId=null;
let online=false,remote=null,networkBusy=false;
const needsPass=(s,seat)=>online&&s===state?s.phase==='reaction'&&remote?.legalActions.length===1&&remote.legalActions[0].type==='pass':localAutomaticPass(s,seat);
const actor=s=>online&&remote&&s===state?(remote.legalActions.length?humanSeat:engineActor(s)):engineActor(s);
const legalActions=s=>online&&s===state?remote?.legalActions??[]:engineLegal(s);
const observation=s=>online&&s===state?remote?.observation:engineObservation(s);
const canChooseTile=id=>online?!networkBusy&&roomClient.connected&&state.players[humanSeat].hand.includes(id)&&legalActions(state).some(a=>a.type==='discard'&&a.tile===typeOf(id)):canSelectTile(state,humanSeat,id,auto);
function discardSelection(){if(online){if(!canChooseTile(selectedTileId))throw new Error('현재 손패에서 버릴 패를 다시 선택하세요.');return {type:'discard',tile:typeOf(selectedTileId)};}return selectedDiscard(state,humanSeat,selectedTileId,auto);}
const roomClient=new RoomClient({onState:receiveRoom,onStatus:message=>{$('room-connection').textContent=message;if(online&&remote?.state&&!roomClient.connected){networkBusy=true;render();}}});
for(const [id,p]of Object.entries(POLICIES)){const opt=document.createElement('option');opt.value=id;opt.textContent=`${id} · ${p.name}`;$('policy').append(opt);}$('policy').value='D';
function node(tag,text,cls){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;}
function tiles(parent,types){for(const t of types)parent.append(tileFace(t,{small:true}));}
function meldText(m){return `${m.type==='kan'?(m.open?'명깡':'안깡'):m.type==='pon'?'퐁':'치'} ${m.type==='chi'?[m.tile,m.tile+1,m.tile+2].map(tileName).join(' '):tileName(m.tile)}`;}
function handTile(id,legal,drawn=false){const t=typeOf(id),b=tileFace(t,{button:true});b.dataset.id=String(id);b.classList.toggle('drawn-tile',drawn);b.disabled=auto||networkBusy||!legal.some(a=>a.type==='discard'&&a.tile===t);b.setAttribute('aria-label',`${drawn?'방금 뽑은 패 · ':''}${tileName(t)} 선택. 다시 누르면 버립니다.`);b.setAttribute('aria-pressed',String(id===selectedTileId));b.onclick=()=>{try{if(selectedTileId===id)confirmDiscard();else{if(!canChooseTile(id))throw new Error('내 버림패 선택 차례를 기다려 주세요.');selectedTileId=id;updateSelection();}}catch(e){$('error').textContent=e.message;}};b.onkeydown=e=>{if(e.key==='Escape'){selectedTileId=null;updateSelection();}};return b;}
function confirmDiscard(){return act(discardSelection());}
function updateSelection(){
 if(selectedTileId!==null&&!canChooseTile(selectedTileId))selectedTileId=null;
 for(const tile of $('hand').querySelectorAll('button[data-id]')){const selected=Number(tile.dataset.id)===selectedTileId;tile.classList.toggle('selected',selected);tile.setAttribute('aria-pressed',String(selected));}
 const confirm=$('discard-confirm');if(confirm){confirm.disabled=selectedTileId===null||auto||networkBusy;confirm.textContent=selectedTileId===null?'버리기':`${tileName(typeOf(selectedTileId))} 버리기`;}
 $('selection-hint').textContent=state.end?'새 대국으로 다시 연습할 수 있습니다.':state.players[humanSeat].won?'화료했습니다. 남은 대국을 지켜보세요.':auto?'선택한 전략으로 자동 대국 중입니다.':actor(state)!==humanSeat?'상대가 진행 중입니다.':state.phase==='reaction'?'가능한 행동을 선택하세요.':selectedTileId===null?'패를 선택 → 다시 누르거나 ‘버리기’로 확정':`${tileName(typeOf(selectedTileId))} 선택 · 다시 누르거나 ‘버리기’로 확정`;
}
function renderMeld(m){const el=node('div',undefined,'meld');el.setAttribute('aria-label',meldText(m));el.append(node('span',m.type==='kan'?(m.open?'깡':'안깡'):m.type==='pon'?'퐁':'치','meld-label'));tiles(el,m.ids.map(typeOf));return el;}
function renderRiver(parent,player){parent.replaceChildren();for(const d of player.river){const t=tileFace(typeOf(d.id),{small:true});t.classList.toggle('claimed',!!d.claimed);t.classList.toggle('last-discard',state.phase==='reaction'&&state.reaction.id===d.id);if(d.claimed)t.setAttribute('aria-label',`${tileName(typeOf(d.id))}, 후로에 사용됨`);parent.append(t);}}
function discardMetrics(discard){return `${discard.shanten===0?'텐파이 (0샨텐)':discard.shanten+'샨텐'} · 유효패 추정 ${discard.ukeire}장`;}
function renderRecommendations(){
 const revision=++recommendationRevision,list=$('recommendation-list'),status=$('recommendation-status');currentRecommendations=[];list.replaceChildren();
 if(state.phase==='end'){status.textContent='국이 끝났습니다. 새 국을 시작하면 추천이 표시됩니다.';return;}
 if(state.players[humanSeat].won){status.textContent='화료를 마쳤습니다. 남은 대국을 지켜보세요.';return;}
 if(auto){status.textContent='내 자리도 AI가 진행 중입니다. 자동 대국을 멈추면 추천을 직접 선택할 수 있습니다.';return;}
 if(networkBusy){status.textContent='서버 응답을 기다리는 중입니다.';return;}
 if(actor(state)!==humanSeat){status.textContent='내 선택 차례가 되면 A~E 전략의 추천을 함께 보여줍니다.';return;}
 if(needsPass(state,humanSeat)){status.textContent='지금은 넘기기만 가능해 0.7초 뒤 자동으로 진행합니다.';return;}
 currentRecommendations=strategyRecommendations(observation(state,humanSeat));status.textContent='버튼을 누르면 해당 전략의 선택을 한 번 실행합니다.';
 for(const rec of currentRecommendations){
  const card=node('article',undefined,'recommendation-card'),title=node('h4');title.append(node('span',rec.policy,'policy-badge'),node('span',rec.name));card.append(title,node('p',rec.reason,'recommendation-reason'));
  if(rec.action.type==='discard')card.append(node('p',discardMetrics(rec.discard),'recommendation-metrics'));
  const button=node('button',rec.label,'recommendation-action'+(['ron','tsumo'].includes(rec.action.type)?' is-win':''));button.setAttribute('aria-label',`${rec.policy} 전략 추천 실행: ${rec.label}`);button.onclick=()=>actRecommendation(rec.policy,'recommended',revision);card.append(button);
  if(rec.discard&&rec.action.type!=='discard'){
   const alternative=node('div',undefined,'recommendation-alternative');alternative.append(node('p','깡 대신 버린다면','alternative-title'),node('p',discardMetrics(rec.discard),'recommendation-metrics'));
   const discardButton=node('button',rec.discard.label,'recommendation-discard');discardButton.setAttribute('aria-label',`${rec.policy} 전략 버림패 대안 실행: ${rec.discard.label}`);discardButton.onclick=()=>actRecommendation(rec.policy,'discard',revision);alternative.append(discardButton);card.append(alternative);
  }
  list.append(card);
 }
}
function executeRecommendation(policy,mode,revision){
 if(!Object.hasOwn(POLICIES,policy)||!['recommended','discard'].includes(mode))throw new Error('전략과 추천 종류를 다시 선택하세요.');
 if(!Number.isSafeInteger(revision)||revision!==recommendationRevision)throw new Error('대국 상태가 바뀌었습니다. 새 추천을 확인하세요.');
 if(auto||actor(state)!==humanSeat)throw new Error('내가 직접 선택하는 차례에만 추천을 실행할 수 있습니다.');
 const rec=currentRecommendations.find(r=>r.policy===policy),action=mode==='discard'?rec?.discard?.action:rec?.action;
 if(!action)throw new Error('지금 실행할 수 있는 추천이 없습니다.');
 const result=playHumanAction(action);return result?.then?result.then(value=>({policy,action:{...action},...value})):{policy,action:{...action},...result};
}
function actRecommendation(policy,mode,revision){try{const result=executeRecommendation(policy,mode,revision);if(result?.then)return result.catch(e=>{$('error').textContent=e.message;});return result;}catch(e){$('error').textContent=e.message;}}
function render(){
 const a=actor(state),shownTurn=displayedTurn(state),p=state.players[humanSeat],positions=seatPositions(humanSeat);
 const reacting=state.phase==='reaction',humanChoice=reacting&&a===humanSeat&&!auto&&!needsPass(state,humanSeat);
 $('game-status').textContent=state.end?`${state.end==='three-winners'?'세 번째 화료':'유국'} · 국 종료`:p.won?'화료 완료 · 남은 대국 진행 중':reacting?(humanChoice?'론 · 후로 선택':'후로 확인 중'):a===humanSeat?'내 차례 · 버림패 선택':`${SEAT_NAMES[a]} 플레이어 차례`;
 $('turn-indicator').textContent=state.end?'국 종료':reacting?(humanChoice?'론 · 후로 선택 가능':'후로 확인 중'):a===humanSeat?'● 내 차례':`${SEAT_NAMES[a]} 진행 중`;
 $('wall').textContent=`남은 패 ${state.wall.length}`;$('win-count').textContent=`화료 ${state.winners.length} / 3명`;
 $('opponents').replaceChildren();$('rivers').replaceChildren();
 for(const [position,i]of Object.entries(positions)){
  const wind=$(`wind-${position}`);wind.textContent=['東','南','西','北'][i];wind.classList.toggle('active-wind',i===shownTurn);
  if(position==='bottom')continue;
  const pl=state.players[i],card=node('div',undefined,`opponent opponent-${position}${pl.won?' won':''}${shownTurn===i?' active':''}`),title=node('div',undefined,'player-title'),who=node('span',undefined,'player-seat');
  who.append(node('span',['東','南','西','北'][i],'seat-badge'),node('span',online?(remote.members.find(m=>m.seat===i)?.name??'플레이어'):'AI','player-name'));title.append(who,node('span',`${pl.score>0?'+':''}${pl.score}`,'player-score'));card.append(title,node('p',pl.won?`${pl.win.order}번째 ${pl.win.method==='ron'?'론':'쯔모'} · ${pl.win.score.name}`:`${SEAT_NAMES[i]} · 손패 ${pl.handSize??pl.hand.length}장`,'player-sub'));
  for(const m of pl.melds)card.append(renderMeld(m));
  if(state.end||pl.won){const revealed=node('div',undefined,'revealed-hand');tiles(revealed,pl.hand.filter(id=>state.end||pl.win.method!=='tsumo'||id!==pl.win.tile).map(typeOf));card.append(revealed);}
  else{const hidden=node('div',undefined,'hidden-hand');hidden.setAttribute('aria-hidden','true');for(let j=0;j<(pl.handSize??pl.hand.length);j++)hidden.append(node('span',undefined,'tile-back'));card.append(hidden);}
  $('opponents').append(card);const river=node('div',undefined,`river river-${position}`);river.setAttribute('aria-label',`${SEAT_NAMES[i]} 버림패`);renderRiver(river,pl);$('rivers').append(river);
 }
 $('self-title').replaceChildren(node('span',['東','南','西','北'][humanSeat],'seat-badge'),node('span',`${SEAT_NAMES[humanSeat]} · 나`),node('span',`${p.score>0?'+':''}${p.score}점`,'self-score'));
 if(p.won)$('self-title').append(node('span',`${p.win.order}번째 화료`,'player-sub'));
 $('melds').replaceChildren();for(const m of p.melds)$('melds').append(renderMeld(m));
 const legal=a===humanSeat?legalActions(state):[],hand=handDisplay(state,humanSeat),automaticPass=needsPass(state,humanSeat);$('hand').replaceChildren();for(const id of hand.held)$('hand').append(handTile(id,legal));
 if(hand.drawn!==null){const group=node('div',undefined,'drawn-group');group.append(node('span','뽑은 패','drawn-label'),handTile(hand.drawn,legal,true));$('hand').append(group);}
 $('actions').replaceChildren();
 if(state.phase==='reaction'&&a===humanSeat){const label=node('span',undefined,'reaction-label');label.append(tileFace(typeOf(state.reaction.id),{small:true}),node('span',tileName(typeOf(state.reaction.id))));$('actions').append(label);}
 if(automaticPass)$('actions').append(node('span','가능한 후로 없음 · 0.7초 뒤 자동 넘기기','auto-pass-note'));
 for(const action of legal.filter(a=>a.type!=='discard'&&!(automaticPass&&a.type==='pass'))){const b=node('button',actionLabel(action,{melds:p.melds,legalActions:legal}),['ron','tsumo'].includes(action.type)?'win':'');b.disabled=auto||networkBusy;b.onclick=()=>act(action);$('actions').append(b);}
 if(legal.some(a=>a.type==='discard')){const b=node('button','버리기','discard-confirm');b.id='discard-confirm';b.onclick=()=>{try{confirmDiscard();}catch(e){$('error').textContent=e.message;}};$('actions').append(b);}
 renderRiver($('self-river'),p);updateSelection();renderRecommendations();
 $('events').replaceChildren();for(const e of state.events.filter(e=>['win','kan','drawSettlement','call'].includes(e.type)).slice(-30)){const text=e.type==='win'?`${SEAT_NAMES[e.seat]}: ${e.name??e.score.name} ${e.method==='ron'?'론':'쯔모'}, ${e.score.total}점`:e.type==='call'?`${SEAT_NAMES[e.seat]}: ${e.action.type}`:e.type==='kan'?`${SEAT_NAMES[e.seat]}: 깡, 보충패 수령`:'유국 텐파이 정산 완료';$('events').append(node('li',text));}
}
function aiAction(view){const spec=view.seat===humanSeat?{id:$('policy').value}:OPPONENT_PROFILES[$('profile').value][(view.seat-humanSeat+4)%4-1];return chooseAction(view,spec.id,spec.weights);}
function finishAction(){resolveAiReactions(state,humanSeat,aiAction);render();schedule();}
function playHumanAction(action){if(auto||actor(state)!==humanSeat)throw new Error('내 차례에 직접 선택할 수 있습니다.');if(online)return playOnlineAction(action);step(state,humanSeat,action);selectedTileId=null;$('error').textContent='';finishAction();return {seat:humanSeat,phase:state.phase,turn:actor(state)};}
async function playOnlineAction(action){if(networkBusy||!roomClient.connected)throw new Error('서버 응답을 기다려 주세요.');networkBusy=true;selectedTileId=null;render();try{await roomClient.act(action);$('error').textContent='';return {seat:humanSeat,phase:state.phase,turn:actor(state)};}finally{networkBusy=false;if(online&&remote?.state)render();}}
function act(action){try{const result=playHumanAction(action);if(result?.then)return result.catch(e=>{$('error').textContent=e.message;});return result;}catch(e){$('error').textContent=e.message;}}
function tick(){timer=null;if(state.phase==='end'){render();return;}const seat=actor(state),automaticPass=needsPass(state,humanSeat);if(seat===humanSeat&&!auto&&!automaticPass){render();return;}try{if(automaticPass){step(state,humanSeat,{type:'pass'});}else{step(state,seat,aiAction(observation(state)));}finishAction();}catch(e){$('error').textContent=e.message;auto=false;updateAuto();}}
function schedule(){if(timer)clearTimeout(timer);timer=null;if(online)return;const delay=nextDelay(state,auto,humanSeat);if(delay!==null)timer=setTimeout(tick,delay);}
function updateAuto(){$('autoplay').setAttribute('aria-pressed',String(auto));$('autoplay').textContent=auto?'자동 대국 멈추기':'내 자리도 AI로';}
function start(seed){if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('시드는 0–4294967295의 정수여야 합니다.');showPractice();if(timer)clearTimeout(timer);auto=false;selectedTileId=null;updateAuto();humanSeat=practiceSeat(seed);state=createGame({seed});$('seed').value=String(seed);$('practice-info').textContent=`내 자리는 ${SEAT_NAMES[humanSeat]}입니다. 상대 3명은 AI이며 동부터 시작합니다. 패를 선택한 뒤 다시 누르거나 버리기 버튼으로 확정하세요. 론·치·퐁·깡이 불가능하면 0.7초 뒤 자동으로 넘깁니다.`;$('error').textContent='';render();schedule();return {seed,seat:humanSeat,remaining:state.wall.length};}
function showPractice(){online=false;remote=null;networkBusy=false;roomClient.stop();$('practice-controls').hidden=false;$('room-panel').hidden=true;$('practice-mode').setAttribute('aria-pressed','true');$('online-mode').setAttribute('aria-pressed','false');document.querySelector('.play-layout').hidden=false;}
function showOnline(){if(timer)clearTimeout(timer);timer=null;online=true;auto=false;networkBusy=false;selectedTileId=null;updateAuto();$('practice-controls').hidden=true;$('room-panel').hidden=false;$('practice-mode').setAttribute('aria-pressed','false');$('online-mode').setAttribute('aria-pressed','true');document.querySelector('.play-layout').hidden=!remote?.state;$('resume-room').hidden=!roomClient.saved()?.code;$('practice-info').textContent='같은 방 코드로 네 명이 모이면 시작합니다. 각자 손패만 볼 수 있습니다.';}
function receiveRoom(snapshot){
 if(!online)return;remote=snapshot;networkBusy=false;$('room-info').hidden=false;$('room-code').textContent=snapshot.code;$('room-code-input').value=snapshot.code;$('room-error').textContent='';$('room-members').replaceChildren();
 for(let i=0;i<4;i++){const member=snapshot.members[i],el=node('div',member?`${member.name}${member.id===snapshot.me?' (나)':''}${member.seat===null?'':` · ${SEAT_NAMES[member.seat]}`}`:'입장 대기 중',`room-member${member?.id===snapshot.me?' is-me':''}`);$('room-members').append(el);}
 $('room-message').textContent=snapshot.state?snapshot.state.end?'국이 끝났습니다. 방장이 새 국을 시작할 수 있습니다.':`제${snapshot.gameNumber}국 · 내 자리 ${SEAT_NAMES[snapshot.seat]}`:`${snapshot.members.length}/4명 입장 · 방 코드를 친구에게 알려 주세요.`;
 $('rematch-room').hidden=!(snapshot.host&&snapshot.state?.end);document.querySelector('.play-layout').hidden=!snapshot.state;
 if(snapshot.state){state=snapshot.state;humanSeat=snapshot.seat;$('practice-info').textContent=`4인 대국 · 방 ${snapshot.code} · 나는 ${SEAT_NAMES[humanSeat]}. 패를 선택한 뒤 다시 누르거나 버리기로 확정하세요.`;render();}
}
async function connectRoom(join){showOnline();$('room-error').textContent='';for(const id of ['create-room','join-room'])$(id).disabled=true;try{return await roomClient.connect($('room-name').value,join?$('room-code-input').value.trim().toUpperCase():undefined);}finally{for(const id of ['create-room','join-room'])$(id).disabled=false;}}
function roomError(error){$('room-error').textContent=error.message;}
$('practice-mode').onclick=randomGame;
$('online-mode').onclick=async()=>{showOnline();if(roomClient.saved()?.code)try{await roomClient.resume();}catch(e){roomError(e);}};
$('create-room').onclick=()=>connectRoom(false).catch(roomError);$('join-room').onclick=()=>connectRoom(true).catch(roomError);
$('resume-room').onclick=()=>{showOnline();roomClient.resume().catch(roomError);};
$('rematch-room').onclick=()=>roomClient.rematch().catch(roomError);
$('copy-room-link').onclick=async()=>{if(!remote)return;const url=new URL(location.href);url.hash='room='+remote.code;try{await navigator.clipboard.writeText(url.href);$('room-message').textContent='초대 링크를 복사했습니다. 친구에게 보내 주세요.';}catch{$('room-message').textContent=`친구에게 방 코드 ${remote.code}를 알려 주세요.`;}};
function download(){const blob=new Blob([JSON.stringify({game:state,humanSeat,policy:$('policy').value,profile:$('profile').value},null,2)],{type:'application/json'}),a=node('a');a.href=URL.createObjectURL(blob);a.download=`H-${state.seed}-${SEAT_NAMES[humanSeat]}-패보.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function randomGame(){return start(crypto.getRandomValues(new Uint32Array(1))[0]);}
$('random-game').onclick=randomGame;$('new-game').onclick=()=>{try{start(Number($('seed').value));}catch(e){$('error').textContent=e.message;}};$('autoplay').onclick=()=>{auto=!auto;selectedTileId=null;updateAuto();render();schedule();};$('export').onclick=download;
randomGame();
const invitedRoom=/^#room=([A-Z2-9]{8})$/.exec(location.hash);if(invitedRoom){showOnline();$('room-code-input').value=invitedRoom[1];if(roomClient.saved()?.code===invitedRoom[1])roomClient.resume().catch(roomError);}
else if(roomClient.saved()?.code){showOnline();roomClient.resume().catch(roomError);}
fetch(new URL('../results/baseline/analysis.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{const primary=data.pairedDifferences.find(x=>x.comparison==='C-B');$('conclusion').textContent=`이 시나리오에서 C는 B보다 국당 ${Math.abs(primary.meanDifference).toFixed(2)}점 ${primary.meanDifference<0?'낮았습니다':'높았습니다'}. 평균 1위 ${data.conclusion.bestMeanPolicy}; 전체 후보에 대한 확정 우위는 ${data.conclusion.dominatesAllWithBonferroniIntervals?'확인됨':'확인되지 않음'}.`;
 const reverse=data.profilePairs.filter(r=>r.comparison==='C-B'&&r.ci95Low>0);if(reverse.length)$('conclusion').textContent+=' 상대별 예외: '+reverse.map(r=>`${r.profile} C−B +${r.meanDifference.toFixed(2)}점`).join(', ')+'.';
 for(const r of data.summary){const tr=node('tr',undefined,r.policy===data.conclusion.bestMeanPolicy?'best':'');for(const value of [`${r.policy} · ${POLICIES[r.policy].name}`,r.meanNet.toFixed(2)+'점',`${r.ci95Low.toFixed(2)} ~ ${r.ci95High.toFixed(2)}`,(r.winRate*100).toFixed(1)+'%'])tr.append(node('td',value));$('summary').append(tr);}}).catch(()=>{$('conclusion').textContent='완료된 결과 파일이 없습니다. headless 실험 후 보고서를 생성하면 여기에 표시됩니다.';});
function readGame(){if(online&&!remote?.state)return {mode:'online',phase:'waiting',room:remote?{code:remote.code,members:remote.members}:null,legalActions:[],recommendations:[]};return ({mode:online?'online':'practice',room:online&&remote?{code:remote.code,members:remote.members,gameNumber:remote.gameNumber}:null,seat:humanSeat,phase:online&&!remote?.state?'waiting':state.phase,turn:actor(state),ownHand:state.players[humanSeat].hand.map(typeOf),drawnTile:handDisplay(state,humanSeat).drawn===null?null:typeOf(handDisplay(state,humanSeat).drawn),scores:state.players.map(p=>p.score),winners:[...state.winners],legalActions:actor(state)===humanSeat?legalActions(state):[],recommendationRevision,recommendations:structuredClone(currentRecommendations)});}
// Optional agent-facing entry points share the UI's exact actions.
if(document.modelContext?.registerTool){const life=new AbortController();window.addEventListener('pagehide',()=>life.abort(),{once:true});for(const tool of [
 {name:'create_h_room',title:'4인 대국 방 만들기',description:'내 이름으로 새 온라인 방을 만듭니다. 네 명이 모이면 시작합니다.',inputSchema:{type:'object',properties:{name:{type:'string',minLength:1,maxLength:20}},required:['name'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async({name})=>{$('room-name').value=name;const room=await connectRoom(false);return {code:room.code,members:room.members};}},
 {name:'join_h_room',title:'4인 대국 방 입장',description:'알고 있는 방 코드와 내 이름으로 온라인 대국에 입장합니다.',inputSchema:{type:'object',properties:{name:{type:'string',minLength:1,maxLength:20},code:{type:'string',pattern:'^[A-Z2-9]{8}$'}},required:['name','code'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async({name,code})=>{$('room-name').value=name;$('room-code-input').value=code;const room=await connectRoom(true);return {code:room.code,members:room.members,seat:room.seat};}},
 {name:'start_h_game',title:'H룰 새 국',description:'지정한 배패 번호로 새 국을 시작합니다. 같은 번호는 내 자리도 동일하게 재현합니다.',inputSchema:{type:'object',properties:{seed:{type:'integer',minimum:0,maximum:4294967295}},required:['seed'],additionalProperties:false},annotations:{readOnlyHint:false},execute:({seed})=>start(seed)},
 {name:'read_h_game',title:'H룰 공개 상태',description:'내 자리·손패, 공개 대국 상태, 합법 행동과 화면의 전략별 추천을 확인합니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:readGame},
 {name:'play_h_recommendation',title:'전략 추천 한 번 실행',description:'내 수동 선택 차례에 화면의 전략 추천 버튼을 한 번 실행합니다. read_h_game에서 받은 최신 recommendationRevision을 revision으로 전달하세요. mode=discard는 깡 대신 표시된 버림패 대안을 선택합니다.',inputSchema:{type:'object',properties:{policy:{type:'string',enum:['A','B','C','D','E']},mode:{type:'string',enum:['recommended','discard']},revision:{type:'integer',minimum:0}},required:['policy','mode','revision'],additionalProperties:false},annotations:{readOnlyHint:false},execute:({policy,mode,revision})=>executeRecommendation(policy,mode,revision)}
 ])Promise.resolve(document.modelContext.registerTool(tool,{signal:life.signal})).catch(()=>{});}
