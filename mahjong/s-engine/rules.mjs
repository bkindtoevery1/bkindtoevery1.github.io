// Tournament guide §8.1 takes priority. Supplemental choices are documented in
// docs/s-rules.ko.md; they never enter the frozen H engine or its experiment.
export const S_DEFAULTS=Object.freeze({id:'S-2026-v2',variant:'S',pinfuHan:2,roundWind:27,startingPoints:25000,riichiDeposit:1000,
  peikouClosedOnly:true,pinfuValuePairAllowed:false,openSequenceReduction:false,standardYakuman:true,multipleRon:'nearest',
  sevenPairsQuadAsTwo:false,allowKuikae:true,selfDiscardFuriten:true,ronPassAllowed:true,passRonLock:'until-draw',
  maxKans:4,deadWallTiles:14,revealWinnerHand:true,revealTsumoWinningTile:true});
export function sRules(overrides={}){
  for(const key of Object.keys(overrides))if(!(key in S_DEFAULTS))throw new Error(`Unknown S rule: ${key}`);
  const rules={...S_DEFAULTS,...overrides};
  for(const key of Object.keys(S_DEFAULTS)){const value=rules[key],base=S_DEFAULTS[key];if(typeof value!==typeof base||typeof base==='number'&&(!Number.isSafeInteger(value)||value<0))throw new Error(`Invalid S rule: ${key}`);}
  if(rules.variant!=='S'||rules.maxKans!==4||rules.deadWallTiles!==14||rules.multipleRon!=='nearest'||rules.riichiDeposit!==1000||rules.sevenPairsQuadAsTwo||!rules.selfDiscardFuriten||!rules.ronPassAllowed||rules.passRonLock!=='until-draw'||![27,28,29,30].includes(rules.roundWind))throw new Error('Unsupported S rule configuration');
  return rules;
}
