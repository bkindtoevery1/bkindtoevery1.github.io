export const signedPoints = value => `${value > 0 ? '+' : ''}${value}`;

// A player wins at most once. The win order fixes the number of players who
// still owed a tsumo payment then, even after later players finish their hands.
// This uses only public fields shared by solo games and room snapshots.
export function winSettlement(state, seat) {
  const player = state.players[seat], win = player.win;
  if (!win) return null;
  const {score} = win;
  const payerCount = win.method === 'tsumo' ? state.players.length - win.order : 1;
  const tsumoBonus = win.method === 'tsumo' ? state.rules.tsumoBonusPerPayer : 0;
  const perPayer = score.total + tsumoBonus, receipt = perPayer * payerCount;
  const parts = [`역 ${score.base}`];
  if (score.bonus) parts.push(`가산 ${score.bonus}`);
  if (win.method === 'tsumo') parts.push(`쯔모 ${tsumoBonus}`);
  return {
    payerCount, perPayer, receipt,
    net: player.score, previousNet: player.score - receipt,
    title: `${score.name} ${win.method === 'tsumo' ? '쯔모' : '론'} · 이번 화료 +${receipt}점`,
    calculation: `(${parts.join(' + ')}) × ${payerCount}명 = +${receipt}점`,
  };
}
