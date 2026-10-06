import {evaluateDiscards} from '../game/policies.mjs';
import {policyConfig} from '../policies/index.mjs';
import {tileName} from '../engine/tiles.mjs';

const LABELS = {speed: '완성 속도', ukeire: '유효패', value: '역 가치', pinfu: '핑후 형태', risk: '공개 정보 위험'};
const format = value => value !== 0 && Math.abs(value) < 0.005 ? value.toPrecision(2) : Number(value.toFixed(2)).toLocaleString('ko-KR');
const signed = value => `${value >= 0 ? '+' : '−'}${format(Math.abs(value))}`;
const distance = value => value === 0 ? '텐파이(0샨텐)' : `${value}샨텐`;

function components(row, view, weights, variant) {
  return {
    speed: -weights.speed * row.shanten,
    ukeire: weights.ukeire * row.ukeire,
    value: weights.value * row.value * (variant === 'H' ? 0.6 + view.activeCount / 5 : 1),
    pinfu: weights.pinfu * row.pinfu,
    risk: -weights.risk * row.risk * (variant === 'H' && row.shanten >= 2 ? 1.35 : 1),
  };
}

// H does an ascending-tile scan, replacing its best only for an improvement
// greater than 1e-9. Repeating that scan preserves its actual first choice even
// for a chain of scores closer than the tolerance. S uses a strict score sort
// whose equal-score order is ascending tile. Do not use a fuzzy comparator.
function rankRows(rows, variant) {
  const remaining = [...rows].sort((a, b) => a.tile - b.tile), ranked = [];
  while (remaining.length) {
    let best = 0;
    for (let index = 1; index < remaining.length; index++) {
      if (remaining[index].score > remaining[best].score + (variant === 'H' ? 1e-9 : 0)) best = index;
    }
    ranked.push(remaining.splice(best, 1)[0]);
  }
  return ranked;
}

/**
 * Explain legal discard choices using the same observation and weights as play.
 * No hidden state, win probability, expected payout, or reinforcement-learning
 * Q value is inferred. Non-discard actions are deliberately not scored here.
 * The first three ranked rows are returned, plus a supplied selected discard if
 * it ranks lower; `rank` always reflects the complete eligible candidate set.
 */
export function explainDiscards(view, policy, weights = {}, selectedAction = null) {
  if (selectedAction && selectedAction.type !== 'discard') return null;
  const discards = view.legalActions.filter(action => action.type === 'discard');
  if (!discards.length) return null;
  const variant = view.rules.variant === 'S' ? 'S' : 'H', config = policyConfig(policy, weights);
  const rows = evaluateDiscards({...view, legalActions: discards}, policy, weights);
  const minShanten = Math.min(...rows.map(row => row.shanten));
  const eligible = rows.filter(row => row.shanten <= minShanten + config.maxShantenLoss);
  const ordered = rankRows(eligible, variant), selectedTile = selectedAction?.tile ?? ordered[0].tile;
  if (!discards.some(action => action.tile === selectedTile)) throw new Error('설명할 버림패가 현재 합법 행동에 없습니다.');
  if (!eligible.some(row => row.tile === selectedTile)) throw new Error('설명할 버림패가 이 전략의 샨텐 제한에서 제외되었습니다.');
  const ranked = ordered.map((row, index) => ({
    rank: index + 1, tile: row.tile, score: row.score, shanten: row.shanten, ukeire: row.ukeire,
    components: components(row, view, config, variant),
    metrics: {value: row.value, pinfu: row.pinfu, risk: row.risk}, selected: row.tile === selectedTile,
  }));
  const selected = ranked.find(row => row.selected), alternative = ranked.find(row => !row.selected);
  const ranking = ranked.filter(row => row.rank <= 3 || row.selected);
  let reason = `${tileName(selected.tile)}를 버리면 ${distance(selected.shanten)}, 유효패 추정 ${selected.ukeire}장입니다.`;
  let comparison = null;
  if (alternative) {
    const differences = Object.entries(selected.components).map(([component, value]) => ({
      component, label: LABELS[component], difference: value - alternative.components[component],
    })).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    const scoreDifference = selected.score - alternative.score;
    comparison = {tile: alternative.tile, scoreDifference, components: Object.fromEntries(differences.map(row => [row.component, row.difference]))};
    const nearTie = variant === 'H' ? Math.abs(scoreDifference) <= 1e-9 : scoreDifference === 0;
    if (nearTie) {
      reason += ` ${tileName(alternative.tile)}와 ${variant === 'H' ? '평가점수가 0.000000001 이내로 같아' : '평가점수가 같아'} 타일 번호 순서로 우선순위를 정합니다.`;
    } else {
      const main = differences.filter(row => row.difference !== 0).slice(0, 2);
      reason += ` ${tileName(alternative.tile)}와 비교한 주요 평가 기여 차이는 ${main.map(row => `${row.label} ${signed(row.difference)}`).join(', ')}이며, 총 평가점수 차이는 ${signed(scoreDifference)}입니다.`;
    }
  } else reason += ' 이 전략의 샨텐 제한을 만족하는 버림패 후보가 하나입니다.';
  if (policy === 'E' && config.risk === 0) reason += ' 이 가중치에서는 위험도 감점을 적용하지 않습니다.';
  return {
    policy, variant, reason, ranking, selectedRank: selected.rank, comparison,
    excludedCount: rows.length - eligible.length, totalCount: rows.length, eligibleCount: eligible.length,
    minShanten, maxShantenLoss: config.maxShantenLoss,
    scoreNote: '같은 전략 안에서 버림패 후보를 비교하는 휴리스틱 평가점수입니다. 예상 수익이나 강화학습 Q값이 아니며, 음수도 정상입니다.',
    tieRule: variant === 'H' ? '타일 번호 오름차순 검사, 1e-9보다 크게 높을 때만 우선 후보 교체' : '평가점수 내림차순, 같은 점수는 타일 번호 오름차순',
  };
}
