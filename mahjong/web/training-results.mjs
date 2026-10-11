import {renderHybridTrainingResults} from './hybrid-results.mjs';
const BASE_NAMES={A:'최속 화료',B:'핑후·론 수락',C:'핑후·쯔모 지향',D:'고득점',E:'균형'};
const PROFILE_NAMES={speed:'속도형',pinfu:'핑후형',value:'고득점형',cautious:'신중형',mixed:'혼합형',valuePressure:'고득점 압박형'};
const fixed=value=>Number.isFinite(value)?value.toFixed(2):'—';
const percent=value=>Number.isFinite(value)?`${(value*100).toFixed(1)}%`:'—';
const range=(low,high)=>`${fixed(low)} ~ ${fixed(high)}`;
const improved=row=>row.simultaneousLow>0;
const verdict=row=>improved(row)?'기준 대비 개선 확인':row.simultaneousHigh<0?'기준 대비 낮음':'차이 미확정';

// Refuse to label planned or partial simulations as completed validation.
export function privateTrainingResultModel(manifest,selection,data){
  const counts=manifest?.counts,versions=selection?.versions,seeds=manifest?.plan?.holdout?.seedCount;
  if(manifest?.status!=='complete'||!Number.isSafeInteger(manifest.completedGames)||!counts||
    manifest.completedGames!==counts.total||counts.total!==counts.pilot+counts.tuning+counts.holdout)
    throw new Error('전체 자동 대국이 완료되지 않았습니다.');
  if(selection?.id!==manifest.id||!Array.isArray(versions)||versions.length!==6||!selection.frozenAt||
    !Number.isSafeInteger(seeds)||seeds<2||!manifest.rules?.concealedKanPrivate)
    throw new Error('검증 조건과 고정한 전략 버전을 확인하지 못했습니다.');
  const ids=['A','B','C','D','E',...versions.map(v=>v.id)],expectedGames=seeds*4;
  if(new Set(ids).size!==11||!data?.summary||data.summary.length!==ids.length||
    !data.bootstrap||data.bootstrap.seedClusters!==seeds||counts.holdout!==expectedGames*ids.length||
    ids.some(id=>data.summary.filter(row=>row.policy===id&&row.games===expectedGames&&
      [row.meanNet,row.ci95Low,row.ci95High,row.meanRank,row.topScoreRate,row.winRate].every(Number.isFinite)).length!==1))
    throw new Error('최종 검증의 완료 국 수가 맞지 않습니다.');
  if(!Array.isArray(data.improvements)||data.improvements.length!==6||versions.some(v=>
    data.improvements.filter(row=>row.policy===v.id&&row.reference===v.policy&&
      [row.meanDifference,row.ci95Low,row.ci95High,row.simultaneousLow,row.simultaneousHigh].every(Number.isFinite)).length!==1))
    throw new Error('기준 정책과의 비교 결과가 맞지 않습니다.');
  const names={...BASE_NAMES,...Object.fromEntries(versions.map(v=>[v.id,v.name]))};
  const label=id=>`${id} · ${names[id]??id}`;
  const summary=[...data.summary].sort((a,b)=>b.meanNet-a.meanNet||a.policy.localeCompare(b.policy));
  const approved=data.improvements.filter(improved).map(row=>`${row.policy} (${row.reference} 대비)`);
  const best=summary[0];
  return {summary,versions,names,label,best,seeds,
    conclusion:`이번 자동 대국의 평균 순수익은 ${label(best.policy)}가 국당 ${fixed(best.meanNet)}점으로 가장 높았습니다. 여섯 사전 지정 비교를 보정한 뒤 기준보다 개선이 확인된 버전: ${approved.join(', ')||'없음'}.`,
    improvements:data.improvements,profiles:data.profileSummary??[],pairCB:data.pairs?.find(row=>row.policy==='C'&&row.reference==='B')};
}

function fillRows(element,rows,format){
  element.replaceChildren();
  for(const row of rows){const tr=document.createElement('tr');for(const value of format(row)){const td=document.createElement('td');td.textContent=value;tr.append(td);}element.append(tr);}
}
async function readResult(name){
  const response=await fetch(new URL(`../results/private-kan-20261011/${name}.json`,import.meta.url));
  if(!response.ok)throw new Error('검증 기록을 불러오지 못했습니다.');return response.json();
}
async function renderPrivateTrainingResults(get){
  const content=get('private-training-data'),status=get('private-training-run-status'),conclusion=get('private-training-conclusion');
  if(!content||!status||!conclusion)return;
  content.hidden=true;
  try{
    const manifest=await readResult('manifest');
    if(manifest.status!=='complete'){
      status.textContent=`안깡 비공개 H룰 · ${Number.isSafeInteger(manifest.completedGames)?manifest.completedGames.toLocaleString()+'국 완료':'실행 기록 확인 중'}`;
      conclusion.textContent='전체 검증이 완료되지 않아 전략의 우열을 표시하지 않습니다. 한국어 보고서와 실행 기록에서 진행 상태를 확인하세요.';return;
    }
    const [selection,data]=await Promise.all([readResult('selection'),readResult('analysis')]),model=privateTrainingResultModel(manifest,selection,data);
    const time=Number.isFinite(manifest.elapsedSeconds)?` · 실행 ${fixed(manifest.elapsedSeconds/60)}분`:'';
    status.textContent=`실행 완료 · 총 ${manifest.completedGames.toLocaleString()}국${time}`;
    conclusion.textContent=model.conclusion;
    const plan=manifest.plan;
    get('private-training-design').textContent=`점검 ${manifest.counts.pilot.toLocaleString()}국 → 튜닝 ${manifest.counts.tuning.toLocaleString()}국 (${plan.tuning.seedCount}개 시드, 계열당 후보 2개) → 최종 검증 ${manifest.counts.holdout.toLocaleString()}국 (${model.seeds}개 새 시드 × 4자리 × 11전략). 상대 성향 ${plan.profiles.length}종. 동일 시드의 모든 자리·정책을 함께 재표본하고 상대 성향 비율을 유지해 95% 신뢰구간을 계산했습니다.`;
    const cards=get('private-training-versions');cards.replaceChildren();
    for(const version of model.versions){
      const card=document.createElement('article');card.className='training-version-card';
      const title=document.createElement('h3'),description=document.createElement('p'),comparison=document.createElement('p');
      title.textContent=model.label(version.id);description.textContent=version.description;
      const row=model.improvements.find(r=>r.policy===version.id);comparison.textContent=`기준 ${version.policy} · ${verdict(row)}`;comparison.className='training-version-verdict';
      card.append(title,description,comparison);cards.append(card);
    }
    fillRows(get('private-training-summary'),model.summary,row=>[model.label(row.policy),fixed(row.meanNet),range(row.ci95Low,row.ci95High),fixed(row.meanRank),percent(row.topScoreRate),percent(row.winRate)]);
    fillRows(get('private-training-improvements'),model.improvements,row=>[`${row.policy} − ${row.reference}`,fixed(row.meanDifference),range(row.ci95Low,row.ci95High),range(row.simultaneousLow,row.simultaneousHigh),verdict(row)]);
    fillRows(get('private-training-details'),model.summary,row=>[row.policy,percent(row.ronShareAmongWins),percent(row.tsumoShareAmongWins),percent(row.firstWinRate),fixed(row.averageWinOrder),fixed(row.averageWinDrawNumber),fixed(row.netAmongWins),fixed(row.dealInLossPerGame),fixed(row.tsumoPaidPerGame),fixed(row.drawLossPerGame)]);
    fillRows(get('private-training-profiles'),model.profiles,row=>[PROFILE_NAMES[row.profile]??row.profile,row.policy,fixed(row.meanNet),range(row.ci95Low,row.ci95High),fixed(row.meanRank)]);
    const pair=model.pairCB;
    get('private-training-cb').textContent=pair?`처음의 질문인 C − B (핑후 쯔모 지향 − 론 수락)는 국당 ${fixed(pair.meanDifference)}점, 차이의 95% 신뢰구간 ${range(pair.ci95Low,pair.ci95High)}점입니다. 이 비교는 탐색용이며 여러 정책 쌍에 대한 보정은 하지 않았습니다.`:'';
    content.hidden=false;
  }catch{
    status.textContent='안깡 비공개 H룰 · 완료 기록 확인 필요';
    conclusion.textContent='완료된 결과 파일을 확인하지 못했습니다. 수치를 표시하지 않으며, 한국어 보고서에서 실제 실행 기록을 확인할 수 있습니다.';
  }
}

async function renderLegacyTrainingResults(get,training){
  try{
    const response=await fetch(new URL('../results/training-20261006/analysis.json',import.meta.url));
    if(!response.ok)throw new Error('결과 파일을 불러오지 못했습니다.');
    const data=await response.json(),pair=data.tunedPairs.find(r=>r.comparison==='C-B');
    get('training-run-status').textContent=`이전 H룰에서 실행 완료 · 총 ${training.completedGames.toLocaleString()}국 · 튜닝 ${training.trainingSeeds.toLocaleString()}개 / 검증 ${training.validationSeeds.toLocaleString()}개 시드`;
    get('training-conclusion').textContent=`이전 규칙의 학습 후보끼리 C−B는 국당 ${pair.meanDifference.toFixed(2)}점 (95% 신뢰구간 ${pair.ci95Low.toFixed(2)} ~ ${pair.ci95High.toFixed(2)})입니다. 당시 검증된 개선 정책: ${Object.keys(training.weights).join(', ')||'없음'}. 이 구 규칙 가중치의 수치를 새 규칙 성능으로 옮겨 해석하지 않으며, 새 대국에 자동 적용하지 않습니다. 안깡 비공개 규칙의 별도 실험은 위에서 확인하세요.`;
    get('training-summary').replaceChildren();
    for(const r of data.improvements){
      const old=data.baselineSummary.find(x=>x.policy===r.policy),tuned=data.tunedSummary.find(x=>x.policy===r.policy),row=document.createElement('tr');
      for(const value of [r.policy,old.meanNet.toFixed(2),tuned.meanNet.toFixed(2),r.meanDifference.toFixed(2),`${r.ci95Low.toFixed(2)} ~ ${r.ci95High.toFixed(2)}`,Object.hasOwn(training.weights,r.policy)?'구 규칙에서만 검증':'기존 유지']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
      get('training-summary').append(row);
    }
  }catch{get('training-conclusion').textContent='결과 파일을 불러오지 못했습니다. 한국어 보고서에서 실제 검증 결과를 확인하세요.';}
}

export async function renderTrainingResults(get,training){
  await Promise.allSettled([renderHybridTrainingResults(get),renderPrivateTrainingResults(get),renderLegacyTrainingResults(get,training)]);
}
