import {createGame,assertInvariants} from './game.mjs';
import {sRules} from './rules.mjs';

export const MATCH_DEFAULTS=Object.freeze({dealerContinuation:'win-or-tenpai',honbaPoints:0,finalPot:'top',endOnBankrupt:false});
const clone=x=>structuredClone(x),sum=xs=>xs.reduce((a,b)=>a+b,0);
export function roundLabel(roundIndex,repeat=0){return `${roundIndex<4?'동':'남'}${roundIndex%4+1}국${repeat?' · 연장 '+repeat+'회':''}`;}
export function roundSeed(seed,number){if(number===1)return seed;let n=(seed^Math.imul(number,0x9e3779b9))>>>0;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return (n^(n>>>15))>>>0;}
export function createMatch({seed=1,id=crypto.randomUUID(),rules={},settings={},now=new Date().toISOString()}={}){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||typeof id!=='string'||!id)throw new Error('Invalid match seed/id');
 for(const k of Object.keys(settings))if(!(k in MATCH_DEFAULTS))throw new Error('Unknown match setting');
 const config={...MATCH_DEFAULTS,...settings};if(!['none','win-or-tenpai'].includes(config.dealerContinuation)||config.honbaPoints!==0||config.finalPot!=='top'||config.endOnBankrupt!==false)throw new Error('Unsupported match settings');
 const r=sRules({...rules,roundWind:27});
 return {version:1,id,seed,startedAt:now,rules:r,settings:config,roundIndex:0,repeat:0,handNumber:1,status:'playing',scores:Array(4).fill(r.startingPoints),pot:0,rounds:[],next:null,finalTransfers:[]};
}
export function createMatchGame(match){
 if(match.status!=='playing')throw new Error('반장이 다음 국을 시작할 상태가 아닙니다.');
 const game=createGame({seed:roundSeed(match.seed,match.handNumber),rules:{...match.rules,roundWind:match.roundIndex<4?27:28},dealer:match.roundIndex%4,pot:match.pot,startingScores:match.scores});
 game.matchContext={id:match.id,handNumber:match.handNumber,roundIndex:match.roundIndex,repeat:match.repeat};return game;
}
export function recordRound(match,game,{logId=null}={}){
 if(game.matchContext?.id!==match.id||game.matchContext.handNumber!==match.handNumber)throw new Error('다른 반장 또는 국의 정산입니다.');
 if(match.status!=='playing')return false; // Idempotent across reload/poll/repeated clicks.
 if(!game.end)throw new Error('국이 끝난 뒤 정산할 수 있습니다.');assertMatch(match,game);
 const delta=game.players.map(p=>p.score);match.scores=match.scores.map((n,i)=>n+delta[i]);match.pot=game.pot;
 const dealerReady=game.events.find(e=>e.type==='drawSettlement')?.ready.some(r=>r.seat===game.dealer)??false;
 const retained=match.settings.dealerContinuation==='win-or-tenpai'&&(game.winners.includes(game.dealer)||game.end==='exhaustive-draw'&&dealerReady);
 match.rounds.push({handNumber:match.handNumber,roundIndex:match.roundIndex,repeat:match.repeat,label:roundLabel(match.roundIndex,match.repeat),dealer:game.dealer,seed:game.seed,result:game.end,winner:game.winners[0]??null,delta,totals:[...match.scores],pot:match.pot,retained,logId});
 if(match.roundIndex===7&&!retained){
  match.status='complete';match.next=null;
  if(match.pot){const top=match.scores.reduce((best,n,i)=>n>match.scores[best]?i:best,0);match.finalTransfers.push({from:'pot',to:top,amount:match.pot,kind:'final-pot'});match.scores[top]+=match.pot;match.pot=0;}
 }else{match.status='between-rounds';match.next={roundIndex:match.roundIndex+(retained?0:1),repeat:retained?match.repeat+1:0};}
 assertMatch(match,game);return true;
}
export function advanceMatch(match,expectedHandNumber=match.handNumber){
 if(match.status!=='between-rounds'||!match.next||expectedHandNumber!==match.handNumber)throw new Error('현재 국이 끝난 뒤 다음 국으로 진행하세요.');
 match.roundIndex=match.next.roundIndex;match.repeat=match.next.repeat;match.handNumber++;match.next=null;match.status='playing';return createMatchGame(match);
}
export function matchTotals(match,game){return match.status==='playing'?match.scores.map((n,i)=>n+game.players[i].score):[...match.scores];}
export function matchSummary(match,game){
 const totals=matchTotals(match,game),rankings=totals.map((points,seat)=>({seat,points,rank:1+totals.filter(n=>n>points).length})).sort((a,b)=>b.points-a.points||a.seat-b.seat);
 return {id:match.id,startedAt:match.startedAt,roundIndex:match.roundIndex,repeat:match.repeat,handNumber:match.handNumber,label:roundLabel(match.roundIndex,match.repeat),status:match.status,totals,pot:match.status==='playing'?game.pot:match.pot,
  nextLabel:match.next?roundLabel(match.next.roundIndex,match.next.repeat):null,settings:clone(match.settings),startingPoints:match.rules.startingPoints,rankings,
  rounds:match.rounds.map(({seed,logId,...row})=>clone(row)),finalTransfers:clone(match.finalTransfers)};
}
export function assertMatch(match,game){
 if(match.version!==1||!['playing','between-rounds','complete'].includes(match.status)||!Number.isInteger(match.roundIndex)||match.roundIndex<0||match.roundIndex>7||!Number.isInteger(match.handNumber)||match.handNumber<1||!Number.isInteger(match.repeat)||match.repeat<0)throw new Error('Invalid S match progress');
 if(match.scores.length!==4||match.scores.some(n=>!Number.isSafeInteger(n))||sum(match.scores)+match.pot!==4*match.rules.startingPoints)throw new Error('Match score conservation violated');
 if(!Number.isSafeInteger(match.pot)||match.pot<0||match.pot%1000)throw new Error('Invalid match pot');
 if(game.matchContext?.id!==match.id||game.matchContext.handNumber!==match.handNumber||game.matchContext.roundIndex!==match.roundIndex||game.matchContext.repeat!==match.repeat||game.dealer!==match.roundIndex%4||game.rules.roundWind!==(match.roundIndex<4?27:28))throw new Error('Match round mismatch');
 if(!Array.isArray(game.startingScores)||game.startingScores.length!==4||game.startingScores.some(n=>!Number.isSafeInteger(n)))throw new Error('Missing match starting balances');
 const banked=game.startingScores.map((n,i)=>n+(match.status==='playing'?0:game.players[i].score)+match.finalTransfers.filter(t=>t.to===i).reduce((sum,t)=>sum+t.amount,0));
 if(banked.some((n,i)=>n!==match.scores[i])||match.status==='playing'&&game.initialPot!==match.pot)throw new Error('Match carried balances mismatch');
 if(match.status!=='playing'&&!game.end)throw new Error('Unfinished round cannot be settled');
 if(match.rounds.length!==match.handNumber-(match.status==='playing'?1:0))throw new Error('Duplicate or missing round result');
 assertInvariants(game);
 if(match.status==='playing'&&sum(matchTotals(match,game))+game.pot!==4*match.rules.startingPoints)throw new Error('Live match score conservation violated');
 return true;
}
