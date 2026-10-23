export function createSession(players, first = 0, name = '', now = Date.now()) {
  return {version: 1, players, name, startedAt: now, endedAt: null, active: first,
    turns: [], elapsed: 0, segmentStart: now, paused: false, pausedAt: null, pauseTotal: 0};
}
export function currentDuration(s, now = Date.now()) {
  return s.elapsed + (s.paused || s.endedAt !== null ? 0 : Math.max(0, now - s.segmentStart));
}
export function nextTurn(s, now = Date.now()) {
  if (s.paused || s.endedAt !== null) return;
  s.turns.push({player: s.active, duration: currentDuration(s, now)});
  s.active = (s.active + 1) % s.players.length;
  s.elapsed = 0; s.segmentStart = now;
}
export function togglePause(s, now = Date.now()) {
  if (s.endedAt !== null) return;
  if (s.paused) { s.pauseTotal += Math.max(0, now - s.pausedAt); s.segmentStart = now; s.pausedAt = null; s.paused = false; }
  else { s.elapsed = currentDuration(s, now); s.paused = true; s.pausedAt = now; }
}
export function undoTurn(s, now = Date.now()) {
  if (!s.turns.length || s.endedAt !== null) return;
  const elapsed = currentDuration(s, now), last = s.turns.pop();
  s.active = last.player; s.elapsed = last.duration + elapsed; s.segmentStart = now;
}
export function finishSession(s, now = Date.now()) {
  if (s.endedAt !== null) return;
  const duration = currentDuration(s, now);
  if (s.paused) s.pauseTotal += Math.max(0, now - s.pausedAt);
  s.turns.push({player: s.active, duration});
  s.endedAt = now; s.elapsed = 0; s.pausedAt = null;
}
export function statistics(s) {
  const players = s.players.map((p, i) => {
    const durations = s.turns.filter(t => t.player === i).map(t => t.duration);
    const total = durations.reduce((a, b) => a + b, 0);
    return {...p, count: durations.length, total, average: durations.length ? total / durations.length : null,
      shortest: durations.length ? durations.reduce((a, b) => Math.min(a, b), Infinity) : null, longest: durations.length ? durations.reduce((a, b) => Math.max(a, b), 0) : null};
  });
  const total = players.reduce((sum, p) => sum + p.total, 0);
  return {players, total, average: s.turns.length ? total / s.turns.length : null};
}
export function validSession(s) {
  const time = n => Number.isFinite(n) && n >= 0;
  return !!s && s.version === 1 && typeof s.name === 'string' && s.name.length <= 80 &&
    Array.isArray(s.players) && s.players.length >= 2 && s.players.length <= 8 &&
    s.players.every(p => p && typeof p.name === 'string' && p.name.length <= 40 && /^#[0-9a-f]{6}$/i.test(p.color)) &&
    Number.isInteger(s.active) && s.active >= 0 && s.active < s.players.length &&
    time(s.startedAt) && time(s.segmentStart) && time(s.elapsed) && time(s.pauseTotal) &&
    typeof s.paused === 'boolean' && (s.endedAt === null || time(s.endedAt)) &&
    (!s.paused || s.endedAt !== null || time(s.pausedAt)) &&
    Array.isArray(s.turns) && s.turns.every(t => t && Number.isInteger(t.player) && t.player >= 0 && t.player < s.players.length && time(t.duration));
}
