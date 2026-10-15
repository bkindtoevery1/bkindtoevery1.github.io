import {isPinfuWin} from './win-label.mjs';

const validSeats=value=>Array.isArray(value)&&value.every(seat=>Number.isInteger(seat)&&seat>=0&&seat<4)&&new Set(value).size===value.length;
const currentGame=(match,game)=>game?.matchContext?.id===match.id&&game.matchContext.handNumber===match.handNumber&&game.matchContext.roundIndex===match.roundIndex&&game.matchContext.repeat===match.repeat;
const noWinners=(match,row)=>Array.isArray(row.winners)?row.winners.length===0:row.winner===null||(match.variant!=='H'&&row.result==='exhaustive-draw');

// Seats identify the same people throughout a match; only the dealer rotates.
export function pinfuWinners(game){
 return (game?.players??[]).flatMap((player,seat)=>player.won&&isPinfuWin(player.win?.score)?[seat]:[]);
}

// A settled old current hand still has its full win records. Persist this small
// addition before advancing, without running settlement or changing any scores.
export function backfillCurrentPinfu(match,game){
 if(match.status==='playing'||!game?.end||!currentGame(match,game))return false;
 const row=match.rounds.find(row=>row.handNumber===match.handNumber);
 if(!row||Object.hasOwn(row,'pinfuWinners'))return false;
 row.pinfuWinners=pinfuWinners(game);return true;
}

export function pinfuSummary(match,game){
 const counts=[0,0,0,0];let unknownHands=0;
 const add=seats=>{for(const seat of seats)counts[seat]++;};
 if(!match){add(pinfuWinners(game));return {counts,unknownHands};}
 for(const row of match.rounds){
  if(validSeats(row.pinfuWinners))add(row.pinfuWinners);
  else if(row.handNumber===match.handNumber&&game?.end&&currentGame(match,game))add(pinfuWinners(game));
  // H can reach an exhaustive draw after one or two wins. Its result label
  // alone does not prove that the hand had no pinfu winner.
  else if(!noWinners(match,row))unknownHands++;
 }
 if(match.status==='playing'){
  if(currentGame(match,game))add(pinfuWinners(game));else unknownHands++;
 }
 return {counts,unknownHands};
}
