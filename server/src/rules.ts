// The board's rules, kept apart from the Worker so they can be tested on their own: what a post must look like,
// what a nickname may be, and which places may call the board.

/** Where the app runs: the Android and iPhone apps, and the dev server. */
export const ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost', 'http://localhost:5173'];

/** A season's recording can't be bigger than this (a long season is a few hundred moves, well under 100 KB). */
export const MAX_BODY = 300_000;
/** Posts per address per hour. */
export const POSTS_PER_HOUR = 20;
/** Rows on the board. */
export const BOARD_ROWS = 50;

// Words that keep a name off the board. Kept short and plain; the owner can hide anything else by hand.
const BLOCKED = ['fuck', 'shit', 'cunt', 'nigg', 'nazi', 'hitler', 'wank', 'slut', 'whore', 'retard'];

/** A nickname for the board, tidied, or why it can't be used. */
export function cleanName(raw: unknown): { ok: true; name: string } | { ok: false; why: string } {
  if (typeof raw !== 'string') return { ok: false, why: 'Pick a name for the board.' };
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 20) return { ok: false, why: 'Names are 2 to 20 letters.' };
  if (!/^[\p{L}\p{N} .'\-]+$/u.test(name)) return { ok: false, why: 'Letters, numbers, spaces and . \' - only.' };
  // read look-alike digits as letters first, then squash everything else out
  const flat = name.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/[^a-z]/g, '');
  if (BLOCKED.some((w) => flat.includes(w))) return { ok: false, why: 'Pick another name.' };
  return { ok: true, name };
}

/** A company name shown beside the nickname: tidied and cut short, never refused (the board shows "A company" instead). */
export function cleanCo(raw: unknown): string {
  if (typeof raw !== 'string') return 'A company';
  const co = raw.normalize('NFKC').replace(/[^\p{L}\p{N} .'&\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const flat = co.toLowerCase().replace(/[^a-z]/g, '');
  return co.length < 2 || BLOCKED.some((w) => flat.includes(w)) ? 'A company' : co;
}

export interface Post {
  season: string;
  player: string;
  name: string;
  co: string;
  v: number;
  moves: unknown[];
}

/** The body of a score post, checked for shape (the replay checks the rest). */
export function readPost(body: unknown): { ok: true; post: Post } | { ok: false; why: string } {
  if (!body || typeof body !== 'object') return { ok: false, why: 'Not a score.' };
  const b = body as Record<string, unknown>;
  if (typeof b.season !== 'string' || b.season.length > 40) return { ok: false, why: 'No season.' };
  if (typeof b.player !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(b.player)) return { ok: false, why: 'No player id.' };
  if (typeof b.v !== 'number') return { ok: false, why: 'No version.' };
  if (!Array.isArray(b.moves)) return { ok: false, why: 'No moves.' };
  const n = cleanName(b.name);
  if (!n.ok) return n;
  return { ok: true, post: { season: b.season, player: b.player, name: n.name, co: cleanCo(b.co), v: b.v, moves: b.moves } };
}

/** sha-256, hex. */
export async function hash(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
