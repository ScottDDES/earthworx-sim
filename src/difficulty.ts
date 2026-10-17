// Difficulty. The player picks it by how much they borrow at the start: a big loan is Easy,
// a shoestring is Hard. Hardcore is Hard with no second chances, and sits on top of any loan.

export type Difficulty = 'easy' | 'normal' | 'hard' | 'hc';

export interface DifficultyRules {
  /** Added to rivals' margins: positive gives the player more room. */
  mg: number;
  /** How often trouble turns up (curve balls), relative to Normal. */
  spawn: number;
  /** How often clients pay late, relative to Normal. */
  late: number;
  /** Safety incident risk, relative to Normal. */
  risk: number;
  /** Breakdown odds, relative to Normal. */
  brk: number;
  /** Yearly cost inflation. */
  infl: number;
  /** The best cost edge a rival keeps on council work (their efficiency can't beat this). */
  ef: number;
  soft?: boolean;
}

export const DIFFICULTY: Record<Difficulty, DifficultyRules> = {
  easy:   { mg: 0.08,  spawn: 0.5, late: 0.4, risk: 0.6,  brk: 0.7,  infl: 0,     soft: true, ef: 0.98 },
  normal: { mg: 0,     spawn: 1,   late: 1,   risk: 1,    brk: 1,    infl: 0,     ef: 0.95 },
  hard:   { mg: -0.04, spawn: 1.6, late: 1.4, risk: 1.2,  brk: 1.15, infl: 0.035, ef: 0.9 },
  hc:     { mg: -0.05, spawn: 1.8, late: 1.7, risk: 1.35, brk: 1.3,  infl: 0.045, ef: 0.88 },
};

/** The difficulty a starting loan sets. */
export function difficultyOf(loanStart: number, hardcore = false): Difficulty {
  if (hardcore) return 'hc';
  if (!loanStart) return 'normal';
  return loanStart <= 100_000 ? 'hard' : loanStart >= 300_000 ? 'easy' : 'normal';
}

/** How much dearer things are than at the start, after inflation. 1 on Easy and Normal. */
export function costIdx(week: number, d: Difficulty): number {
  return Math.pow(1 + DIFFICULTY[d].infl, Math.max(0, week - 1) / 52);
}
