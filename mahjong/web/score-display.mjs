export const signedPoints = value => `${value > 0 ? '+' : ''}${value}`;

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
