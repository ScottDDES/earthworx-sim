// Running costs: what the business costs every week whether it works or not.
// Insurance, your drawings, yard rent, wages, the safety system, toolbox talks. All rise with inflation.

import { ERP_EFFECT, ERP_WEEK } from './advisory';
import { value, type Machine } from './machines';

/** What you pay yourself each week. */
export const DRAWINGS = 800;

/** The safety system levels, from nothing on paper up to ISO 45001. */
export interface WhsLevel {
  n: string;
  d: string;
  /** One-off cost to set it up. */
  cost: number;
  /** Weekly cost to keep it running. */
  wk: number;
  /** Incident risk, relative to nothing written down. */
  risk: number;
  /** Non-price points it earns on a tender. */
  np: number;
  /** How bad an incident gets, relative to a full IMS. */
  sev: number;
  /** The career step it needs. */
  need?: 'won' | 'won2';
}

export const WHS_SYS: readonly WhsLevel[] = [
  { n: 'Nothing written down', d: 'You know the job. Head contractors and councils want it on paper.', cost: 0, wk: 0, risk: 1, np: 0, sev: 1.5 },
  { n: 'SWMS and a WHS plan', d: 'Safe work method statements for each task, a WHS plan, inductions and plant pre-starts.', cost: 2500, wk: 0, risk: 0.85, np: 0, sev: 1.2 },
  { n: 'Full IMS', d: 'Safety, quality and environment in one system: registers, inspections, incident reporting, a yearly review.', cost: 12000, wk: 150, risk: 0.7, np: 2, sev: 1, need: 'won' },
  { n: 'Certified to ISO 45001', d: 'An auditor checks your system every year. Councils score it, and insurers knock 10% off.', cost: 25000, wk: 400, risk: 0.6, np: 4, sev: 0.8, need: 'won2' },
];

/** Toolbox talks cost this per crew per week. */
export const TALKS_PER_CREW = 150;

export function fleetValue(fleet: readonly Machine[], week: number): number {
  return fleet.reduce((a, m) => a + value(m, week), 0);
}

export interface PremiumParts {
  /** Public liability and the rest. */
  base: number;
  /** Plant cover: half a percent a year of what the fleet's worth. */
  plant: number;
  /** Workers' comp: 1.5% of wages. */
  comp: number;
}

export function premParts(fleetVal: number, wageBill: number): PremiumParts {
  return { base: 520, plant: Math.round((fleetVal * 0.005) / 52), comp: Math.round(wageBill * 0.015) };
}

export interface InsuranceState {
  /** Loading from your record: 1 is clean, incidents push it up. */
  ins: number;
  /** Week a hard insurance market ends, if one's on. */
  insHard?: number;
  /** How much a hard market adds. */
  insX?: number;
}

/** The weekly premium. ISO 45001 knocks 10% off; a hard market adds 35%. */
export function premium(parts: PremiumParts, st: InsuranceState, whsSys: number, week: number): number {
  const hard = (st.insHard ?? 0) > week ? (st.insX || 1.35) : 1;
  return Math.round((parts.base + parts.plant + parts.comp) * st.ins * (whsSys >= 3 ? 0.9 : 1) * hard);
}

/** A clean week eases the loading back towards 1. */
export function easeLoading(st: InsuranceState): void {
  if (st.ins > 1) st.ins = Math.max(1, st.ins - 0.004);
}

export interface OverheadInputs {
  /** Running the DDES ERP (advisory.ts). */
  erp?: boolean;
  premium: number;
  rent: number;
  wages: number;
  whsSys: number;
  /** Toolbox talks on? */
  talks: boolean;
  /** Crews out that rain would stop: talks are paid per crew, at least one. */
  crews: number;
  costIdx: number;
}

export function talksCost(talks: boolean, crews: number): number {
  return talks ? TALKS_PER_CREW * Math.max(1, crews) : 0;
}

/** The weekly running costs. */
export function overheads(o: OverheadInputs): number {
  const whsWk = WHS_SYS[o.whsSys]?.wk ?? 0;
  if (!o.erp) return Math.round((o.premium + DRAWINGS + o.rent + o.wages + whsWk + talksCost(o.talks, o.crews)) * o.costIdx);
  const E = ERP_EFFECT;
  return Math.round((o.premium * E.premium + DRAWINGS + o.rent + o.wages + whsWk * E.whs + talksCost(o.talks, o.crews) * E.talks) * o.costIdx * E.all + ERP_WEEK);
}
