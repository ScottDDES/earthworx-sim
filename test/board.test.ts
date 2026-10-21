// The public board's rules: nicknames, company names, and what a score post must look like.

import { describe, expect, it } from 'vitest';
import { allowedOrigin, cleanCo, cleanName, readPost, readReport } from '../server/src/rules';

describe('the board', () => {
  it('takes ordinary nicknames, tidied', () => {
    expect(cleanName('  Scotty   M ')).toEqual({ ok: true, name: 'Scotty M' });
    expect(cleanName("O'Brien-2")).toEqual({ ok: true, name: "O'Brien-2" });
    expect(cleanName('Zoë')).toEqual({ ok: true, name: 'Zoë' });
    // a blocked word hidden inside an innocent one doesn't trip it
    for (const ok of ['Grapevine Grading', 'Skyscape', 'Fagan', 'Mitsubishi', 'Torpedo Earthworks', 'Hancock', 'Dickson Plant']) expect(cleanName(ok).ok, ok).toBe(true);
    for (const bad of ['B1tch Grader', 'kkk crew', 'tw4t']) expect(cleanName(bad).ok, bad).toBe(false);
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

  it('reads a report of a name, and refuses one that names no row or no player', () => {
    expect(readReport({ id: 12, player: 'abcdef0123456789abcd' })).toEqual({ ok: true, id: 12, player: 'abcdef0123456789abcd' });
    for (const bad of [{ id: 0, player: 'abcdef0123456789abcd' }, { id: 1.5, player: 'abcdef0123456789abcd' }, { id: '3', player: 'abcdef0123456789abcd' }, { id: 3, player: 'short' }, { id: 3 }, null, 'report'])
      expect(readReport(bad).ok, JSON.stringify(bad)).toBe(false);
  });

  it('lets the apps and the web version call the board, and nobody else', () => {
    for (const ok of ['https://localhost', 'capacitor://localhost', 'https://earthworx-sim.pages.dev', 'https://abc123.earthworx-sim.pages.dev', 'https://earthworx-sim.scott-6da.workers.dev']) expect(allowedOrigin(ok), ok).toBe(true);
    for (const no of ['https://evil.example', 'https://earthworx-sim.pages.dev.evil.example', 'http://earthworx-sim.pages.dev', 'https://xearthworx-sim.pages.dev']) expect(allowedOrigin(no), no).toBe(false);
  });
});
