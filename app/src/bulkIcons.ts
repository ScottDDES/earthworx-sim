// Silhouettes for the Bulk and Ag pack's machines, drawn to match the prototype's road gear (64 × 32, filled,
// glass in var(--glass)). One drawing per family; every model in the family uses it.

const hub = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--glass)"/>`;

const DOZER =
  '<path d="M2 8q5 10 0 21h5V8z"/><path d="M7 21l7-4v3l-7 4z"/><rect x="11" y="13" width="41" height="9" rx="1"/><path d="M11 9h17v4H11z"/>' +
  '<path d="M33 1.5h15l2 11.5H33z"/><rect x="35.5" y="3.5" width="11" height="7.5" rx="1" fill="var(--glass)"/><path d="M52 14h4l3 11h-2.4l-2.3-7.5H52z"/>' +
  '<rect x="9" y="22" width="46" height="8.5" rx="4.2"/>' + hub(14, 26.2, 2.2) + hub(24, 26.2, 1.6) + hub(32, 26.2, 1.6) + hub(40, 26.2, 1.6) + hub(50, 26.2, 2.2);

const SCRAPER =
  '<rect x="2" y="12" width="15" height="8" rx="2"/><path d="M7 2.5h10v9.5H7z"/><rect x="8.8" y="4.3" width="6.4" height="6" rx="1" fill="var(--glass)"/>' +
  '<path d="M17 12h12l4 6h-4l-3-3h-9z"/><path d="M28 12h29l4 11H32z"/><rect x="31" y="9.5" width="25" height="2.5" rx="1"/>' +
  '<circle cx="9.5" cy="24" r="7"/>' + hub(9.5, 24, 2.3) + '<circle cx="53" cy="25" r="6.5"/>' + hub(53, 25, 2.1);

const COMPACTOR =
  '<path d="M1 10h4v12H1z"/><path d="M5 15h8v3H5z"/><rect x="18" y="12" width="35" height="8" rx="2"/><path d="M33 2h12l1 10H33z"/>' +
  '<rect x="35" y="4" width="9" height="6.5" rx="1" fill="var(--glass)"/>' +
  '<circle cx="13" cy="23" r="8"/>' + hub(13, 23, 2.6) + '<circle cx="53" cy="23" r="8"/>' + hub(53, 23, 2.6) +
  [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const r = (a * Math.PI) / 180, x1 = 13 + Math.cos(r) * 9.3, y1 = 23 + Math.sin(r) * 9.3, x2 = 53 + Math.cos(r) * 9.3, y2 = 23 + Math.sin(r) * 9.3;
    return `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="1.4"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="1.4"/>`;
  }).join('');

const EXCAVATOR =
  '<rect x="5" y="23" width="35" height="7.5" rx="3.7"/>' + hub(10, 26.7, 1.8) + hub(35, 26.7, 1.8) +
  '<rect x="7" y="14" width="31" height="9" rx="1"/><path d="M24 5h11v9H24z"/><rect x="25.8" y="6.8" width="7.4" height="6" rx="1" fill="var(--glass)"/>' +
  '<path d="M35 15l15-13 3 3-13 11.5z"/><path d="M50 2h3.5l6.5 14-3.2 1.2z"/><path d="M54 16.5h9l-2.5 8.5H55z"/>';

const MOXY_FRONT =
  '<rect x="3" y="12" width="19" height="8" rx="2"/><path d="M5 2.5h12v9.5H5z"/><rect x="7" y="4.3" width="8" height="6" rx="1" fill="var(--glass)"/>' +
  '<rect x="21" y="15" width="5" height="3"/><circle cx="12" cy="25" r="6"/>' + hub(12, 25, 2) +
  '<circle cx="38" cy="25.5" r="5.8"/>' + hub(38, 25.5, 1.9) + '<circle cx="52.5" cy="25.5" r="5.8"/>' + hub(52.5, 25.5, 1.9);
const MOXY = MOXY_FRONT + '<path d="M25 5h37l-3.5 13H27z"/>';
const MOXYCART = MOXY_FRONT + '<rect x="25" y="6" width="37" height="13" rx="6.5"/><rect x="58" y="19" width="5" height="1.6"/>';

export const BULK_SVG: Record<string, string> = {
  d6: DOZER, d8: DOZER, d9: DOZER, d10: DOZER,
  pull: SCRAPER, s623: SCRAPER, s627: SCRAPER, s631: SCRAPER, s637: SCRAPER, s651: SCRAPER, s657: SCRAPER,
  padfoot: COMPACTOR, c815: COMPACTOR, c825: COMPACTOR,
  excavator: EXCAVATOR, moxy: MOXY, moxycart: MOXYCART,
};
