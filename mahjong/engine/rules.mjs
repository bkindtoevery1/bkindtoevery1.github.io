// H only. Every interpretation absent from §8.2 is explicit and serializable.
export const DEFAULT_RULES = Object.freeze({
  id: 'H-2026-literal-v1',
  ronPassAllowed: true,
  passRonLock: 'none',
  selfDiscardFuriten: false,
  pinfuClosedOnly: false,
  peikouClosedOnly: false,
  ryanpeikouDistinctSuits: true,
  concealedKanBreaksMenzen: true,
  menzenRequiresTsumo: false,
  sevenPairsQuadAsTwo: false,
  greenTiles: [18,19,20,21,22,23,24,25,26,32],
  kanBonus: 100,
  dragonBonus: 100,
  roundWindBonus: 100,
  seatWindBonus: 100,
  tsumoBonusPerPayer: 100,
  drawIncludesBonuses: false,
  drawWaitAvailability: 'structural',
  deadWallTiles: 0,
  maxKans: 32,
  kanReplacement: 'live-tail',
  addedKanRobAllowed: true,
  multipleRon: 'all',
  chiFrom: 'next-active',
  allowKuikae: true,
  revealWinnerHand: true,
  revealTsumoWinningTile: false,
  roundWind: 27
});

export function ruleset(overrides = {}) {
  for (const k of Object.keys(overrides)) if (!(k in DEFAULT_RULES)) throw new Error(`Unknown H ruleset key: ${k}`);
  const r = {...DEFAULT_RULES, ...overrides, greenTiles: [...(overrides.greenTiles ?? DEFAULT_RULES.greenTiles)]};
  for (const k of Object.keys(DEFAULT_RULES)) {
    if (typeof DEFAULT_RULES[k] === 'boolean' && typeof r[k] !== 'boolean') throw new Error(`Invalid boolean ${k}`);
    if (typeof DEFAULT_RULES[k] === 'number' && (!Number.isSafeInteger(r[k]) || r[k] < 0)) throw new Error(`Invalid number ${k}`);
  }
  if (!['none','until-draw'].includes(r.passRonLock) || !['all','nearest'].includes(r.multipleRon) || !['next-active','next-seat'].includes(r.chiFrom)) throw new Error('Invalid rules enum');
  if (!['structural','public-possible'].includes(r.drawWaitAvailability)) throw new Error('Invalid draw wait rule');
  if (r.kanReplacement !== 'live-tail' || r.deadWallTiles > 70 || ![27,28,29,30].includes(r.roundWind)) throw new Error('Unsupported wall or wind configuration');
  if (!r.greenTiles.every(t=>Number.isInteger(t) && t>=0 && t<34)) throw new Error('Invalid green tile');
  return r;
}
