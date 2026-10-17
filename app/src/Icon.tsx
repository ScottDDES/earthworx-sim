// The prototype's icons and machine drawings, as React elements.

import { ICO, MACH_SVG } from './icons';

export function Icon({ k }: { k: string }) {
  return <svg className="i" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICO[k] ?? '' }} />;
}

export function MachineIcon({ type }: { type: string }) {
  return <svg className="mach" viewBox="0 0 64 32" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MACH_SVG[type] ?? '' }} />;
}

/** The weather icon for a day: mud when the ground's still wet, then rain, cloud or sun by the chance of rain. */
export function WeatherIcon({ pc, wetGround }: { pc: number; wetGround: boolean }) {
  return <Icon k={wetGround ? 'mud' : pc >= 55 ? 'rain' : pc >= 30 ? 'cloud' : 'sun'} />;
}
