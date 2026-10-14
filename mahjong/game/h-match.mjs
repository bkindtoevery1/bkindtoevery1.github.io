import {createGame,assertInvariants} from '../engine/game.mjs';
import {ruleset} from '../engine/rules.mjs';
import {roundLabel,roundSeed} from '../s-engine/match.mjs';

// H half-games cover East 1 through South 4. New Japanese rules repeat
// when the dealer wins at any PK position; saved older matches keep rotation.
const SETTINGS=Object.freeze({dealerContinuation:'none',honbaPoints:0,finalPot:'none',endOnBankrupt:false});
const sum=xs=>xs.reduce((n,x)=>n+x,0),clone=x=>structuredClone(x);
const label=match=>match.format==='single'?'단판전':roundLabel(match.roundIndex,match.repeat);
export function createMatch({seed=1,id=crypto.randomUUID(),format='single',rules={},settings={},now=new Date().toISOString()}={}){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||typeof id!=='string'||!id)throw new Error('Invalid match seed/id');
 if(!['single','hanchan'].includes(format))throw new Error('단판전 또는 반장전을 선택하세요.');
 if(Object.entries(settings).some(([key,value])=>!Object.hasOwn(SETTINGS,key)||(key==='dealerContinuation'?!['none','win'].includes(value):SETTINGS[key]!==value)))throw new Error('Unsupported H match settings');
 const r=ruleset({...rules,roundWind:27}),config={...SETTINGS,dealerContinuation:r.id==='H-2026-jp-20261014'?'win':'none',...settings};
 return {version:1,variant:'H',format,id,seed,startedAt:now,rules:r,settings:config,roundIndex:0,repeat:0,handNumber:1,status:'playing',scores:[0,0,0,0],pot:0,rounds:[],next:null,finalTransfers:[]};
}
export function createMatchGame(match){
 if(match.status!=='playing')throw new Error('대국이 다음 국을 시작할 상태가 아닙니다.');
 const game=createGame({seed:roundSeed(match.seed,match.handNumber),dealer:match.roundIndex%4,rules:{...match.rules,roundWind:match.roundIndex<4?27:28}});
 game.startingScores=[...match.scores];game.matchContext={id:match.id,handNumber:match.handNumber,roundIndex:match.roundIndex,repeat:match.repeat};return game;
}
export function recordRound(match,game,{logId=null}={}){
 if(game.matchContext?.id!==match.id||game.matchContext.handNumber!==match.handNumber)throw new Error('다른 대국 또는 국의 정산입니다.');
 if(match.status!=='playing')return false;
 if(!game.end)throw new Error('국이 끝난 뒤 정산할 수 있습니다.');assertMatch(match,game);
 const delta=game.players.map(p=>p.score);match.scores=match.scores.map((n,i)=>n+delta[i]);
 const retained=match.format!=='single'&&match.settings.dealerContinuation==='win'&&game.winners.includes(game.dealer);
 match.rounds.push({handNumber:match.handNumber,roundIndex:match.roundIndex,repeat:match.repeat,label:label(match),dealer:game.dealer,seed:game.seed,result:game.end,winner:game.winners[0]??null,winners:[...game.winners],delta,totals:[...match.scores],pot:0,retained,logId});
 if(match.format==='single'||match.roundIndex===7&&!retained){match.status='complete';match.next=null;}
 else{match.status='between-rounds';match.next={roundIndex:match.roundIndex+(retained?0:1),repeat:retained?match.repeat+1:0};}
 assertMatch(match,game);return true;
}
export function advanceMatch(match,expectedHandNumber=match.handNumber){
 if(match.status!=='between-rounds'||!match.next||expectedHandNumber!==match.handNumber)throw new Error('현재 국이 끝난 뒤 다음 국으로 진행하세요.');
 match.roundIndex=match.next.roundIndex;match.repeat=match.next.repeat;match.handNumber++;match.next=null;match.status='playing';return createMatchGame(match);
}
export function matchTotals(match,game){return match.status==='playing'?match.scores.map((n,i)=>n+game.players[i].score):[...match.scores];}
export function matchSummary(match,game){
 const totals=matchTotals(match,game),rankings=totals.map((points,seat)=>({seat,points,rank:1+totals.filter(n=>n>points).length})).sort((a,b)=>b.points-a.points||a.seat-b.seat);
 return {id:match.id,variant:'H',format:match.format,startedAt:match.startedAt,roundIndex:match.roundIndex,repeat:match.repeat,handNumber:match.handNumber,label:label(match),status:match.status,totals,pot:0,nextLabel:match.next?roundLabel(match.next.roundIndex,match.next.repeat):null,settings:clone(match.settings),startingPoints:0,rankings,rounds:match.rounds.map(({seed,logId,...row})=>clone(row)),finalTransfers:[]};
}
export function assertMatch(match,game){
 if(match.version!==1||match.variant!=='H'||!['single','hanchan'].includes(match.format)||!['playing','between-rounds','complete'].includes(match.status)||!Number.isInteger(match.roundIndex)||match.roundIndex<0||match.roundIndex>7||!Number.isInteger(match.handNumber)||match.handNumber<match.roundIndex+1||!Number.isInteger(match.repeat)||match.repeat<0||!['none','win'].includes(match.settings.dealerContinuation)||match.settings.dealerContinuation==='none'&&(match.handNumber!==match.roundIndex+1||match.repeat!==0)||match.format==='single'&&(match.roundIndex!==0||match.repeat!==0||match.handNumber!==1||match.status==='between-rounds'))throw new Error('Invalid H match progress');
 if(!Array.isArray(match.scores)||match.scores.length!==4||match.scores.some(n=>!Number.isSafeInteger(n))||sum(match.scores)!==0||match.pot!==0||match.finalTransfers.length)throw new Error('Match score conservation violated');
 if(game.rules.variant==='S'||game.matchContext?.id!==match.id||game.matchContext.handNumber!==match.handNumber||game.matchContext.roundIndex!==match.roundIndex||game.matchContext.repeat!==match.repeat||game.dealer!==match.roundIndex%4||game.rules.roundWind!==(match.roundIndex<4?27:28))throw new Error('Match round mismatch');
 if(!Array.isArray(game.startingScores)||game.startingScores.length!==4||game.startingScores.some(n=>!Number.isSafeInteger(n)))throw new Error('Missing match starting balances');
 if(game.startingScores.some((n,i)=>n+(match.status==='playing'?0:game.players[i].score)!==match.scores[i]))throw new Error('Match carried balances mismatch');
 if(match.status!=='playing'&&!game.end)throw new Error('Unfinished round cannot be settled');
 if(match.rounds.length!==match.handNumber-(match.status==='playing'?1:0))throw new Error('Duplicate or missing round result');
 assertInvariants(game);if(sum(matchTotals(match,game))!==0)throw new Error('Live match score conservation violated');return true;
}
