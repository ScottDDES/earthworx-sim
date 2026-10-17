// The public board's rules: nicknames, company names, and what a score post must look like.

import { describe, expect, it } from 'vitest';
import { cleanCo, cleanName, readPost } from '../server/src/rules';

describe('the board', () => {
  it('takes ordinary nicknames, tidied', () => {
    expect(cleanName('  Scotty   M ')).toEqual({ ok: true, name: 'Scotty M' });
    expect(cleanName("O'Brien-2")).toEqual({ ok: true, name: "O'Brien-2" });
    expect(cleanName('Zoë')).toEqual({ ok: true, name: 'Zoë' });
    // a blocked word hidden inside an innocent one doesn't trip it
    for (const ok of ['Grapevine Grading', 'Skyscape', 'Fagan', 'Mitsubishi']) expect(cleanName(ok).ok, ok).toBe(true);
  });

  it('refuses names that are too short, too long, marked up or abusive', () => {
    for (const bad of ['', 'x', 'a'.repeat(21), '<b>hi</b>', 'hi@there', 'F U C K', 'sh1t head', 'Hitler99', 7, null]) expect(cleanName(bad).ok, String(bad)).toBe(false);
  });

  it('tidies company names, and swaps a bad one for "A company"', () => {
    expect(cleanCo('Black Soil Earthmoving')).toBe('Black Soil Earthmoving');
    expect(cleanCo('Smith & Sons <script>')).toBe('Smith & Sons script');
    expect(cleanCo('Shit Earthmoving')).toBe('A company');
    expect(cleanCo(undefined)).toBe('A company');
    expect(cleanCo('x'.repeat(60)).length).toBe(40);
  });

  it('reads a post, and refuses one missing what it needs', () => {
    const good = { season: 'wet2010', player: 'abcdef0123456789abcd', name: 'Scott', co: 'Black Soil', v: 1, moves: [['endWeek']] };
    expect(readPost(good)).toEqual({ ok: true, post: good });
    expect(readPost({ ...good, player: 'short' }).ok).toBe(false);
    expect(readPost({ ...good, moves: 'lots' }).ok).toBe(false);
    expect(readPost({ ...good, v: '1' }).ok).toBe(false);
    expect(readPost({ ...good, name: 'x' }).ok).toBe(false);
    expect(readPost('score: 1000000').ok).toBe(false);
  });
});
