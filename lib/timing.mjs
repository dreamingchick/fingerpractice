export const MIN_REACTION_MS = 101;
export function judge(deadline, at) { return at - deadline < MIN_REACTION_MS ? { kind: "ignored" } : { kind: "success", ms: Math.floor(at-deadline) }; }
export function remaining(deadline, at) {return Math.max(0,Math.ceil((deadline-at)/1000));}
