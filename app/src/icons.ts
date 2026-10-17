// Copied from the prototype by scripts/extract-look.mjs. Don't edit by hand.
/* eslint-disable */
export const MACH_SVG: Record<string, string> = {
  grader:'<path d="M2.5 13h6.5l2-2.5H41v5H12l-2 6.5H2.5z"/><rect x="24" y="14" width="2.4" height="8" rx="1"/><rect x="29" y="14" width="2.4" height="7" rx="1"/><path d="M15.5 27.5l18-5.5 1.2 2.6-18 5.6z"/><path d="M14 22.5h12l-1 1.8H14z"/><path d="M37 1.5h12l1.6 11H37z"/><rect x="39" y="3.5" width="9" height="7" rx="1" fill="var(--glass)"/><rect x="39" y="12" width="23" height="10" rx="2"/><circle cx="6" cy="26.5" r="4.8"/><circle cx="6" cy="26.5" r="1.6" fill="var(--glass)"/><circle cx="44.5" cy="26.5" r="4.8"/><circle cx="44.5" cy="26.5" r="1.6" fill="var(--glass)"/><circle cx="56" cy="26.5" r="4.8"/><circle cx="56" cy="26.5" r="1.6" fill="var(--glass)"/>',
  roller:'<rect x="4" y="8.5" width="20" height="4.5" rx="1.5"/><rect x="21" y="14" width="9" height="5" rx="1"/><path d="M28 12h32a2 2 0 0 1 2 2v8H28z"/><rect x="30" y="0.5" width="19" height="2.5" rx="1"/><rect x="31" y="2" width="2.2" height="10"/><rect x="46" y="2" width="2.2" height="10"/><rect x="33.5" y="3.5" width="12" height="7.5" rx="1" fill="var(--glass)"/><circle cx="13" cy="21" r="10"/><circle cx="13" cy="21" r="3.2" fill="var(--glass)"/><circle cx="52" cy="24.5" r="7"/><circle cx="52" cy="24.5" r="2.4" fill="var(--glass)"/>',
  cart:'<rect x="2" y="7" width="41" height="14" rx="7"/><path d="M46 6h10l6 8v9H46z"/><path d="M49 8.5h6l3.5 5H49z" fill="var(--glass)"/><rect x="2" y="21" width="60" height="3"/><circle cx="10" cy="27" r="4.5"/><circle cx="20" cy="27" r="4.5"/><circle cx="54" cy="27" r="4.5"/>',
  truck:'<path d="M2 5h41v8.5a6.5 6.5 0 0 1-6.5 6.5H8.5A6.5 6.5 0 0 1 2 13.5z"/><rect x="2" y="3.2" width="41" height="1.6" rx=".8"/><rect x="13.5" y="7" width="1.3" height="10" rx=".6" fill="var(--glass)"/><rect x="22" y="7" width="1.3" height="10.5" rx=".6" fill="var(--glass)"/><rect x="30.5" y="7" width="1.3" height="10" rx=".6" fill="var(--glass)"/><path d="M48 5h8l6 8v9H48z"/><path d="M50.5 7.5h5l3.6 5h-8.6z" fill="var(--glass)"/><rect x="45" y="11" width="2" height="11"/><rect x="2" y="21" width="60" height="2.6" rx="1"/><circle cx="8" cy="27.2" r="3.9"/><circle cx="16.5" cy="27.2" r="3.9"/><circle cx="25" cy="27.2" r="3.9"/><circle cx="42.5" cy="27.2" r="3.9"/><circle cx="50.5" cy="27.2" r="3.9"/><circle cx="58.6" cy="27.2" r="3.9"/>'
};
export const ICO: Record<string, string> = {
  yard:'<path d="M3 10l9-6 9 6v10H3z"/><path d="M8 20v-6h8v6"/>',
  work:'<path d="M3 17h18"/><path d="M5 17a7 7 0 0 1 14 0"/><path d="M10 10.5V6h4v4.5"/>',
  market:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  career:'<path d="M4 20h4v-5h4v-5h4V5h4"/>',
  office:'<path d="M4 20h16"/><path d="M7 16v-4M12 16V7M17 16v-7"/><path d="M4 4v16"/>',
  bank:'<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 20h18"/>',
  board:'<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4v1a4 4 0 0 0 4 4"/><path d="M16 6h4v1a4 4 0 0 1-4 4"/><path d="M12 13v4"/><path d="M8 20h8"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
  cloud:'<path d="M7 18h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 11.2 3.4 3.4 0 0 0 7 18z"/>',
  rain:'<path d="M7 14h10a4 4 0 0 0 .4-8A6 6 0 0 0 6 7.2 3.4 3.4 0 0 0 7 14z"/><path d="M8.5 17l-1 3M12.5 17l-1 3M16.5 17l-1 3"/>',
  mud:'<path d="M3 15c3-2 5 2 9 0s6-2 9 0"/><path d="M3 19c3-2 5 2 9 0s6-2 9 0"/><path d="M12 4v6M9 7l3 3 3-3"/>',
  go:'<path d="M5 12h13"/><path d="M13 6l6 6-6 6"/>',
  map:'<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'
};
