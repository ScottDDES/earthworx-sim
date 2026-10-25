// The prototype's icons and machine drawings, as React elements.

import { ICO, MACH_SVG } from './icons';
import { BULK_SVG } from './bulkIcons';
import { ART_VIEWBOX, MACHINE_ART, MACHINE_GPS, MACHINE_LASER } from './machineArt';

export function Icon({ k }: { k: string }) {
  return <svg className="i" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICO[k] ?? '' }} />;
}

/** A machine's drawing, with its GPS or laser control when fitted. mono: the old one-colour silhouette (the logo on the start and end screens). */
export function MachineIcon({ type, rt, gps, laser, mono }: { type: string; rt?: boolean; gps?: boolean; laser?: boolean; mono?: boolean }) {
  const k = rt ? 'roadtrain' : type;
  if (mono || !MACHINE_ART[k]) return <svg className="mach" viewBox="0 0 64 32" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MACH_SVG[k] ?? BULK_SVG[k] ?? '' }} />;
  const html = MACHINE_ART[k] + (laser ? MACHINE_LASER[k] ?? '' : '') + (gps ? MACHINE_GPS[k] ?? '' : '');
  return <svg className="mach art" viewBox={ART_VIEWBOX} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** The weather icon for a day: mud when the ground's still wet, then rain, cloud or sun by the chance of rain. */
export function WeatherIcon({ pc, wetGround }: { pc: number; wetGround: boolean }) {
  return <Icon k={wetGround ? 'mud' : pc >= 55 ? 'rain' : pc >= 30 ? 'cloud' : 'sun'} />;
}
