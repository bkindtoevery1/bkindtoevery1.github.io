export async function renderTrainingResults(get,training){
  try{
    const response=await fetch(new URL('../results/training-20261006/analysis.json',import.meta.url));
    if(!response.ok)throw new Error('결과 파일을 불러오지 못했습니다.');
    const data=await response.json(),pair=data.tunedPairs.find(r=>r.comparison==='C-B');
    get('training-run-status').textContent=`이전 H룰에서 실행 완료 · 총 ${training.completedGames.toLocaleString()}국 · 튜닝 ${training.trainingSeeds.toLocaleString()}개 / 검증 ${training.validationSeeds.toLocaleString()}개 시드`;
    get('training-conclusion').textContent=`이전 규칙의 학습 후보끼리 C−B는 국당 ${pair.meanDifference.toFixed(2)}점 (95% 신뢰구간 ${pair.ci95Low.toFixed(2)} ~ ${pair.ci95High.toFixed(2)})입니다. 당시 검증된 개선 정책: ${Object.keys(training.weights).join(', ')||'없음'}. 10/11 문의 답변을 반영한 새 규칙에서는 재검증하지 않았으며, 이 가중치를 자동 적용하지 않습니다.`;
    get('training-summary').replaceChildren();
    for(const r of data.improvements){
      const old=data.baselineSummary.find(x=>x.policy===r.policy),tuned=data.tunedSummary.find(x=>x.policy===r.policy),row=document.createElement('tr');
      for(const value of [r.policy,old.meanNet.toFixed(2),tuned.meanNet.toFixed(2),r.meanDifference.toFixed(2),`${r.ci95Low.toFixed(2)} ~ ${r.ci95High.toFixed(2)}`,Object.hasOwn(training.weights,r.policy)?'구 규칙에서만 검증':'기존 유지']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
      get('training-summary').append(row);
    }
  }catch{get('training-conclusion').textContent='결과 파일을 불러오지 못했습니다. 한국어 보고서에서 실제 검증 결과를 확인하세요.';}
}
