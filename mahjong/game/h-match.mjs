import {createGame,assertInvariants} from '../engine/game.mjs';
import {ruleset} from '../engine/rules.mjs';
import {roundLabel,roundSeed} from '../s-engine/match.mjs';

// H half-games are an app match format: eight independent H hands. Only the
// dealer, round wind and accumulated net scores carry between hands.
const SETTINGS=Object.freeze({dealerContinuation:'none',honbaPoints:0,finalPot:'none',endOnBankrupt:false});
const sum=xs=>xs.reduce((n,x)=>n+x,0),clone=x=>structuredClone(x);
const label=match=>match.format==='single'?'단판전':roundLabel(match.roundIndex);
export function createMatch({seed=1,id=crypto.randomUUID(),format='single',rules={},settings={},now=new Date().toISOString()}={}){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||typeof id!=='string'||!id)throw new Error('Invalid match seed/id');
 if(!['single','hanchan'].includes(format))throw new Error('단판전 또는 반장전을 선택하세요.');
 if(Object.entries(settings).some(([key,value])=>!Object.hasOwn(SETTINGS,key)||SETTINGS[key]!==value))throw new Error('Unsupported H match settings');
 return {version:1,variant:'H',format,id,seed,startedAt:now,rules:ruleset({...rules,roundWind:27}),settings:{...SETTINGS},roundIndex:0,repeat:0,handNumber:1,status:'playing',scores:[0,0,0,0],pot:0,rounds:[],next:null,finalTransfers:[]};
}
export function createMatchGame(match){
 if(match.status!=='playing')throw new Error('대국이 다음 국을 시작할 상태가 아닙니다.');
 const game=createGame({seed:roundSeed(match.seed,match.handNumber),dealer:match.roundIndex%4,rules:{...match.rules,roundWind:match.roundIndex<4?27:28}});
 game.startingScores=[...match.scores];game.matchContext={id:match.id,handNumber:match.handNumber,roundIndex:match.roundIndex,repeat:0};return game;
}
export function recordRound(match,game,{logId=null}={}){
 if(game.matchContext?.id!==match.id||game.matchContext.handNumber!==match.handNumber)throw new Error('다른 대국 또는 국의 정산입니다.');
 if(match.status!=='playing')return false;
 if(!game.end)throw new Error('국이 끝난 뒤 정산할 수 있습니다.');assertMatch(match,game);
 const delta=game.players.map(p=>p.score);match.scores=match.scores.map((n,i)=>n+delta[i]);
 match.rounds.push({handNumber:match.handNumber,roundIndex:match.roundIndex,repeat:0,label:label(match),dealer:game.dealer,seed:game.seed,result:game.end,winner:game.winners[0]??null,winners:[...game.winners],delta,totals:[...match.scores],pot:0,retained:false,logId});
 if(match.format==='single'||match.roundIndex===7){match.status='complete';match.next=null;}
 else{match.status='between-rounds';match.next={roundIndex:match.roundIndex+1,repeat:0};}
 assertMatch(match,game);return true;
}
export function advanceMatch(match,expectedHandNumber=match.handNumber){
 if(match.status!=='between-rounds'||!match.next||expectedHandNumber!==match.handNumber)throw new Error('현재 국이 끝난 뒤 다음 국으로 진행하세요.');
 match.roundIndex=match.next.roundIndex;match.handNumber++;match.next=null;match.status='playing';return createMatchGame(match);
}
export function matchTotals(match,game){return match.status==='playing'?match.scores.map((n,i)=>n+game.players[i].score):[...match.scores];}
export function matchSummary(match,game){
 const totals=matchTotals(match,game),rankings=totals.map((points,seat)=>({seat,points,rank:1+totals.filter(n=>n>points).length})).sort((a,b)=>b.points-a.points||a.seat-b.seat);
 return {id:match.id,variant:'H',format:match.format,startedAt:match.startedAt,roundIndex:match.roundIndex,repeat:0,handNumber:match.handNumber,label:label(match),status:match.status,totals,pot:0,nextLabel:match.next?roundLabel(match.next.roundIndex):null,settings:clone(match.settings),startingPoints:0,rankings,rounds:match.rounds.map(({seed,logId,...row})=>clone(row)),finalTransfers:[]};
}
export function assertMatch(match,game){
 if(match.version!==1||match.variant!=='H'||!['single','hanchan'].includes(match.format)||!['playing','between-rounds','complete'].includes(match.status)||!Number.isInteger(match.roundIndex)||match.roundIndex<0||match.roundIndex>7||match.handNumber!==match.roundIndex+1||match.repeat!==0||match.format==='single'&&(match.roundIndex!==0||match.status==='between-rounds'))throw new Error('Invalid H match progress');
 if(!Array.isArray(match.scores)||match.scores.length!==4||match.scores.some(n=>!Number.isSafeInteger(n))||sum(match.scores)!==0||match.pot!==0||match.finalTransfers.length)throw new Error('Match score conservation violated');
 if(game.rules.variant==='S'||game.matchContext?.id!==match.id||game.matchContext.handNumber!==match.handNumber||game.matchContext.roundIndex!==match.roundIndex||game.matchContext.repeat!==0||game.dealer!==match.roundIndex%4||game.rules.roundWind!==(match.roundIndex<4?27:28))throw new Error('Match round mismatch');
 if(!Array.isArray(game.startingScores)||game.startingScores.length!==4||game.startingScores.some(n=>!Number.isSafeInteger(n)))throw new Error('Missing match starting balances');
 if(game.startingScores.some((n,i)=>n+(match.status==='playing'?0:game.players[i].score)!==match.scores[i]))throw new Error('Match carried balances mismatch');
 if(match.status!=='playing'&&!game.end)throw new Error('Unfinished round cannot be settled');
 if(match.rounds.length!==match.handNumber-(match.status==='playing'?1:0))throw new Error('Duplicate or missing round result');
 assertInvariants(game);if(sum(matchTotals(match,game))!==0)throw new Error('Live match score conservation violated');return true;
}
