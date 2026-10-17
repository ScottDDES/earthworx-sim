// Seeded random numbers. Every roll in a career comes from one stream kept in the save,
// so the same seed and the same choices always play out the same way.
// Screens must never roll: drawing the screen twice would change the career.

export type Rand = () => number;

/** The stream's whole state. It's one number, so it saves with the career. */
export interface RngState {
  a: number;
}

// Mulberry32: small, fast, and good enough for a game. Same maths as the prototype.
function step(a: number): [next: number, value: number] {
  const n = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(n ^ (n >>> 15), 1 | n);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [n, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}

/** A throwaway generator from a seed: for things that must come out the same every time, like a town's roads. */
export function seedRand(seed: number): Rand {
  let a = seed | 0;
  return () => {
    const [n, v] = step(a);
    a = n;
    return v;
  };
}

/** A generator that advances a saved state, so the career's stream carries on where it left off. */
export function fromState(st: RngState): Rand {
  return () => {
    const [n, v] = step(st.a);
    st.a = n;
    return v;
  };
}

/** Turns text into a seed, e.g. a career seed plus the week number. */
export function hashN(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A whole number from a to b, both included. */
export function int(rand: Rand, a: number, b: number): number {
  return a + Math.floor(rand() * (b - a + 1));
}

export function pick<T>(rand: Rand, list: readonly T[]): T {
  const v = list[Math.floor(rand() * list.length)];
  if (v === undefined) throw new Error('pick() from an empty list');
  return v;
}
