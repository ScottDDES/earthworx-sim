// Rewarded ads: a free mechanic on a breakdown, a late invoice paid now, and a weekly top-up. Only in the real
// game, only when the app has an ad ready, never in a season, and always the last choice (Run on never takes it).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AD_TOPUP, adTopUp, adTopUpReady, choose, compat, drawCard, game, RUN_ANSWERS } from '../src';
import { cardView } from '../src/text/cardView';

const career = () => {
  const c = game.newCareer({ co: 'Ad Test', loan: 180000, town: 'gdi' }, 3);
  const g = c.market!.listings.filter((m) => m.type === 'grader').sort((a, b) => a.price - b.price)[0]!;
  game.buy(c, g.id);
  game.open(c);
  return c;
};
const ids = (c: game.Career) => drawCard(c, c.queue[0]!)!.opts.map((o) => o.id);

describe('rewarded ads', () => {
  beforeAll(() => { compat.prototype = false; });
  afterAll(() => { compat.prototype = true; });

  it('a breakdown offers the free mechanic last, only when an ad is ready, and it costs nothing', () => {
    const c = career(), m = c.fleet[0]!;
    m.down = 5;
    c.queue = [{ k: 'break', id: m.id }];
    expect(ids(c)).not.toContain('adFix');
    c.adsOn = true;
    const o = ids(c);
    expect(o.at(-1)).toBe('adFix');
    expect(cardView(c, c.queue[0]!, drawCard(c, c.queue[0]!)!).opts.at(-1)!.label).toContain('Watch an ad');
    const bank = c.bank;
    choose(c, o.length - 1);
    expect(m.down).toBe(0);
    expect(c.bank).toBe(bank);
  });

  it('a late payer can be paid in full now', () => {
    const c = career();
    c.recv.push({ id: 'r1', client: 'Border Civil', amt: 12000, due: c.week - 3 } as never);
    c.queue = [{ k: 'late', id: 'r1' } as never];
    c.adsOn = true;
    const o = ids(c), bank = c.bank;
    expect(o.at(-1)).toBe('adPay');
    expect(RUN_ANSWERS.late).not.toBe('adPay');
    choose(c, o.length - 1);
    expect(c.bank).toBe(bank + 12000);
    expect(c.recv.some((x) => x.id === 'r1')).toBe(false);
  });

  it('the top-up comes once a week', () => {
    const c = career();
    expect(adTopUp(c)).toBe(false);
    c.adsOn = true;
    const bank = c.bank;
    expect(adTopUp(c)).toBe(true);
    expect(adTopUp(c)).toBe(false);
    expect(c.bank).toBe(bank + AD_TOPUP);
    c.week++;
    expect(adTopUpReady(c)).toBe(true);
  });

  it('never in a season, and never in the prototype', () => {
    const c = career(), m = c.fleet[0]!;
    c.adsOn = true;
    c.queue = [{ k: 'break', id: m.id }];
    c.season = { id: 'x' } as never;
    expect(ids(c)).not.toContain('adFix');
    expect(adTopUp(c)).toBe(false);
    delete c.season;
    compat.prototype = true;
    expect(adTopUpReady(c)).toBe(false);
    compat.prototype = false;
  });
});
