import {typeOf,counts} from '../engine/tiles.mjs';
import {doraAfter} from '../s-engine/score.mjs';
import {indicators,revealedUraIndicators} from '../s-engine/game.mjs';

export const signedPoints = value => `${value > 0 ? '+' : ''}${value}`;

// Derive presentation from the recorded score, including old room logs that
// have itemized entries but do not have separate subtotal fields.
export function scoreBreakdown(score){
 if(score?.variant!=='S')return null;
 const yaku=(score.yakuEntries??[]).map(e=>({...e})),bonuses=score.yakuman?[]:(score.bonuses??[]).map(e=>({...e}));
 const yakuHan=score.hanYaku??yaku.reduce((n,e)=>n+e.han,0),bonusHan=score.bonusHan??bonuses.reduce((n,e)=>n+e.han,0);
 return {yaku,bonuses,yakuHan,bonusHan,totalHan:score.yakuman?null:score.han,yakuman:score.yakuman,
  summary:score.yakuman?'역만':`역 ${yakuHan}판 + 가산 ${bonusHan}판 = 총 ${score.han}판`};
}
export function scoreBreakdownText(score){
 const detail=scoreBreakdown(score);if(!detail)return '';
 return detail.yakuman?`${detail.yaku.map(e=>e.name).join(' · ')} · 역만`:`${[...detail.yaku,...detail.bonuses].map(e=>`${e.name} ${e.han}판`).join(' + ')} = 총 ${detail.totalHan}판`;
}
export function doraDisplay(state,seat){
 if(state.rules.variant!=='S')return null;
 const player=state.players[seat],visible=state.doraIndicators??(Array.isArray(state.dead)?indicators(state):[]);
 const ura=state.uraIndicators??(Array.isArray(state.dead)?revealedUraIndicators(state):[]);
 const c=counts([...player.hand,...player.melds.flatMap(m=>m.ids)].map(typeOf));
 const pairs=values=>values.map(indicator=>({indicator,dora:doraAfter(indicator)}));
 // A ron tile remains in the discarder river, and is not sent as win.tile in
 // room snapshots. Use the final score for the winner's complete hand count.
 const bonus=id=>player.win?.score.bonuses?.find(e=>e.id===id)?.han??0;
 return {visible:pairs(visible),ura:pairs(ura),count:player.won?bonus('dora'):visible.reduce((n,t)=>n+c[doraAfter(t)],0),
  uraCount:ura.length&&player.won?bonus('ura'):null};
}

// A player wins at most once. The win order fixes the number of players who
// still owed a tsumo payment then, even after later players finish their hands.
// This uses only public fields shared by solo games and room snapshots.
export function winSettlement(state, seat) {
  const player = state.players[seat], win = player.win;
  if (!win) return null;
  const {score} = win;
  if(state.rules.variant==='S'){
    const payments=Array.isArray(state.ledger)?state.ledger.filter(p=>p.to===seat&&['tsumo','ron','pot'].includes(p.kind)):win.payments??[];
    const receipt=payments.reduce((n,p)=>n+p.amount,0),seats=Array.from({length:4},(_,i)=>['동','남','서','북'][(i-state.dealer+4)%4]);
    return {payerCount:payments.filter(p=>p.from!=='pot').length,receipt,expectedReceipt:win.receipt,net:player.score,previousNet:player.score-receipt,
      breakdown:scoreBreakdown(score),hanDetails:scoreBreakdownText(score),
      title:`${score.name} ${win.method==='tsumo'?'쯔모':'론'} · 이번 화료 +${receipt}점`,
      calculation:`${score.yakuman?'역만':score.han+'판'} · ${payments.map(p=>`${seats[p.from]??'공탁'} ${p.amount}`).join(' + ')} = +${receipt}점`};
  }
  const payerCount = win.method === 'tsumo' ? state.players.length - win.order : 1;
  const tsumoBonus = win.method === 'tsumo' ? state.rules.tsumoBonusPerPayer : 0;
  const perPayer = score.total + tsumoBonus, expectedReceipt = perPayer * payerCount;
  // Practice has an actual transfer ledger. Never replace an unexpected real
  // receipt with a recalculated value, which would hide a settlement defect.
  const receipt = Array.isArray(state.ledger)
    ? state.ledger.filter(payment=>payment.to===seat&&payment.kind===win.method).reduce((sum,payment)=>sum+payment.amount,0)
    : expectedReceipt;
  const parts = [`역 ${score.base}`];
  if (score.bonus) parts.push(`가산 ${score.bonus}`);
  if (win.method === 'tsumo') parts.push(`쯔모 ${tsumoBonus}`);
  return {
    payerCount, perPayer, receipt, expectedReceipt,
    net: player.score, previousNet: player.score - receipt,
    title: `${score.name} ${win.method === 'tsumo' ? '쯔모' : '론'} · 이번 화료 +${receipt}점`,
    calculation: `(${parts.join(' + ')}) × ${payerCount}명 = +${expectedReceipt}점${receipt!==expectedReceipt?` · 실제 이체 +${receipt}점 (정산 확인 필요)`:''}`,
  };
}
