// This view-only state is intentionally kept out of game state, storage and logs.
export function createKanPeek({durationMs = 1500, now = () => Date.now(),
  setTimeout: schedule = globalThis.setTimeout, clearTimeout: cancel = globalThis.clearTimeout,
  onChange = () => {}} = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new RangeError('확인 시간은 양수여야 합니다.');
  let context = null, activeKey = null, deadline = 0, timer = null, generation = 0;
  const clear = ({notify = true} = {}) => {
    const changed = activeKey !== null;
    if (timer !== null) cancel(timer);
    timer = null; activeKey = null; deadline = 0; generation++;
    if (changed && notify) onChange();
    return changed;
  };
  const isRevealed = key => activeKey === key && now() < deadline;
  const reveal = key => {
    if (typeof key !== 'string' || !key) throw new TypeError('안깡 확인 위치가 필요합니다.');
    clear({notify: false}); activeKey = key; deadline = now() + durationMs;
    const current = generation;
    const expire = () => {
      if (current !== generation) return;
      const remaining = deadline - now();
      if (remaining > 0) timer = schedule(expire, remaining);
      else clear();
    };
    timer = schedule(expire, durationMs); onChange();
  };
  const setContext = value => {
    if (value === context) return false;
    context = value; clear({notify: false}); return true;
  };
  return {setContext, reveal, isRevealed, clear};
}
