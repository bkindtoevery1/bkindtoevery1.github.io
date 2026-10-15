import {createGame,assertInvariants} from '../engine/game.mjs';
import {ruleset} from '../engine/rules.mjs';
import {roundLabel,roundSeed} from '../s-engine/match.mjs';
import {pinfuWinners,pinfuSummary,backfillCurrentPinfu} from './pinfu-count.mjs';

// H half-games cover East 1 through South 4. The current operational reading
// uses the first win event, including every winner of its simultaneous ron.
// The source does not explicitly specify a PK win-order condition.
const SETTINGS=Object.freeze({dealerContinuation:'none',honbaPoints:0,finalPot:'none',endOnBankrupt:false});
const CONTINUATIONS=['none','win','first-win'];
const sum=xs=>xs.reduce((n,x)=>n+x,0),clone=x=>structuredClone(x);
const label=match=>match.format==='single'?'단판전':roundLabel(match.roundIndex,match.repeat);
function firstWinIncludesDealer(game){
 const firstSeat=game.winners[0];
 if(firstSeat===undefined||!game.winners.includes(game.dealer))return false;
 if(firstSeat===game.dealer)return true;
 const win=seat=>game.events?.find(event=>event.type==='win'&&event.seat===seat)??game.players[seat]?.win;
 const first=win(firstSeat),dealer=win(game.dealer);
 // A minkan rinshan can have payment.method='ron', but its actual win event
 // remains a single tsumo. Payment responsibility never identifies a ron group.
 if(first?.method==='tsumo'||dealer?.method==='tsumo')return false;
 const complete=record=>record?.method==='ron'&&Number.isInteger(record.source)&&Number.isInteger(record.tile)&&Number.isInteger(record.drawNumber);
 if(!complete(first)||!complete(dealer))throw new Error('첫 화료 사건을 확인할 원본 화료 기록이 없습니다.');
 return first.source===dealer.source&&first.tile===dealer.tile&&first.drawNumber===dealer.drawNumber;
}
const retainsDealer=(match,game,mode=match.settings.dealerContinuation)=>match.format!=='single'&&
 (mode==='win'?game.winners.includes(game.dealer):mode==='first-win'&&firstWinIncludesDealer(game));
function setNextRound(match,retained){
 if(match.format==='single'||match.roundIndex===7&&!retained){match.status='complete';match.next=null;}
 else{match.status='between-rounds';match.next={roundIndex:match.roundIndex+(retained?0:1),repeat:retained?match.repeat+1:0};}
}
export function createMatch({seed=1,id=crypto.randomUUID(),format='single',rules={},settings={},now=new Date().toISOString()}={}){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff||typeof id!=='string'||!id)throw new Error('Invalid match seed/id');
 if(!['single','hanchan'].includes(format))throw new Error('단판전 또는 반장전을 선택하세요.');
 if(Object.entries(settings).some(([key,value])=>!Object.hasOwn(SETTINGS,key)||(key==='dealerContinuation'?!CONTINUATIONS.includes(value):SETTINGS[key]!==value)))throw new Error('Unsupported H match settings');
 const r=ruleset({...rules,roundWind:27}),config={...SETTINGS,dealerContinuation:r.id==='H-2026-jp-20261014'?'first-win':'none',...settings};
 return {version:1,variant:'H',format,id,seed,startedAt:now,rules:r,settings:config,roundIndex:0,repeat:0,handNumber:1,status:'playing',scores:[0,0,0,0],pot:0,rounds:[],next:null,finalTransfers:[]};
}
export function createMatchGame(match){
 if(match.status!=='playing')throw new Error('대국이 다음 국을 시작할 상태가 아닙니다.');
 const game=createGame({seed:roundSeed(match.seed,match.handNumber),dealer:match.roundIndex%4,rules:{...match.rules,roundWind:match.roundIndex<4?27:28}});
 game.startingScores=[...match.scores];game.matchContext={id:match.id,handNumber:match.handNumber,roundIndex:match.roundIndex,repeat:match.repeat};return game;
}
export function upgradeDealerContinuation(match,game){
 if(match?.variant!=='H'||match.rules?.id!=='H-2026-jp-20261014'||match.settings?.dealerContinuation!=='win'||match.status==='complete')return false;
 assertMatch(match,game);
 const between=match.status==='between-rounds',row=between?match.rounds.at(-1):null;
 if(between&&row.handNumber!==match.handNumber)throw new Error('현재 국의 정산 기록이 맞지 않습니다.');
 // Compute before mutating: incomplete public-only logs cannot safely recover
 // simultaneous ron and must not partially migrate a saved match.
 const retained=between?retainsDealer(match,game,'first-win'):false;
 match.settings={...match.settings,dealerContinuation:'first-win'};
 if(between){row.retained=retained;setNextRound(match,retained);}
 assertMatch(match,game);return true;
}
export function recordRound(match,game,{logId=null}={}){
 if(game.matchContext?.id!==match.id||game.matchContext.handNumber!==match.handNumber)throw new Error('다른 대국 또는 국의 정산입니다.');
 if(match.status==='playing'&&!game.end)throw new Error('국이 끝난 뒤 정산할 수 있습니다.');
 upgradeDealerContinuation(match,game);
 if(match.status!=='playing'){backfillCurrentPinfu(match,game);return false;}
 assertMatch(match,game);
 const retained=retainsDealer(match,game);
 const delta=game.players.map(p=>p.score);match.scores=match.scores.map((n,i)=>n+delta[i]);
 match.rounds.push({handNumber:match.handNumber,roundIndex:match.roundIndex,repeat:match.repeat,label:label(match),dealer:game.dealer,seed:game.seed,result:game.end,winner:game.winners[0]??null,winners:[...game.winners],pinfuWinners:pinfuWinners(game),delta,totals:[...match.scores],pot:0,retained,logId});
 setNextRound(match,retained);
 assertMatch(match,game);return true;
}
export function advanceMatch(match,expectedHandNumber=match.handNumber){
 if(match.status!=='between-rounds'||!match.next||expectedHandNumber!==match.handNumber)throw new Error('현재 국이 끝난 뒤 다음 국으로 진행하세요.');
 match.roundIndex=match.next.roundIndex;match.repeat=match.next.repeat;match.handNumber++;match.next=null;match.status='playing';return createMatchGame(match);
}
export function matchTotals(match,game){return match.status==='playing'?match.scores.map((n,i)=>n+game.players[i].score):[...match.scores];}
export function matchSummary(match,game){
 const totals=matchTotals(match,game),rankings=totals.map((points,seat)=>({seat,points,rank:1+totals.filter(n=>n>points).length})).sort((a,b)=>b.points-a.points||a.seat-b.seat);
 return {id:match.id,variant:'H',format:match.format,startedAt:match.startedAt,roundIndex:match.roundIndex,repeat:match.repeat,handNumber:match.handNumber,label:label(match),status:match.status,totals,pot:0,nextLabel:match.next?roundLabel(match.next.roundIndex,match.next.repeat):null,settings:clone(match.settings),startingPoints:0,rankings,pinfu:pinfuSummary(match,game),rounds:match.rounds.map(({seed,logId,...row})=>clone(row)),finalTransfers:[]};
}
export function assertMatch(match,game){
 if(match.version!==1||match.variant!=='H'||!['single','hanchan'].includes(match.format)||!['playing','between-rounds','complete'].includes(match.status)||!Number.isInteger(match.roundIndex)||match.roundIndex<0||match.roundIndex>7||!Number.isInteger(match.handNumber)||match.handNumber<match.roundIndex+1||!Number.isInteger(match.repeat)||match.repeat<0||!CONTINUATIONS.includes(match.settings.dealerContinuation)||match.settings.dealerContinuation==='none'&&(match.handNumber!==match.roundIndex+1||match.repeat!==0)||match.format==='single'&&(match.roundIndex!==0||match.repeat!==0||match.handNumber!==1||match.status==='between-rounds'))throw new Error('Invalid H match progress');
 if(!Array.isArray(match.scores)||match.scores.length!==4||match.scores.some(n=>!Number.isSafeInteger(n))||sum(match.scores)!==0||match.pot!==0||match.finalTransfers.length)throw new Error('Match score conservation violated');
 if(game.rules.variant==='S'||game.matchContext?.id!==match.id||game.matchContext.handNumber!==match.handNumber||game.matchContext.roundIndex!==match.roundIndex||game.matchContext.repeat!==match.repeat||game.dealer!==match.roundIndex%4||game.rules.roundWind!==(match.roundIndex<4?27:28))throw new Error('Match round mismatch');
 if(!Array.isArray(game.startingScores)||game.startingScores.length!==4||game.startingScores.some(n=>!Number.isSafeInteger(n)))throw new Error('Missing match starting balances');
 if(game.startingScores.some((n,i)=>n+(match.status==='playing'?0:game.players[i].score)!==match.scores[i]))throw new Error('Match carried balances mismatch');
 if(match.status!=='playing'&&!game.end)throw new Error('Unfinished round cannot be settled');
 if(match.rounds.length!==match.handNumber-(match.status==='playing'?1:0))throw new Error('Duplicate or missing round result');
 assertInvariants(game);if(sum(matchTotals(match,game))!==0)throw new Error('Live match score conservation violated');return true;
}
