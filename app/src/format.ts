// Money and numbers, the way the prototype writes them.

/** $12,345 or −$12,345. */
export function f(n: number): string {
  const s = Math.abs(Math.round(n)).toLocaleString('en-AU');
  return (n < 0 ? '−$' : '$') + s;
}

/** $1.25M, $45k, or the full amount under a thousand. */
export function fk(n: number): string {
  if (n >= 1e6) return '$' + Math.round(n / 1e4) / 100 + 'M';
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'k';
  return f(n);
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
