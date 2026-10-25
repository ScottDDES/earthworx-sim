// A figure grid (the style guide's "figures you can glance at"): two to a line, a narrow label over each figure.

import type { ReactNode } from 'react';

export type Fig = [label: string, value: ReactNode, colour?: string] | null | false | undefined;

export function Figs({ items }: { items: Fig[] }) {
  const xs = items.filter(Boolean) as [string, ReactNode, string?][];
  if (!xs.length) return null;
  return (
    <div className="figs">
      {xs.map(([l, v, col], i) => (
        <div key={i}><small>{l}</small><b className="num" style={col ? { color: col } : undefined}>{v}</b></div>
      ))}
    </div>
  );
}
