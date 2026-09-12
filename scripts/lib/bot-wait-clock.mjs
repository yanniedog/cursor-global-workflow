export function startHeadWaitClock(state, headSha, reset = false, now = new Date().toISOString()) {
  if (reset || state.headSha !== headSha || !Number.isFinite(Date.parse(state.waitStartedAt))) {
    state.waitStartedAt = now;
  }
  return state.waitStartedAt;
}

export function elapsedHeadWait(state, fallbackAnchor, now = Date.now()) {
  const started = Date.parse(state?.waitStartedAt);
  return now - (Number.isFinite(started) ? started : fallbackAnchor.getTime());
}

export function setExplicitWaitClock(state, since) {
  const timestamp = Date.parse(since);
  if (!Number.isFinite(timestamp)) throw new Error('Invalid --since timestamp');
  state.waitStartedAt = new Date(timestamp).toISOString();
}
