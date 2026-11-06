export const MIN_REACTION_MS: 101;
export function judge(deadline:number,at:number):{kind:"ignored"}|{kind:"success",ms:number};
export function remaining(deadline:number,at:number):number;
