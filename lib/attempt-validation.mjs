// Pure timing and input rules shared by the Worker and Node tests.
// The server accepts 0ms: suspiciously fast scores are not banned by a hidden floor.
export const COUNTDOWN_MS = 10_000;
export const MAX_REACTION_MS = 30_000;
export const NETWORK_SLACK_MS = 15_000;
export const NICKNAME_WINDOW_MS = 60_000;
export const START_RATE_WINDOW_MS = 60_000;
export const MAX_STARTS_PER_WINDOW = 12;
export const START_COOLDOWN_MS = 1_500;

export function validReaction(ms) {
  return Number.isInteger(ms) && ms >= 0 && ms <= MAX_REACTION_MS;
}

export function normalizedNickname(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().normalize('NFC');
  if (!name || [...name].length > 12 || /[\p{C}<>]/u.test(name)) return null;
  return name;
}

// A hit must be sent immediately after a measured touch, not at nickname entry.
// The server's elapsed time can be longer than the client's due to HTTP latency;
// the bounded slack avoids rejecting normal mobile connections.
export function hitStartWindow(receivedAt, ms) {
  if (!Number.isFinite(receivedAt) || !validReaction(ms)) return null;
  const latest = receivedAt - COUNTDOWN_MS - ms;
  return { earliest: latest - NETWORK_SLACK_MS, latest };
}
