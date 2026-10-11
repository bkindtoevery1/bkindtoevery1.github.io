const IDS=['A','D','E','V1','Y1','M1','M2','M3'];
const MIXED=['M1','M2','M3'];
const REFERENCES=['V1','Y1'];
const PROFILES=['speed','pinfu','value','cautious','mixed','valuePressure'];
const PROFILE_NAMES={speed:'속도형',pinfu:'핑후형',value:'고득점형',cautious:'신중형',mixed:'혼합형',valuePressure:'고득점 압박형'};
const BASE_NAMES={A:'기존 최속',D:'기존 고득점',E:'기존 균형',V1:'비공개 안깡 고득점',Y1:'V1 + 자패 가치 보정'};
const SEEDS=504,GAMES=SEEDS*4;
const fixed=value=>Number.isFinite(value)?value.toFixed(2):'—';
const percent=value=>Number.isFinite(value)?`${(value*100).toFixed(1)}%`:'—';
const range=(low,high)=>`${fixed(low)} ~ ${fixed(high)}`;
const improved=row=>row.simultaneousLow>0;
const verdict=row=>improved(row)?'기준 대비 개선 확인':row.simultaneousHigh<0?'기준 대비 낮음':'차이 미확정';
const sameSet=(values,expected)=>Array.isArray(values)&&values.length===expected.length&&new Set(values).size===expected.length&&values.every(value=>expected.includes(value));
const validSummary=(row,games,clusters)=>row.games===games&&row.seedClusters===clusters&&
 [row.meanNet,row.ci95Low,row.ci95High,row.meanRank,row.topScoreRate,row.winRate].every(Number.isFinite)&&row.ci95Low<=row.ci95High&&
 row.meanRank>=1&&row.meanRank<=4&&row.topScoreRate>=0&&row.topScoreRate<=1&&row.winRate>=0&&row.winRate<=1;

// This panel is specific to the completed 504-seed hybrid experiment. It does
// not promote the holdout's largest mean to the tuning-frozen default policy.
export function hybridTrainingResultModel(manifest,selection,data){
 const counts=manifest?.counts,plan=manifest?.plan;
 if(manifest?.status!=='complete'||!Number.isSafeInteger(manifest.completedGames)||!counts||
  [counts.pilot,counts.tuning,counts.holdout,counts.total].some(count=>!Number.isSafeInteger(count)||count<=0)||
  manifest.completedGames!==counts.total||counts.total!==counts.pilot+counts.tuning+counts.holdout)
  throw new Error('혼합형 자동 대국이 모두 완료되지 않았습니다.');
 if(!Array.isArray(manifest.experiments)||!manifest.experiments.length||new Set(manifest.experiments.map(row=>row.key)).size!==manifest.experiments.length||
  manifest.experiments.some(row=>row.status!=='complete'||!Number.isSafeInteger(row.games)||row.games<=0||row.games!==row.expected)||
  manifest.experiments.reduce((sum,row)=>sum+row.games,0)!==counts.total)
  throw new Error('혼합형 실행 기록의 완료 국 수가 맞지 않습니다.');
 const versions=selection?.versions;
 if(selection?.id!==manifest.id||!Number.isFinite(Date.parse(selection.frozenAt))||!Array.isArray(versions)||!sameSet(versions.map(row=>row.id),MIXED)||
  versions.some(row=>row.policy!=='E'||!Number.isFinite(row.tuningMean))||!MIXED.includes(selection.preferredVersion)||
  !Array.isArray(selection.controls)||!sameSet(selection.controls.map(row=>row.id),IDS.slice(0,5))||
  !manifest.rules?.concealedKanPrivate||manifest.rules.variant==='S'||!sameSet(plan?.profiles,PROFILES))
  throw new Error('혼합형 검증 조건과 고정한 버전을 확인하지 못했습니다.');
 const preferred=[...versions].sort((a,b)=>b.tuningMean-a.tuningMean||a.id.localeCompare(b.id))[0];
 if(preferred.id!==selection.preferredVersion)throw new Error('기본 혼합형이 최종 검증 전 튜닝 선택과 다릅니다.');
 if(plan?.holdout?.seedCount!==SEEDS||counts.holdout!==GAMES*IDS.length||!data?.bootstrap||data.bootstrap.seedClusters!==SEEDS||
  !Array.isArray(data.summary)||!sameSet(data.summary.map(row=>row.policy),IDS)||data.summary.some(row=>!validSummary(row,GAMES,SEEDS)))
  throw new Error('혼합형 최종 검증의 504개 시드·정책당 2,016국이 맞지 않습니다.');
 const comparisons=MIXED.flatMap(policy=>REFERENCES.map(reference=>`${policy}-${reference}`));
 if(!Array.isArray(data.improvements)||!sameSet(data.improvements.map(row=>`${row.policy}-${row.reference}`),comparisons)||
  data.improvements.some(row=>row.seedClusters!==SEEDS||row.familySize!==6||!Number.isFinite(row.simultaneousConfidence)||Math.abs(row.simultaneousConfidence-(1-.05/6))>1e-12||
   ![row.meanDifference,row.ci95Low,row.ci95High,row.simultaneousLow,row.simultaneousHigh].every(Number.isFinite)||
   row.ci95Low>row.ci95High||row.simultaneousLow>row.simultaneousHigh))
  throw new Error('혼합형의 사전 지정 여섯 비교와 보정 구간이 맞지 않습니다.');
 const profileKeys=PROFILES.flatMap(profile=>IDS.map(policy=>`${profile}:${policy}`));
 if(!Array.isArray(data.profileSummary)||!sameSet(data.profileSummary.map(row=>`${row.profile}:${row.policy}`),profileKeys)||
  data.profileSummary.some(row=>!validSummary(row,GAMES/6,SEEDS/6)))
  throw new Error('상대 성향별 혼합형 검증 결과가 맞지 않습니다.');
 const names={...BASE_NAMES,...Object.fromEntries([...selection.controls,...versions].map(row=>[row.id,row.name??BASE_NAMES[row.id]??row.id]))};
 const label=id=>`${id} · ${names[id]??id}`,summary=[...data.summary].sort((a,b)=>b.meanNet-a.meanNet||a.policy.localeCompare(b.policy));
 const improvements=[...data.improvements],approved=improvements.filter(improved).map(row=>`${row.policy} (${row.reference} 대비)`);
 const best=summary[0];
 return {summary,versions:[...versions].sort((a,b)=>a.id.localeCompare(b.id)),improvements,profiles:[...data.profileSummary],names,label,best,seeds:SEEDS,
  preferredVersion:selection.preferredVersion,
  conclusion:`기본 혼합형 ${label(selection.preferredVersion)}는 최종 검증 전에 튜닝 성적으로 고정했습니다. 이번 검증의 평균 순수익은 ${label(best.policy)}가 국당 ${fixed(best.meanNet)}점으로 가장 높았습니다. 여섯 사전 지정 비교를 보정한 뒤 개선이 확인된 비교: ${approved.join(', ')||'없음'}. 평균 1위와 기본 선택은 별개이며, 사람 상대 성능이나 전역 최적 전략을 뜻하지 않습니다.`};
}

function fillRows(element,rows,format){
 element.replaceChildren();
 for(const row of rows){const tr=document.createElement('tr');for(const value of format(row)){const td=document.createElement('td');td.textContent=value;tr.append(td);}element.append(tr);}
}
async function readResult(name){
 const response=await fetch(new URL(`../results/hybrid-20261011/${name}.json`,import.meta.url));
 if(!response.ok)throw new Error('혼합형 검증 기록을 불러오지 못했습니다.');return response.json();
}
export async function renderHybridTrainingResults(get){
 const content=get('hybrid-training-data'),status=get('hybrid-training-run-status'),conclusion=get('hybrid-training-conclusion');
 if(!content||!status||!conclusion)return;
 content.hidden=true;
 try{
  const manifest=await readResult('manifest');
  if(manifest.status!=='complete'){
   status.textContent=`공격·수비 혼합형 · ${Number.isSafeInteger(manifest.completedGames)?manifest.completedGames.toLocaleString()+'국 완료':'실행 기록 확인 중'}`;
   conclusion.textContent='전체 검증이 완료되지 않아 혼합형의 우열을 표시하지 않습니다. 실제 실행 기록을 확인해 주세요.';return;
  }
  const [selection,data]=await Promise.all([readResult('selection'),readResult('analysis')]),model=hybridTrainingResultModel(manifest,selection,data);
  const time=Number.isFinite(manifest.elapsedSeconds)?` · 실행 ${fixed(manifest.elapsedSeconds/60)}분`:'';
  status.textContent=`실행 완료 · 총 ${manifest.completedGames.toLocaleString()}국${time}`;conclusion.textContent=model.conclusion;
  const plan=manifest.plan;
  get('hybrid-training-design').textContent=`점검 ${manifest.counts.pilot.toLocaleString()}국 → 튜닝 ${manifest.counts.tuning.toLocaleString()}국 (${plan.tuning.seedCount}개 시드, 계열당 후보 2개) → 최종 검증 ${manifest.counts.holdout.toLocaleString()}국 (504개 새 시드 × 4자리 × 8전략). 상대 성향 6종. 동일 시드의 모든 자리·정책을 함께 재표본하고 성향 비중을 유지합니다. 표의 95% 구간은 탐색용이며, M1~M3의 V1·Y1 대비 여섯 비교에는 별도의 보정 구간을 사용합니다. 순위는 한 국의 점수 순위이며 공동 1위도 1위율에 포함합니다.`;
  const cards=get('hybrid-training-versions');cards.replaceChildren();
  for(const version of model.versions){
   const card=document.createElement('article');card.className='training-version-card';
   const title=document.createElement('h3'),description=document.createElement('p'),comparison=document.createElement('p');
   title.textContent=model.label(version.id)+(version.id===model.preferredVersion?' · 기본 혼합형':'');description.textContent=version.description;
   comparison.textContent=REFERENCES.map(reference=>`${reference} 대비: ${verdict(model.improvements.find(row=>row.policy===version.id&&row.reference===reference))}`).join(' · ');comparison.className='training-version-verdict';
   card.append(title,description,comparison);cards.append(card);
  }
  fillRows(get('hybrid-training-summary'),model.summary,row=>[model.label(row.policy),fixed(row.meanNet),range(row.ci95Low,row.ci95High),fixed(row.meanRank),percent(row.topScoreRate),percent(row.winRate)]);
  fillRows(get('hybrid-training-improvements'),model.improvements,row=>[`${row.policy} − ${row.reference}`,fixed(row.meanDifference),range(row.ci95Low,row.ci95High),range(row.simultaneousLow,row.simultaneousHigh),verdict(row)]);
  fillRows(get('hybrid-training-details'),model.summary,row=>[row.policy,percent(row.ronShareAmongWins),percent(row.tsumoShareAmongWins),percent(row.firstWinRate),fixed(row.averageWinOrder),fixed(row.averageWinDrawNumber),fixed(row.netAmongWins),fixed(row.dealInLossPerGame),fixed(row.tsumoPaidPerGame),fixed(row.drawLossPerGame)]);
  fillRows(get('hybrid-training-profiles'),model.profiles,row=>[PROFILE_NAMES[row.profile]??row.profile,row.policy,fixed(row.meanNet),range(row.ci95Low,row.ci95High),fixed(row.meanRank)]);
  content.hidden=false;return model;
 }catch{
  status.textContent='공격·수비 혼합형 · 완료 기록 확인 필요';
  conclusion.textContent='완료된 혼합형 결과를 확인하지 못해 수치를 표시하지 않습니다. 한국어 보고서와 실제 실행 기록을 확인해 주세요.';
 }
}
