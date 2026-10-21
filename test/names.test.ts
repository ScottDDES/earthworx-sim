// Scott's machine names (22 Oct) in the real game; the prototype keeps its own words.

import { afterAll, describe, expect, it } from 'vitest';
import { ROLES, TYPES, an, compat, machineName } from '../src';
import { rw } from '../src/text/real';

describe('machine names', () => {
  afterAll(() => { compat.prototype = true; });

  it('the real game uses Scott\'s names, full and short', () => {
    compat.prototype = false;
    expect([TYPES.cart.name, TYPES.cart.short]).toEqual(['Water Truck 18kL', 'Water Truck']);
    expect([TYPES.pull.name, TYPES.excavator.name, TYPES.moxycart.short, TYPES.grader.name]).toEqual(['Laser Bucket', 'Excavator 30T', 'Water Cart', 'Grader 14ft']);
    expect(machineName({ type: 'roller', multi: true })).toBe('Multi-Tyre Roller');
    expect(machineName({ type: 'truck', rt: true })).toBe('Roadtrain Side Tipper');
    expect(ROLES.cart.name).toBe('Water truck driver');
    expect(rw('Own a grader, roller and water cart')).toBe('Own a grader, roller and water truck');
    expect(rw('A dozer and a moxy water cart')).toBe('A dozer and a moxy water cart');
    expect([an('Excavator'), an('815'), an('D8'), an('Grader')]).toEqual(['an Excavator', 'an 815', 'a D8', 'a Grader']);
  });

  it('the prototype keeps its own', () => {
    compat.prototype = true;
    expect([TYPES.cart.name, TYPES.cart.short, TYPES.pull.name]).toEqual(['Water cart 18kL', 'water cart', 'Tractor and pull scrapers']);
    expect(ROLES.cart.name).toBe('Water cart driver');
    expect(rw('a water cart')).toBe('a water cart');
  });
});
