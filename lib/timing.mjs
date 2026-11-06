export const MIN_REACTION_MS = 0;
export function judge(deadline, at) {
  const elapsed = at - deadline;
  return elapsed < 0 ? { kind: "ignored" } : { kind: "success", ms: Math.floor(elapsed) };
}
export function remaining(deadline, at) {return Math.max(0,Math.ceil((deadline-at)/1000));}
