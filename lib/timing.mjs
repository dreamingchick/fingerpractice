// The countdown ends at exactly zero; earlier touches are ignored.
export const MIN_REACTION_MS = 0;
export function judge(deadline, at) {
  if (!Number.isFinite(deadline) || !Number.isFinite(at) || at < deadline) {
    return { kind: "ignored" };
  }
  return { kind: "success", ms: Math.floor(at - deadline) };
}
export function remaining(deadline, at) {
  return Math.max(0, Math.ceil((deadline - at) / 1000));
}
