// The machines, drawn one by one from Scott's reference photos (25 Oct 2026) as finished side elevations: no
// outlines, form from tone (a lit top, the face, a shaded underside), steel and charcoal in two tones each, tyres with
// tread, glass with a soft reflection. Every model has its own drawing; a family shares its build at stepped sizes.
// 120 × 60, ground at y = 56, facing left. GPS and laser control are drawn over a machine that has them fitted.
// Colours come from CSS (svg.art in phone.css), so the classes are the palette: y yellow, yh lit, yd shaded, yk seam;
// c charcoal, c2 lighter; st steel, stl lit steel; ty tyre, tt tread; rm/rms/rmc rims; gs glass, gr reflection;
// wt white (trucks), tk tank steel, rd red (the farm tractor), am beacon, lt lamp, dm dome, sh shadow.

const tyre = (x: number, y: number, r: number, rim = 'r') =>
  `<circle class="t" cx="${x}" cy="${y}" r="${r}"/><circle class="tr" cx="${x}" cy="${y}" r="${r - 1}"/>` +
  `<circle class="${rim}" cx="${x}" cy="${y}" r="${(r * 0.55).toFixed(2)}"/><circle class="h" cx="${x}" cy="${y}" r="${(r * 0.2).toFixed(2)}"/>`;
/** A steel compactor wheel with tamping feet round it. */
const feet = (x: number, y: number, r: number, n = 14) =>
  Array.from({ length: n }, (_, i) => `<rect class="s" x="${x - 1.3}" y="${y - r - 2.2}" width="2.6" height="3" transform="rotate(${(360 / n) * i} ${x} ${y})"/>`).join('') +
  `<circle class="s" cx="${x}" cy="${y}" r="${r}"/><circle class="k" cx="${x}" cy="${y}" r="${(r * 0.62).toFixed(2)}"/><circle class="h" cx="${x}" cy="${y}" r="${(r * 0.22).toFixed(2)}"/>`;
const glass = (d: string) => `<path class="g" d="${d}"/>`;
const shine = (x: number, y: number, h: number) => `<path class="gl" d="M${x} ${y}h2.4l-2 ${h}h-2.4z"/>`;
const shadow = (x0: number, x1: number) => `<ellipse class="sh" cx="${(x0 + x1) / 2}" cy="56.4" rx="${(x1 - x0) / 2}" ry="1.6"/>`;
/** Scale a drawing about the middle of its ground line, for the sizes within a family. */
const size = (s: number, inner: string) => (s === 1 ? inner : `<g transform="translate(60 56) scale(${s}) translate(-60 -56)">${inner}</g>`);
const stack = (x: number, y: number, h: number) => `<rect class="x" x="${x}" y="${y}" width="2.2" height="${h}"/><rect class="x" x="${x - 0.5}" y="${y - 1}" width="3.2" height="1.6"/>`;
const grille = (x: number, y: number, w: number, h: number, n = 4) =>
  `<rect class="x" x="${x}" y="${y}" width="${w}" height="${h}"/>` + Array.from({ length: n }, (_, i) => `<path class="kl" d="M${x + 0.8} ${y + ((i + 1) * h) / (n + 1)}h${w - 1.6}"/>`).join('');

// ---------- road gear ----------

// ---------- the finished style: no outlines, form from tone ----------
// classes: y yellow, yh lit yellow, yd shaded, yk seam; c charcoal, c2 lighter charcoal; st steel, stl lit steel;
// ty tyre, tt tread, rm rim, rmd rim shade, nut; gs glass, gr glass reflection; am beacon; lt lamp; dm dome, dms dome shade; sh shadow
const tyre2 = (x: number, y: number, r: number) =>
  `<circle class="ty" cx="${x}" cy="${y}" r="${r}"/><circle class="tt" cx="${x}" cy="${y}" r="${r - 1.1}"/>` +
  `<circle class="rm" cx="${x}" cy="${y}" r="${(r * 0.56).toFixed(2)}"/><circle class="rmd" cx="${x}" cy="${y}" r="${(r * 0.45).toFixed(2)}"/>` +
  `<circle class="c" cx="${x}" cy="${y}" r="${(r * 0.2).toFixed(2)}"/>` +
  Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<circle class="nut" cx="${(x + Math.cos(a) * r * 0.32).toFixed(2)}" cy="${(y + Math.sin(a) * r * 0.32).toFixed(2)}" r=".55"/>`; }).join('');

// a modern grader (a 140-class): front counterweight, near-straight front frame, black-framed cab on the hinge,
// tall engine bay behind it, yellow moldboard long and low between the front wheel and the tandem, ripper behind
const GRADER =
  `<ellipse class="sh" cx="60" cy="56.6" rx="58" ry="1.8"/>` +
  // tandem walking beam
  `<path class="c" d="M82 44.5H111Q113.5 44.5 113.5 47V48.4Q113.5 51 111 51H82Z"/>` +
  // engine bay: lit top, seams, shaded skirt, grille
  `<path class="y" d="M80 22.5H112Q115.5 22.5 115.5 26V43.5H80Z"/><path class="yh" d="M80 22.5H112Q114.6 22.5 115.2 24.6H80Z"/>` +
  `<path class="yd" d="M80 38.8H115.5V43.5H80Z"/><path class="yk" d="M91 25.5V37.5M101 25.5V37.5M80.6 31H110"/>` +
  `<rect class="c" x="112" y="26" width="3.5" height="11"/><path class="c2" d="M112.6 28H115M112.6 30.6H115M112.6 33.2H115"/>` +
  `<rect class="c" x="92" y="9" width="2.4" height="14"/><rect class="c2" x="91.4" y="8" width="3.6" height="1.6"/><rect class="c2" x="97" y="16.5" width="3.6" height="6" rx="1.4"/>` +
  // ripper
  `<path class="yd" d="M115.5 33H119V36.5H117.6V49.6L116.2 53.4H115V36.5Z"/><path class="st" d="M115 49H117.6L116.2 53.6H115Z"/>` +
  // hinge
  `<rect class="c" x="65" y="30.5" width="7" height="6"/>` +
  // front frame with a lit top edge and a dark top near the cab
  `<path class="y" d="M7 26.4L66 21V30.4L7 34.6Z"/><path class="yh" d="M7 26.4L66 21V22.4L7 27.8Z"/><path class="yd" d="M7 32.6L66 28.4V30.4L7 34.6Z"/>` +
  `<path class="c" d="M40 24.2L66 21.8V24L40 26.4Z"/>` +
  // front counterweight block with lamp
  `<path class="y" d="M1 23H10V46.5H1Z"/><path class="yh" d="M1 23H10V24.6H1Z"/><path class="yd" d="M8.2 24.6H10V46.5H8.2Z"/><path class="yd" d="M1 42.6H10V46.5H1Z"/>` +
  `<path class="yk" d="M2.6 28H7.4M2.6 31H7.4"/><rect class="lt" x="2.2" y="20.8" width="3.4" height="2.2" rx=".6"/>` +
  // saddle
  `<path class="y" d="M44 19H58L59 22.6H43Z"/><path class="yh" d="M44 19H58L58.3 20H43.7Z"/>` +
  // drawbar, lift cylinders, circle
  `<path class="yd" d="M22 34.4L44 41.2V44L22 37.4Z"/>` +
  `<path class="st" d="M45.6 22H47.6L46.6 42H44.6Z"/><path class="stl" d="M46 30H46.8L46.4 41H45.6Z"/>` +
  `<path class="st" d="M55.4 22H57.4L59.4 42H57.4Z"/><path class="stl" d="M56.6 30H57.4L58.2 41H57.4Z"/>` +
  `<path class="yd" d="M38 41.4H62V44H38Z"/>` +
  // moldboard: lit lip, face, shaded foot, steel cutting edge
  `<path class="y" d="M28 45.6Q46 44.6 64 45.6V51.8Q46 51 28.6 53Z"/><path class="yh" d="M28 45.6Q46 44.6 64 45.6V46.8Q46 45.8 28.1 46.8Z"/>` +
  `<path class="yd" d="M28.4 50.6Q46 49 64 49.8V51.8Q46 51 28.6 53Z"/><path class="st" d="M28.6 52.6Q46 50.6 64 51.4V53.6Q46 52.6 28.8 54.8Z"/>` +
  // cab: charcoal frame, tinted glass with a reflection, beacon
  `<path class="c" d="M64.6 7.6H86L88.6 36H63Z"/><rect class="c2" x="62" y="5.4" width="28.4" height="2.8"/><rect class="am" x="80" y="2.8" width="4" height="2.6" rx="1.2"/>` +
  `<path class="gs" d="M66.6 10H75.6V33.6H65.2Z"/><path class="gs" d="M77.4 10H84.2L86.4 33.6H77.4Z"/>` +
  `<path class="gr" d="M68 10H72L68 33.6H65.3Z"/><path class="gr" d="M79 10H82L79.3 33.6H77.4Z"/>` +
  // steps up to the cab door, and a grab rail
  `<path class="c" d="M63.4 36H64.6V47.6H63.4ZM68 36H69.2V47.6H68Z"/><path class="stl" d="M63.4 39.4H69.2V40.6H63.4ZM63.4 43H69.2V44.2H63.4ZM63.4 46.6H69.2V47.8H63.4Z"/>` +
  `<path class="st" d="M62.2 14H63.2V35H62.2Z"/>` +
  tyre2(19, 46, 10) + tyre2(87, 46, 10) + tyre2(108, 46, 10);
// a single-drum roller (a CS-series): the drum's end is a yellow disc, a low box frame runs at axle height from the
// front bumper back to the hinge, a tall cab up on the engine bay, a drive tyre nearly the drum's size behind
const drumRoller = (pads: boolean) =>
  `<ellipse class="sh" cx="54" cy="56.6" rx="52" ry="1.8"/>` +
  // a padfoot: big blocky pads caked in dirt, standing proud with gaps between, 16 round, a staggered row behind
  (pads ? `<g transform="translate(24 41) scale(.77) translate(-24 -41)">` +
    Array.from({ length: 16 }, (_, i) => `<path class="pdb" d="M22.6 26.4L25.4 26.4L25.1 24.2Q25 23.8 24.6 23.8H23.4Q23 23.8 22.9 24.2Z" transform="rotate(${i * 22.5 + 11.25} 24 41)"/>`).join('') +
    Array.from({ length: 16 }, (_, i) => { const d = i * 22.5; return `<path class="${d >= 290 || d <= 70 ? 'pdl' : 'pd'}" d="M21.8 26.4L26.2 26.4L25.75 22.2Q25.6 21.5 24.9 21.5H23.1Q22.4 21.5 22.25 22.2Z" transform="rotate(${d} 24 41)"/>`; }).join('') : '') +
  // the drum: steel shell, yellow end disc, shading, hub
  `<circle class="st" cx="24" cy="41" r="15"/><path class="stl" d="M10.6 34.4A15 15 0 0 1 33 29L31.6 30.6A13 13 0 0 0 12.4 35.4Z"/>` +
  `<circle class="y" cx="24" cy="41" r="13.4"/><path class="yh" d="M12.2 36A13.4 13.4 0 0 1 31.6 30L30.6 31.2A12 12 0 0 0 13.6 36.6Z"/>` +
  `<path class="yd" d="M12.4 47.6A13.4 13.4 0 0 0 35.6 47.6L34.4 46.8A12 12 0 0 1 13.6 46.8Z"/>` +
  `<circle class="yk" cx="24" cy="41" r="8.4"/><circle class="c2" cx="24" cy="41" r="2.6"/>` +
  (pads ? '</g>' : '') +
  // the box frame at axle height, just past the drum at the front, back to the hinge; bolt holes, bumper, scraper
  `<path class="y" d="M6 35H44V45H6Z"/><path class="yh" d="M6 35H44V36.4H6Z"/><path class="yd" d="M6 42.6H44V45H6Z"/>` +
  `<path class="yd" d="M34 35H41L44 32V45H34Z"/><path class="y" d="M34 35H40L42.4 33V42.6H34Z"/>` +
  [9.5, 13.5, 17.5, 30.5].map((x) => `<circle class="yd" cx="${x}" cy="39.4" r=".8"/>`).join('') +
  `<rect class="c2" x="22" y="37.6" width="4" height="3.6" rx=".6"/>` +
  `<path class="st" d="M4.2 36H6.2V47H4.2Z"/><rect class="lt" x="7" y="33" width="3" height="2" rx=".6"/>` +
  // the hinge
  `<rect class="c" x="42" y="35" width="7" height="9"/>` +
  // engine bay: level with the drum top, sloping down at the back, grille, rear bumper
  `<path class="y" d="M46 26.4H95L102 31V46H46Z"/><path class="yh" d="M46 26.4H95L97.4 27.8H46Z"/><path class="yd" d="M46 42H102V46H46Z"/>` +
  `<path class="yk" d="M76 29V40M88 29V40M70 34H99"/>` +
  `<rect class="c" x="98.6" y="31.6" width="3.4" height="8.4"/><path class="c2" d="M99.2 33.6H101.4M99.2 36H101.4M99.2 38.4H101.4"/>` +
  `<path class="yd" d="M95 41H104V47H95Z"/><rect class="lt" x="100.8" y="28.6" width="2" height="1.6" rx=".4"/>` +
  `<rect class="c" x="74" y="13" width="2.4" height="13.4"/><rect class="c2" x="73.4" y="12" width="3.6" height="1.6"/>` +
  // cab: tall, black-framed, up on the engine bay; steps down its front corner
  `<path class="c" d="M48.6 4.4H69.6L71 28H47.4Z"/><rect class="c2" x="46.2" y="2.4" width="27" height="2.6"/><rect class="am" x="64" y="-0.2" width="4" height="2.6" rx="1.2"/>` +
  `<path class="gs" d="M50.4 7H58.6V25.6H49.6Z"/><path class="gs" d="M60.4 7H67.8L69 25.6H60.4Z"/>` +
  `<path class="gr" d="M51.8 7H55.6L51.6 25.6H49.7Z"/><path class="gr" d="M61.8 7H64.8L61.8 25.6H60.4Z"/>` +
  `<path class="c" d="M48 28H49.2V47.6H48ZM52.6 28H53.8V47.6H52.6Z"/><path class="stl" d="M48 32.6H53.8V33.8H48ZM48 37.4H53.8V38.6H48ZM48 42.2H53.8V43.4H48ZM48 46.6H53.8V47.8H48Z"/>` +
  `<path class="st" d="M46.2 10H47.2V28H46.2Z"/>` +
  tyre2(86, 44, 12.6);

/** A white cab-over truck cab facing left, x0 its front: day cab, big screen, door window, bumper, mirror, beacon. */
const coeCab = (x0: number) =>
  `<path class="wt" d="M${x0 + 1.4} 10H${x0 + 25}V42H${x0}V13Q${x0} 10 ${x0 + 1.4} 10Z"/>` +
  `<path class="wth" d="M${x0 + 1.4} 10H${x0 + 25}V11.4H${x0 + 0.4}Q${x0 + 0.6} 10 ${x0 + 1.4} 10Z"/><path class="wtd" d="M${x0 + 22.6} 11.4H${x0 + 25}V42H${x0 + 22.6}Z"/>` +
  `<path class="gs" d="M${x0 + 0.6} 14H${x0 + 6}V26H${x0 + 0.6}Z"/><path class="gs" d="M${x0 + 8} 14H${x0 + 20}V25H${x0 + 8}Z"/>` +
  `<path class="gr" d="M${x0 + 9.4} 14H${x0 + 12.4}L${x0 + 10} 25H${x0 + 8}Z"/>` +
  `<path class="wtk" d="M${x0 + 7} 13V40M${x0 + 21} 13V40M${x0 + 7} 33H${x0 + 21}"/><rect class="c2" x="${x0 + 17}" y="28" width="2.6" height="1" rx=".4"/>` +
  `<path class="c" d="M${x0 - 1} 36H${x0 + 25}V43H${x0 - 1}Z"/><path class="c2" d="M${x0 - 1} 38.4H${x0 + 6}V40H${x0 - 1}Z"/>` +
  `<rect class="lt" x="${x0 - 0.6}" y="36.6" width="3" height="1.4" rx=".4"/>` +
  `<path class="c" d="M${x0 - 1.6} 14H${x0 - 0.6}V24H${x0 - 1.6}Z"/><rect class="c" x="${x0 - 3}" y="15" width="2.2" height="6" rx=".6"/>` +
  `<path class="c2" d="M${x0 + 2} 7.6H${x0 + 24}V10H${x0 + 2}Z"/><rect class="am" x="${x0 + 14}" y="5.4" width="4" height="2.4" rx="1.1"/>`;

/** A polished alloy truck wheel: low-profile tyre, big rim, fine tread. */
const tyreA = (x: number, y: number, r: number) =>
  `<circle class="ty" cx="${x}" cy="${y}" r="${r}"/><circle class="tt" cx="${x}" cy="${y}" r="${r - 0.55}" style="stroke-width:.8;stroke-dasharray:.8 .6"/>` +
  `<circle class="rmc" cx="${x}" cy="${y}" r="${(r * 0.64).toFixed(2)}"/><circle class="rmcd" cx="${x}" cy="${y}" r="${(r * 0.5).toFixed(2)}" style="stroke-width:.5"/>` +
  `<circle class="c2" cx="${x}" cy="${y}" r="${(r * 0.2).toFixed(2)}"/>` +
  Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4; return `<circle class="c2" cx="${(x + Math.cos(a) * r * 0.34).toFixed(2)}" cy="${(y + Math.sin(a) * r * 0.34).toFixed(2)}" r=".3"/>`; }).join('');
/** A black mudguard over an axle group, from x0 to x1, its top at y. */
const guard = (x0: number, x1: number, y: number) =>
  `<path class="c" d="M${x0} ${y + 4}V${y + 1}Q${x0} ${y} ${x0 + 1} ${y}H${x1 - 1}Q${x1} ${y} ${x1} ${y + 1}V${y + 4}H${x1 - 1}V${y + 1.4}H${x0 + 1}V${y + 4}Z"/>`;

// an 18 kL water cart (a Hino 500-class 6x4 cab-over): single steer, tandem drive, white box tank with a hose reel
// bay at the front, yellow walkway rail along the top, a white arch over the cab, tanks and pump between the axles
const CART =
  `<ellipse class="sh" cx="60" cy="56.6" rx="57" ry="1.8"/>` +
  // chassis, underbody tanks and pump, mudflaps, rear spray bar
  `<rect class="c" x="6" y="42.6" width="108" height="3.4"/>` +
  `<rect class="c" x="56" y="45" width="10" height="6" rx="1"/><rect class="c2" x="67" y="45" width="9" height="5" rx="1"/><rect class="c" x="45" y="45" width="8" height="5" rx=".8"/>` +
  `<rect class="c" x="76.4" y="44" width="1.6" height="7.6"/><rect class="c" x="109" y="44" width="1.6" height="7.6"/>` +
  `<rect class="st" x="109" y="46.6" width="8" height="1.8" rx=".6"/>` +
  // the box tank: white, lit along the top, shaded below, a yellow stripe, seams
  `<path class="wt" d="M36 18H112V42Q112 44 110 44H38Q36 44 36 42Z"/><path class="wth" d="M36 18H112V19.4H36Z"/><path class="wtd" d="M36 38H112V42Q112 44 110 44H38Q36 44 36 42Z"/>` +
  `<rect class="ys" x="36" y="34.4" width="76" height="1.4"/><path class="wtk" d="M56 19V43M84 19V43M111 19V43"/>` +
  // walkway rail along the top, ladder at the back
  `<path class="yr" d="M40 8.6H111M40 13.4H111M40 8.6V18M55 8.6V18M70 8.6V18M85 8.6V18M100 8.6V18M111 8.6V18"/>` +
  `<path class="yr" d="M113 20V44M116 20V44M113 25H116M113 30H116M113 35H116M113 40H116" style="stroke-width:.8"/>` +
  // cab, mirror, steps behind the front wheel
  coeCab(4) +
  `<path class="c" d="M30 36H33V46H30Z"/><path class="stl" d="M30 39H33V40H30ZM30 43H33V44H30Z"/>` +
  tyreA(17, 48.6, 7.6) + tyreA(85, 48.6, 7.6) + tyreA(100, 48.6, 7.6);

/** A bonneted prime mover facing left (Kenworth T900-class): bull bar, long bonnet, day cab and sleeper, twin chrome
 *  stacks, chrome fuel tanks; steer axle and tandem drive. x0 is the bull bar's front. Ground at 56, wheels r. */
const primeMover = (x0: number, r: number) =>
  `<rect class="c" x="${x0 + 2}" y="43.6" width="${46}" height="3"/>` +
  // fuel tanks, steps
  `<rect class="rmc" x="${x0 + 18}" y="43" width="14" height="5" rx="2.4"/><path class="rmcd" d="M${x0 + 22} 43.4V47.6M${x0 + 27} 43.4V47.6"/>` +
  // bonnet with a lit top, guard over the steer wheel, chrome grille, bull bar
  `<path class="wt" d="M${x0 + 3} 33H${x0 + 21}V45H${x0 + 3}Z"/><path class="wth" d="M${x0 + 3} 33H${x0 + 21}V34.2H${x0 + 3}Z"/><path class="wtd" d="M${x0 + 3} 42.4H${x0 + 21}V45H${x0 + 3}Z"/>` +
  `<rect class="rmc" x="${x0 + 2.2}" y="33.6" width="2.2" height="10.4" rx=".6"/><path class="rmcd" d="M${x0 + 2.4} 35.6H${x0 + 4.2}M${x0 + 2.4} 38H${x0 + 4.2}M${x0 + 2.4} 40.4H${x0 + 4.2}"/>` +
  `<path class="bb" d="M${x0 + 1} 37V49M${x0 + 1} 37H${x0 + 3}M${x0 + 1} 42H${x0 + 3}M${x0 + 1} 49H${x0 + 5}"/>` +
  `<rect class="lt" x="${x0 + 3.2}" y="36" width="1.6" height="1.6" rx=".6"/>` +
  // cab and sleeper, windows, stripe
  `<path class="wt" d="M${x0 + 21} 25H${x0 + 30}V45H${x0 + 21}Z"/><path class="wt" d="M${x0 + 30} 22.4Q${x0 + 30} 21 ${x0 + 31.4} 21H${x0 + 40}V45H${x0 + 30}Z"/>` +
  `<path class="wth" d="M${x0 + 21} 25H${x0 + 30}V26H${x0 + 21}Z"/><path class="wtd" d="M${x0 + 38.4} 22.4H${x0 + 40}V45H${x0 + 38.4}Z"/>` +
  `<path class="gs" d="M${x0 + 22.4} 26.8H${x0 + 28.6}V32.6H${x0 + 22.4}Z"/><path class="gr" d="M${x0 + 23.6} 26.8H${x0 + 25.6}L${x0 + 24} 32.6H${x0 + 22.4}Z"/>` +
  `<path class="wtk" d="M${x0 + 30} 26V45M${x0 + 21} 37H${x0 + 40}"/><rect class="ys" x="${x0 + 3}" y="39.6" width="37" height="1.2"/>` +
  `<rect class="c" x="${x0 + 19.2}" y="27" width="1.8" height="5" rx=".6"/>` +
  // twin chrome stacks between cab and sleeper, beacon
  `<rect class="rmc" x="${x0 + 29.6}" y="13" width="1.6" height="30"/><rect class="rmc" x="${x0 + 40.2}" y="13" width="1.6" height="30"/>` +
  `<rect class="am" x="${x0 + 33}" y="19" width="3" height="2" rx=".9"/>` +
  tyreA(x0 + 11, 56 - r, r) +
  `<path class="wt" d="M${x0 + 4.4} 52.4A6.6 6.6 0 0 1 ${x0 + 17.6} 52.4H${x0 + 16.2}A5.2 5.2 0 0 0 ${x0 + 5.8} 52.4Z"/><path class="wtd" d="M${x0 + 5.8} 52.4A5.2 5.2 0 0 1 ${x0 + 16.2} 52.4H${x0 + 15.4}A4.4 4.4 0 0 0 ${x0 + 6.6} 52.4Z"/>` +
  `<rect class="c" x="${x0 + 17.4}" y="47" width="1.2" height="6"/>` +
  tyreA(x0 + 34, 56 - r, r) + tyreA(x0 + 43.2, 56 - r, r) + guard(x0 + 28.6, x0 + 48.6, 46.6);
/** A side-tipper bin on its trailer chassis, from x0 to x1: tall front bulkhead, ribbed sides, tipping rams. */
const tipBin = (x0: number, x1: number, top = 25) =>
  `<rect class="c" x="${x0}" y="42" width="${x1 - x0}" height="3"/>` +
  `<path class="y" d="M${x0} ${top - 2}H${x0 + 3}V${top}H${x1}V42H${x0}Z"/><path class="yh" d="M${x0 + 3} ${top}H${x1}V${top + 1.2}H${x0 + 3}Z"/>` +
  `<path class="yd" d="M${x0} 37.6H${x1}V42H${x0}Z"/>` +
  `<path class="yk" d="M${x0 + 3} ${top + 4.4}H${x1}"/>` +
  Array.from({ length: Math.floor((x1 - x0 - 4) / 6) }, (_, i) => `<path class="yk" d="M${x0 + 6 + i * 6} ${top + 1}V37.6"/>`).join('') +
  `<rect class="st" x="${x0 + 4}" y="40" width="${x1 - x0 - 8}" height="1" rx=".4"/>`;

/** An axle group under a trailer: suspension hangers from the chassis to each hub, the wheels, a guard over them. */
const axles = (xs: number[], top: number) =>
  xs.map((x) => `<rect class="c2" x="${x - 1}" y="${top}" width="2" height="${51.8 - top}"/>`).join('') +
  xs.map((x) => tyreA(x, 51.8, 4.2)).join('') + guard(xs[0]! - 5.4, xs[xs.length - 1]! + 5.4, 46.8);
/** A side tipper bin sat low on its chassis (chassis bottom at 47.4). */
const lowBin = (x0: number, x1: number) => `<g transform="translate(0 2.4)">${tipBin(x0, x1)}</g>`;

// a side tipper: prime mover on a tri-axle side-tipper trailer
const TRUCK =
  `<ellipse class="sh" cx="60" cy="56.6" rx="58" ry="1.6"/>` +
  lowBin(47, 118) + axles([96, 105.2, 114.4], 47.4) +
  `<rect class="c" x="53" y="47.4" width="1.4" height="4.4"/><rect class="c" x="51.6" y="51.4" width="4.2" height="1"/>` +
  primeMover(1, 4.2);
// a road train: prime mover, a side tipper, the converter dolly, a second side tipper
const ROADTRAIN =
  `<ellipse class="sh" cx="60" cy="56.6" rx="59" ry="1.6"/>` +
  `<g transform="translate(1 56) scale(.78) translate(0 -56)">` +
  lowBin(47, 94) + axles([71.6, 80.8, 90], 47.4) +
  `<rect class="c" x="94" y="46.2" width="14" height="2.2"/>` + axles([100, 109.2], 48.4) +
  lowBin(104, 151) + axles([128.6, 137.8, 147], 47.4) +
  primeMover(1, 4.2) + `</g>`;

// a high-drive dozer (a D10-class): raised sprocket, U-blade with tall lift cylinders, long push arms, tall hood
// with twin stacks, black-framed cab, rear deck with a handrail cage, a single-shank ripper behind
const dozer2 = (ripper: boolean) =>
  `<ellipse class="sh" cx="58" cy="56.8" rx="56" ry="1.6"/>` +
  // ripper: parallelogram beams, shank, cylinder
  (ripper
    ? `<path class="yd" d="M90 28L108 36.6L106.8 39.2L89 31Z"/><path class="y" d="M90 38L107 42L106.4 44.6L89.4 40.8Z"/>` +
      `<path class="y" d="M103.4 34H108.6V44L104.6 55.8H102L103.4 44Z"/><path class="yh" d="M103.4 34H108.6V35.2H103.4Z"/><path class="st" d="M102 53.4H104.8L104 56.2H101.4Z"/>` +
      `<path class="c" d="M92 20.6L94 19.6L107 34.6L105.2 35.8Z"/><path class="stl" d="M99.6 27.4L100.6 26.8L104.6 31.6L103.6 32.2Z"/>`
    : `<rect class="yd" x="90" y="36" width="5" height="7"/>`) +
  // a short rear deck behind the cab, with a handrail
  `<path class="y" d="M82 18H94V34H82Z"/><path class="yh" d="M82 18H94V19.4H82Z"/><path class="yd" d="M82 30H94V34H82Z"/><path class="yk" d="M84 22H92M84 26H92"/>` +
  `<path class="rail" d="M85 18V10.4H94V18M85 14H94M89.6 10.4V18"/>` +
  // hood: radiator guard at the front, perforated side panels, ladder, stacks, precleaner; back to the cab
  `<path class="y" d="M17 17H64V41H17Z"/><path class="yh" d="M17 17H64V18.4H17Z"/><path class="yd" d="M17 37H64V41H17Z"/>` +
  `<rect class="c" x="17" y="18.4" width="3.6" height="18"/><path class="c2" d="M17.6 21H20M17.6 24H20M17.6 27H20M17.6 30H20M17.6 33H20"/>` +
  `<path class="yk" d="M24 21H48M24 33H48M24 21V33M48 21V33"/>` + Array.from({ length: 5 }, (_, i) => `<path class="yk" d="M${28 + i * 4} 23.4V30.6"/>`).join('') +
  `<path class="c" d="M53 26H54V40H53ZM57 26H58V40H57Z"/><path class="stl" d="M53 29H58V29.8H53ZM53 32.6H58V33.4H53ZM53 36.2H58V37H53Z"/>` +
  `<path class="c" d="M26.4 17V10Q26.4 8.4 28 8.4H30.2V10H28.4V17Z"/><path class="c" d="M31.4 17V11Q31.4 9.4 33 9.4H35.2V11H33.4V17Z"/>` +
  `<rect class="c2" x="42" y="12" width="4" height="5" rx="1.6"/>` +
  // the body under the cab, down to the track
  `<path class="y" d="M62 25H84V44H62Z"/><path class="yd" d="M62 38H84V44H62Z"/><path class="yk" d="M64 31H82"/>` +
  // cab: black frame, tinted glass, sat over the raised sprocket
  `<path class="c" d="M63.6 5H82.4L83.4 27H62.6Z"/><rect class="c2" x="61.8" y="3" width="22.4" height="2.6"/>` +
  `<path class="gs" d="M65.4 7.6H72.4V24.6H64.8Z"/><path class="gs" d="M74.2 7.6H80.6L81.2 24.6H74.2Z"/>` +
  `<path class="gr" d="M66.6 7.6H69.8L66.2 24.6H64.9Z"/><path class="gr" d="M75.4 7.6H78L75.6 24.6H74.2Z"/>` +
  // the track: high-drive, front and rear idlers low, the sprocket up behind; grousers along the bottom
  `<path class="trk" d="M23 56H87A6.6 6.6 0 0 0 92.4 46.2L87.4 29.8A9 9 0 0 0 70.2 28.6L21 43.2A6.4 6.4 0 0 0 23 56Z"/>` +
  Array.from({ length: 21 }, (_, i) => `<rect class="c" x="${22 + i * 3.2}" y="55.2" width="1.8" height="1.4"/>`).join('') +
  `<path class="trki" d="M24.6 53.2H86.4A4.2 4.2 0 0 0 89.8 47.6L85 31.6A6.6 6.6 0 0 0 72.4 30.8L22.4 45.4A3.9 3.9 0 0 0 24.6 53.2Z"/>` +
  `<path class="yd" d="M62 41H78L80 47H60Z"/>` +
  `<path class="y" d="M27 44.6H84V48.6H27Z"/><path class="yh" d="M27 44.6H84V45.6H27Z"/>` +
  [33, 40, 47, 54, 61, 68, 75].map((x) => `<circle class="y" cx="${x}" cy="50.6" r="2.1"/><circle class="yd" cx="${x}" cy="50.6" r="1.3"/><circle class="c2" cx="${x}" cy="50.6" r=".6"/>`).join('') +
  `<circle class="yd" cx="24.6" cy="49.6" r="5.2"/><circle class="y" cx="24.6" cy="49.6" r="4"/><circle class="c2" cx="24.6" cy="49.6" r="1.2"/>` +
  `<circle class="yd" cx="86" cy="49.8" r="5"/><circle class="y" cx="86" cy="49.8" r="3.8"/><circle class="c2" cx="86" cy="49.8" r="1.2"/>` +
  `<circle class="c" cx="79" cy="33" r="7.6"/><circle class="yd" cx="79" cy="33" r="6.2"/><circle class="y" cx="79" cy="33" r="4.6"/><circle class="c2" cx="79" cy="33" r="1.8"/>` +
  [0, 72, 144, 216, 288].map((a) => `<circle class="yd" cx="${(79 + Math.cos((a * Math.PI) / 180) * 3.2).toFixed(2)}" cy="${(33 + Math.sin((a * Math.PI) / 180) * 3.2).toFixed(2)}" r=".7"/>`).join('') +
  // push arm, trunnion
  `<path class="y" d="M8 46.6L55 43.6V47.6L9 51.6Z"/><path class="yh" d="M8 46.6L55 43.6V44.6L8.2 47.6Z"/><circle class="c2" cx="53" cy="45.6" r="1.4"/>` +
  // the blade: U-blade, black spill guard and end bit, cutting edge
  `<path class="y" d="M4 27H13.4L15 51L6 55.6Q10.4 41 4 27Z"/><path class="yh" d="M4 27H13.4V28.4H4.6Z"/><path class="yd" d="M12 28.6H13.4L15 51L13.6 51.6Z"/>` +
  `<path class="c" d="M3 23.4H13V27H4Z"/><path class="c" d="M5.6 46L14.6 44.6L15 51L6 55.6Q7.6 50.4 5.6 46Z"/>` +
  `<path class="st" d="M5.4 54.4L14.6 50.6L15 51.8L6 56.4Z"/>` +
  // lift cylinders up to the radiator guard, tilt cylinder to the push arm
  `<path class="c" d="M13.4 37L18.6 14.4L20.8 15L15.6 37.6Z"/><path class="stl" d="M14.8 33L16.4 26L17.4 26.3L15.8 33.3Z"/>` +
  `<path class="c" d="M13.6 31L31 43.4L29.8 44.8L12.6 32.6Z"/>`;

/** GPS on a dozer: a black mast on each top corner of the blade, a yellow receiver puck on each, coiled cables back. */
const DOZER_GPS =
  `<rect class="c" x="4.4" y="9" width="1.2" height="14.6"/><rect class="c" x="11" y="11" width="1.2" height="12.6"/>` +
  `<path class="cab" d="M5.6 14Q9 17 16 19M12.2 15Q15 17.4 18 18.6" style="stroke-dasharray:.6 .4"/>` +
  `<rect class="yd" x="3.2" y="7.8" width="3.6" height="1.6" rx=".5"/><rect class="yh" x="3.2" y="7.2" width="3.6" height="1" rx=".5"/>` +
  `<rect class="yd" x="9.8" y="9.8" width="3.6" height="1.6" rx=".5"/><rect class="yh" x="9.8" y="9.2" width="3.6" height="1" rx=".5"/>`;
// a 30-tonne excavator (a 330-class): long low track, slew ring, house about the track's length with a rounded
// counterweight, engine hood with grille panels, handrails, black cab at the front; a banana boom up to its apex and
// down to the stick, the stick angled forward and down, a digging bucket curled under; cylinders black with chrome rods
const EXCAVATOR2 =
  `<ellipse class="sh" cx="56" cy="56.8" rx="54" ry="1.6"/>` +
  // undercarriage: a link-plate track round an idler at the front and a toothed sprocket at the back; dark track frame
  // with bottom rollers and a carrier roller on top
  `<rect class="belt" x="42" y="45.4" width="64" height="10.8" rx="5.4"/>` +
  Array.from({ length: 19 }, (_, i) => `<path class="link" d="M${47.6 + i * 2.9} 45.4V47.2M${47.6 + i * 2.9} 54.4V56.2"/>`).join('') +
  [100, 120, 140, 160, 180, 200, 220, 240, 260].map((a) => { const r = (a * Math.PI) / 180, x = 47.4 + Math.cos(r) * 5.4, y = 50.8 + Math.sin(r) * 5.4, x2 = 47.4 + Math.cos(r) * 3.6, y2 = 50.8 + Math.sin(r) * 3.6; return `<path class="link" d="M${x.toFixed(2)} ${y.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}"/>`; }).join('') +
  [-80, -60, -40, -20, 0, 20, 40, 60, 80].map((a) => { const r = (a * Math.PI) / 180, x = 100.6 + Math.cos(r) * 5.4, y = 50.8 + Math.sin(r) * 5.4, x2 = 100.6 + Math.cos(r) * 3.6, y2 = 50.8 + Math.sin(r) * 3.6; return `<path class="link" d="M${x.toFixed(2)} ${y.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}"/>`; }).join('') +
  `<rect class="c" x="46.6" y="47.4" width="54.6" height="6.8" rx="3.4"/><rect class="c2" x="52" y="47.6" width="44" height="2.6" rx=".6"/>` +
  `<circle class="c2" cx="47.4" cy="50.8" r="3.4"/><circle class="stl" cx="47.4" cy="50.8" r="2.2"/><circle class="c" cx="47.4" cy="50.8" r="1.2"/>` +
  Array.from({ length: 10 }, (_, i) => `<rect class="c2" x="99.9" y="45.9" width="1.4" height="1.6" transform="rotate(${i * 36} 100.6 50.8)"/>`).join('') +
  `<circle class="c2" cx="100.6" cy="50.8" r="3.6"/><circle class="st" cx="100.6" cy="50.8" r="2.2"/><circle class="c" cx="100.6" cy="50.8" r="1"/>` +
  [58, 66, 74, 82, 90].map((x) => `<circle class="c2" cx="${x}" cy="52.6" r="1.5"/><circle class="c" cx="${x}" cy="52.6" r=".6"/>`).join('') +
  `<circle class="c2" cx="74" cy="47" r="1.1"/>` +
  // slew ring, handrails
  `<rect class="c" x="56" y="42.6" width="30" height="3.4"/>` +
  `<path class="yr" d="M74 24V15H100V24M74 19.4H100M83 15V24M92 15V24"/>` +
  // house: deck, rounded counterweight, engine hood with grille panels
  `<path class="y" d="M49 30H92V43.4H49Z"/><path class="yd" d="M49 40H92V43.4H49Z"/>` +
  `<path class="y" d="M88 24H101Q107 24 107 31V37Q107 43.4 100 43.4H88Z"/><path class="yh" d="M88 24H101Q105.4 24 106.4 27H88Z"/><path class="yd" d="M88 39.6H106.6Q105.4 43.4 100 43.4H88Z"/>` +
  `<path class="y" d="M62 24H89V31H62Z"/><path class="yh" d="M62 24H89V25.2H62Z"/>` +
  `<rect class="c" x="66" y="26.6" width="9" height="3.4" rx=".4"/><rect class="c" x="77" y="26.6" width="8" height="3.4" rx=".4"/>` +
  `<path class="c2" d="M67 27.8H74M67 28.9H74M78 27.8H84M78 28.9H84" style="stroke:#4A4D53;stroke-width:.4"/>` +
  `<path class="yk" d="M92 30V42M62 33.4H88"/><rect class="c" x="80" y="20" width="2.2" height="4"/>` +
  // boom: long and heavy, wide at its foot beside the cab, up to its highest point and the knuckle the dipper hangs from
  `<path class="y" d="M52.2 41.2L16.7 7.6A4 4 0 0 1 21.3 2.4L58.8 33.8Z"/><circle class="y" cx="19" cy="5" r="4"/>` +
  `<path class="yh" d="M21.3 2.4L58.8 33.8L57.8 34.8L20.6 3.6Z"/><path class="yd" d="M52.2 41.2L16.7 7.6L18 6.6L53.8 39.8Z"/>` +
  `<path class="cab" d="M55 36.4L19.6 6.6" style="stroke-width:.5"/>` +
  // stick cylinder along the boom's top face to the knuckle
  `<path class="c" d="M45.4 20.6L22.4 1.6L21 3.2L44 22.2Z"/><path class="stl" d="M33.6 11.6L28 7L27.2 7.9L32.8 12.5Z"/><circle class="c2" cx="44.7" cy="21.4" r="1"/>` +
  // the dipper: as thick as the boom at the knuckle, tapering down to the bucket
  `<path class="y" d="M15.7 3.9L22.3 6.1L8.9 41.6L5.1 40.4Z"/><path class="yh" d="M15.7 3.9L17.1 4.4L6.3 40.8L5.1 40.4Z"/><path class="yd" d="M20.9 5.6L22.3 6.1L8.9 41.6L7.8 41.2Z"/>` +
  `<circle class="y" cx="19" cy="5" r="3.6"/><circle class="c2" cx="19" cy="5" r="1.4"/>` +
  // bucket cylinder down the dipper's outer face to the linkage
  `<path class="c" d="M15.8 7.6L17.6 8.2L7.2 38.4L5.4 37.8Z"/><path class="stl" d="M9.8 28.4L10.8 28.8L7.2 38L6.2 37.6Z"/><circle class="c2" cx="16.7" cy="7.9" r=".8"/>` +
  `<path class="st" d="M6.2 38.2L12.6 40.6L11.9 42L5.6 39.6Z"/><path class="st" d="M11.4 39.6L13.4 44.4L12 45L10 40.2Z"/>` +
  // the bucket: curved back, flat floor, cutting edge and teeth to the front, side cutter, curled under
  `<path class="y" d="M7.4 41Q0.6 43.4 1.8 50.6Q2.8 55 8 54.8L17.4 53.6L17.6 50.6Q14.2 48.6 13.4 44.2Z"/>` +
  `<path class="yh" d="M7.4 41Q0.6 43.4 1.8 50.6L3.2 50.4Q2.4 44.6 7.8 42.4Z"/><path class="yd" d="M3.4 52.4Q4.8 54.6 8 54.4L17.4 53.2L17.4 53.6L8 54.8Q2.8 55 1.8 50.6Z"/>` +
  `<path class="yk" d="M4.6 46.6Q8 46.4 11 48.8"/>` +
  `<path class="st" d="M15.6 49.8L17.8 50.4L17.6 53.8L15.4 53.8Z"/>` +
  `<path class="c" d="M17.4 50.8L20.6 51.2L17.6 52.4ZM17.6 52.6L20.8 53.2L17.6 54Z"/>` +
  // cab: black, front-left of the house, in front of the boom foot
  `<path class="c" d="M50 12H65L66.4 43H48.6Z"/><rect class="c2" x="49" y="10.6" width="18" height="2"/>` +
  `<path class="gs" d="M52 14.6H59V31H51.2Z"/><path class="gs" d="M60.6 14.6H63.4L64.2 31H60.6Z"/>` +
  `<path class="gr" d="M53.2 14.6H56.2L52.8 31H51.3Z"/><path class="gr" d="M61.4 14.6H62.6L61.6 31H60.6Z"/>` +
  `<path class="st" d="M47.6 18H48.6V40H47.6Z"/>`;
/** GPS on the excavator: two black masts on the counterweight's back corners, white tips. */
const EXCAVATOR_GPS =
  `<rect class="c" x="96" y="7" width="1.6" height="17"/><rect class="c" x="103" y="9" width="1.6" height="15"/>` +
  `<rect class="dm" x="95.8" y="5.4" width="2" height="2" rx=".6"/><rect class="dm" x="102.8" y="7.4" width="2" height="2" rx=".6"/>` +
  `<path class="cab" d="M97.6 12Q100 16 98 22M104.6 14Q106.4 18 104.6 22" style="stroke-dasharray:.6 .4"/>`;

// a large wheel loader (a 980-class): two big tyres well apart, the bucket on the ground with a flat floor, tall back
// and spill lip, lift arms up to the loader tower over the front tyre, tilt cylinder and link, black-framed cab behind
// the hinge with steps, a long hood with a fender over the rear tyre, black grille and counterweight at the back
const LOADER2 =
  `<ellipse class="sh" cx="62" cy="56.8" rx="53" ry="1.6"/>` +
  // rear: hood, fender over the rear tyre, grille, counterweight, stack
  `<path class="y" d="M70 22.1H108Q112 22.1 112 26.1V41H70Z"/><path class="yh" d="M70 22.1H108Q110.8 22.1 111.6 24.1H70Z"/><path class="yd" d="M70 37.6H112V41H70Z"/>` +
  `<path class="yk" d="M84 25.4V37M96 25.4V37"/><rect class="c" x="109.2" y="25.8" width="3.2" height="12.4"/><path class="c2" d="M109.8 28.2H111.8M109.8 31H111.8M109.8 33.8H111.8"/>` +
  `<path class="y" d="M100 41H116V47.6H104Z"/><path class="yd" d="M100 45H116V47.6H104Z"/><rect class="lt" x="113.6" y="42" width="2" height="1.6" rx=".4"/>` +
  `<path class="y" d="M74.6 41Q76 30.4 90 30.4Q104 30.4 105.4 41H102.6Q101.4 33.2 90 33.2Q78.6 33.2 77.4 41Z"/>` +
  `<rect class="c" x="75.4" y="13.1" width="2.4" height="9"/><rect class="c2" x="74.8" y="12.1" width="3.6" height="1.6"/>` +
  `<path class="rail" d="M78 22.1V16.1H84V22.1"/>` +
  // the hinge and the front frame / loader tower over the front tyre, with its fender
  `<rect class="c" x="52" y="33" width="8" height="10"/>` +
  `<path class="y" d="M52 34H74V44H52Z"/><path class="yd" d="M52 40H74V44H52Z"/>` +
  `<path class="y" d="M38 33H56V41H38Z"/><path class="yh" d="M38 33H56V34.2H38Z"/><path class="yd" d="M38 38.4H56V41H38Z"/>` +
  `<path class="y" d="M45.6 41L49.6 26.2H57V41Z"/><path class="yh" d="M49.6 26.2H57V27.4H49.3Z"/><path class="yd" d="M55.4 27.4H57V41H55.4Z"/>` +
  `<g transform="translate(8 0)"><path class="y" d="M24.4 42Q26 30.4 38 30.4Q50 30.4 51.6 42H48.8Q47.6 33.2 38 33.2Q28.4 33.2 27.2 42Z"/></g>` +
  // cab: black-framed, behind the hinge; steps down to the ground
  `<path class="c" d="M57.6 12H75L76.4 37H56.2Z"/><rect class="c2" x="56.2" y="10" width="21.6" height="2.4"/>` +
  `<path class="gs" d="M59.6 14.6H66V33.6H58.8Z"/><path class="gs" d="M67.8 14.6H73L73.8 33.6H67.8Z"/>` +
  `<path class="gr" d="M60.8 14.6H63.8L60.2 33.6H58.9Z"/><path class="gr" d="M68.8 14.6H71.2L68.8 33.6H67.8Z"/>` +
  `<path class="c" d="M60 37H61.2V53.6H60ZM64.6 37H65.8V53.6H64.6Z"/><path class="stl" d="M60 41H65.8V42.2H60ZM60 45H65.8V46.2H60ZM60 49H65.8V50.2H60ZM60 53H65.8V54.2H60Z"/>` +
  `<path class="st" d="M55 16H56V37H55Z"/>` +
  // lift arm, behind the front wheel, from the tower down to the bucket pivot
  `<path class="y" d="M50.6 27.4L54 30.4L31.6 49L28.6 45.6Z"/><path class="yh" d="M50.6 27.4L51.6 28.3L29.4 46.6L28.6 45.6Z"/><circle class="c2" cx="52" cy="29" r="1.4"/><circle class="c2" cx="30" cy="47.4" r="1.2"/>` +
  // the tyres
  tyre2(46, 44.6, 11.4) + tyre2(90, 44.6, 11.4) +
  // lift arm from the tower down to the bucket pivot; tilt cylinder and link over it
  `<path class="c" d="M48.4 25.2L50 26.8L38.6 35.4L37 33.8Z"/><path class="stl" d="M44 29.4L45 30.4L39.4 34.4L38.4 33.4Z"/>` +
  `<path class="y" d="M38.4 32.6L41 35.6L33.6 40.6L31 37.6Z"/><circle class="c2" cx="39.6" cy="34" r=".9"/>` +
  `<g transform="translate(5 0)">` +
  // the bucket on the ground: flat floor, tall back, spill lip, side plate, cutting edge
  `<path class="y" d="M1.6 55.6H19Q26.8 55.2 27.2 45.6Q27.4 35.6 21 32.4L7.4 33.4Q4.4 42 1.6 54Z"/>` +
  `<path class="yh" d="M7.4 33.4L21 32.4Q24.4 34 26 37.4L24.6 38Q23.2 35.2 20.6 34L8 34.8Z"/><path class="yd" d="M19 55.6Q26.8 55.2 27.2 45.6L25.6 45.6Q25.2 53.4 18.6 54.2Z"/>` +
  `<path class="yk" d="M5.4 47H22.6M9.4 36Q7 44 4.8 54"/>` +
  `<path class="st" d="M0.6 53.6H19.4V56H0.4Z"/><path class="c" d="M7 30.2H20.6L21 32.4L7.4 33.4Z"/>` +
  `</g>`;

// articulated dump trucks (an HM400 / 740-class): the front unit with a sloping hood, black grille, bumper and fender,
// a handrail on the hood, a black-framed cab with a yellow roof and beacon, the hinge behind; the rear unit on a tandem
const adtFront =
  // frame from the cab back to the hinge
  `<path class="y" d="M36 33H48V44H36Z"/><path class="yd" d="M36 40H48V44H36Z"/><rect class="c" x="44" y="36.6" width="6" height="9.4"/>` +
  // a long, heavy bonnet: big black grille, heavy bumper with lamps, handrail
  `<path class="y" d="M1 28.6L19 24.6V41H1Z"/><path class="yh" d="M1 28.6L19 24.6V26L1.2 30Z"/><path class="yd" d="M1 37.4H19V41H1Z"/>` +
  `<rect class="c" x="1" y="29.6" width="4.6" height="10.6" rx=".6"/><path class="c2" d="M1.6 31.6H5M1.6 33.6H5M1.6 35.6H5M1.6 37.6H5"/>` +
  `<path class="y" d="M0.4 41H17V47.4H0.4Z"/><path class="yh" d="M0.4 41H17V42.2H0.4Z"/><path class="c" d="M0.4 45.6H17V47.4H0.4Z"/>` +
  `<rect class="lt" x="6.6" y="30" width="2.6" height="1.8" rx=".5"/><rect class="am" x="13.6" y="42.8" width="2" height="1.4" rx=".4"/>` +
  `<path class="rail" d="M5 28.8V24.2H13V26.6"/>` +
  // yellow body under the cab, down to just above the front tyre
  `<path class="y" d="M17 30H40V37.4H17Z"/><path class="yd" d="M17 35.4H40V37.4H17Z"/>` +
  // cab: black frame, yellow roof, beacon; over the front wheel
  `<path class="c" d="M19.6 12H37L38 31H18.6Z"/><path class="y" d="M18 9.6H39V12.2H18Z"/><path class="yh" d="M18 9.6H39V10.6H18Z"/><rect class="am" x="27" y="7.2" width="4" height="2.6" rx="1.2"/>` +
  `<path class="gs" d="M21.4 14.6H29V28.4H20.6Z"/><path class="gs" d="M30.8 14.6H35.2L35.8 28.4H30.8Z"/>` +
  `<path class="gr" d="M22.6 14.6H25.8L22.2 28.4H20.7Z"/><path class="gr" d="M31.8 14.6H33.6L32 28.4H30.8Z"/>` +
  `<rect class="c" x="16" y="15" width="2" height="5" rx=".6"/>` +
  // mudguard over the front wheel
  `<path class="y" d="M15.6 44.6A12.4 12.4 0 0 1 40.4 44.6H38A10 10 0 0 0 18 44.6Z"/><path class="yd" d="M18 44.6A10 10 0 0 1 38 44.6H37A9 9 0 0 0 19 44.6Z"/>`;
const adt = (body: string) =>
  `<ellipse class="sh" cx="58" cy="56.8" rx="57" ry="1.6"/>` +
  // rear frame, a black mud flap ahead of the rear axles
  `<rect class="c" x="60" y="40" width="49" height="4"/><path class="c" d="M65.6 40H69.4V51H65.6Z"/>` +
  body + tyre2(28, 46.4, 9.6) + adtFront + tyre2(80, 46.4, 9.6) + tyre2(100, 46.4, 9.6);
// the dump tub (an HM400's): canopy reaching over the cab's back, a tall front wall, a straight top edge, side panels,
// a kicked-up tail, the hoist cylinder at the front
const MOXY2 = adt(
  `<path class="y" d="M46 42L48 12.4H99L117 16.4L116 22.6L101 40.6L92 42Z"/>` +
  `<path class="yh" d="M48 12.4H99L117 16.4L116.8 17.6L99 13.8H47.9Z"/><path class="yd" d="M46.4 36H104.8L101 40.6L92 42H46Z"/>` +
  `<path class="yd" d="M54 17H96L110 19.8L103 33H54Z" style="opacity:.35"/><path class="yk" d="M54 17H96L110 19.8L103 33H54Z"/>` +
  `<path class="yk" d="M70 17V33M86 17V33"/>` +
  `<path class="y" d="M42.6 8.6H50V12.6H44.6Z"/><path class="yh" d="M42.6 8.6H50V9.6H43.1Z"/><path class="yd" d="M44.6 11.6H50V12.6H45.2Z"/>` +
  `<path class="c" d="M49 42.4L53.4 27.4L55.2 27.8L50.8 42.8Z"/><path class="stl" d="M51.6 34L52.8 29.6L53.6 29.8L52.4 34.2Z"/>`);
// the water cart: a tall rounded tank with a black stripe, top rail, ladder, spray heads at the back
const MOXYCART2 = adt(
  `<path class="y" d="M46 41V20Q46 15 51 15H110Q115 15 115 20V41Z"/><path class="yh" d="M51 15H110Q114 15 114.8 18H46.2Q47 15 51 15Z"/><path class="yd" d="M46 37H115V41H46Z"/>` +
  `<rect class="c" x="48" y="26" width="65" height="2.6"/><path class="yk" d="M68 18V36M90 18V36"/>` +
  `<path class="rail" d="M52 15V10H108V15M66 10V15M80 10V15M94 10V15"/>` +
  `<path class="rail" d="M111 16V40M113.6 16V40M111 21H113.6M111 26H113.6M111 31H113.6M111 36H113.6"/>` +
  `<rect class="st" x="108" y="41.4" width="9" height="1.6" rx=".5"/><path class="st" d="M110 43V44.6H111.6V43ZM114 43V44.6H115.6V43Z"/>`);

/** A dual farm tractor wheel: the inner tyre just behind, light rim. */
const dual = (x: number, y: number, r: number) =>
  `<circle class="ty" cx="${x + 2}" cy="${y}" r="${r}"/><circle class="ty" cx="${x}" cy="${y}" r="${r}"/><circle class="tt" cx="${x}" cy="${y}" r="${r - 1}" style="stroke-width:1.6;stroke-dasharray:2 1.4"/>` +
  `<circle class="rms" cx="${x}" cy="${y}" r="${(r * 0.55).toFixed(2)}"/><circle class="rmsd" cx="${x}" cy="${y}" r="${(r * 0.42).toFixed(2)}"/><circle class="c2" cx="${x}" cy="${y}" r="${(r * 0.18).toFixed(2)}"/>`;
// the laser bucket: a big 4WD articulated farm tractor on duals (generic farm red) towing a laser bucket (a Horwood
// Bagshaw-style land plane): long low box with a cutting edge, drawbar frame, handle frames on top, small rear wheels,
// the laser mast and receiver it levels from
const PULL2 =
  `<ellipse class="sh" cx="60" cy="56.8" rx="58" ry="1.6"/>` +
  // the bucket: slim and low, red; drawbar from a low hitch to the bucket's bottom front; cutting edge, rear wheels
  `<path class="c" d="M64.6 44.4L75 48.4V50.6L64.6 46.6Z"/>` +
  `<path class="rd" d="M73 42.4H112L114.6 44.4V50H73Z"/><path class="rdh" d="M73 42.4H112L112.8 43.4H73Z"/><path class="rdd" d="M73 47.6H114.6V50H73Z"/>` +
  `<path class="rdk" d="M84 43.4V47M96 43.4V47M106 43.4V47"/>` +
  `<path class="st" d="M72.4 50H114V52H73.4Z"/><path class="c" d="M72.6 51.6H114V52.8H73.2Z"/>` +
  `<circle class="ty" cx="110.6" cy="52.6" r="3.6"/><circle class="rms" cx="110.6" cy="52.6" r="2"/><circle class="c2" cx="110.6" cy="52.6" r=".7"/>` +
  // the tractor: rear fender and body, hitch
  `<path class="rd" d="M44 27H64Q66 27 66 29V41H44Z"/><path class="rdh" d="M44 27H64Q65.6 27 65.9 28.2H44Z"/><path class="rdd" d="M44 38H66V41H44Z"/>` +
  `<path class="rd" d="M44.6 41Q46 29.4 58 29.4Q70 29.4 71.4 41H68.6Q67.4 32.2 58 32.2Q48.6 32.2 47.4 41Z"/>` +
  `<rect class="c" x="63" y="43" width="4" height="4.4"/>` +
  // hood with a black grille, lights, the hinge
  `<path class="rd" d="M2 28L30 25V41H2Z"/><path class="rdh" d="M2 28L30 25V26.4L2.2 29.4Z"/><path class="rdd" d="M2 37.6H30V41H2Z"/>` +
  `<rect class="c" x="2" y="29" width="5.4" height="10" rx=".6"/><path class="c2" d="M2.6 31H7M2.6 33H7M2.6 35H7M2.6 37H7"/>` +
  `<rect class="lt" x="8" y="29.6" width="3" height="1.6" rx=".5"/><rect class="c" x="36" y="33" width="6" height="9"/>` +
  `<path class="rd" d="M10.6 41Q12 29.4 24 29.4Q36 29.4 37.4 41H34.6Q33.4 32.2 24 32.2Q14.6 32.2 13.4 41Z"/>` +
  // cab: black frame, red roof, the tall stack beside it
  `<path class="c" d="M31 10.6H47L48 32H30Z"/><path class="rd" d="M29.6 8.4H48.8V11H29.6Z"/><path class="rdh" d="M29.6 8.4H48.8V9.4H29.6Z"/>` +
  `<path class="gs" d="M32.8 13.2H39.6V29.4H32Z"/><path class="gs" d="M41.4 13.2H45.4L46 29.4H41.4Z"/>` +
  `<path class="gr" d="M34 13.2H37L33.6 29.4H32.1Z"/><path class="gr" d="M42.4 13.2H44L42.6 29.4H41.4Z"/>` +
  `<path class="c" d="M27.4 26V7.4Q27.4 5.6 29.2 5.6H31V7.4H29.4V26Z"/>` +
  dual(24, 45.4, 10.6) + dual(58, 45.4, 10.6);
/** Laser control on the laser bucket: the mast and receiver it levels from, mid-bucket. */
const PULL_LASER =
  `<rect class="st" x="92.4" y="14" width="1.4" height="28.4"/><rect class="c" x="90.4" y="11.6" width="5.4" height="4" rx="1.2"/><rect class="am" x="91.2" y="12.6" width="3.8" height="1.2" rx=".4"/>`;
/** GPS on the laser bucket: a receiver dome on a mast at the bucket's back. */
const PULL_GPS =
  `<rect class="st" x="106" y="16" width="1.4" height="26.4"/><rect class="rdd" x="104.9" y="14.6" width="3.6" height="1.8"/><ellipse class="dm" cx="106.7" cy="14.2" rx="3" ry="1.4"/>`;

// a 623-class elevating scraper, as in the photo: a tall black cab right over the front tyre, a low counterweight
// bumper with steps, a near-level draft beam (the gooseneck) running back at mid height with hoses over it, then
// dropping to the bowl; the elevator a tall frame leaning back from the cutting edge; a long low bowl with a flat top,
// a sloped front edge down to the cutting edge, the rear frame and push block over the rear wheel
const S623 =
  `<ellipse class="sh" cx="58" cy="56.8" rx="57" ry="1.6"/>` +
  `<g transform="translate(-3 0)">` +
  // the elevator, set back inside the bowl: a tall frame leaning back, flights across it, its top frame and drive
  `<path class="yd" d="M64 50L70.6 51.2L92 15.2L85.4 14Z"/><path class="c" d="M65.6 49.4L69.4 50.2L89.6 16.2L85.8 15.4Z"/>` +
  Array.from({ length: 12 }, (_, i) => { const t = (i + 0.5) / 12, x = 67.5 + (87.7 - 67.5) * t, y = 49.8 + (15.8 - 49.8) * t; return `<path d="M${(x - 2.2).toFixed(2)} ${(y - 0.5).toFixed(2)}L${(x + 2.2).toFixed(2)} ${(y + 0.5).toFixed(2)}" style="stroke:#8A8E94;stroke-width:.9;fill:none"/>`; }).join('') +
  `<path class="y" d="M83 11.4H96L95 15.4H84Z"/><path class="yh" d="M83 11.4H96V12.4H83.2Z"/><circle class="c2" cx="90" cy="15" r="2.2"/><circle class="c" cx="90" cy="15" r=".9"/>` +
  `</g>` +
  // the bowl around it: sloped front, side panel up to a flat top, rear frame and push block; cutting edge at the front
  `<path class="y" d="M58 47L64 29H104L112 33V43L106 47Z"/><path class="yh" d="M64 29H104L112 33L111.6 34.2L103.6 30.2H63.6Z"/><path class="yd" d="M59.2 43.6H112V43L106 47H58Z"/>` +
  `<path class="yk" d="M70 33H101L106 35.6V41.4H67.6Z"/><path class="yk" d="M86 33V41.4"/>` +
  `<path class="y" d="M102 23H112V31H102Z"/><path class="yh" d="M102 23H112V24.2H102Z"/>` +
  `<path class="y" d="M108 31H116V43H108Z"/><path class="yh" d="M108 31H116V32.2H108Z"/><path class="yd" d="M108 40H116V43H108Z"/><path class="c" d="M116 33H120V43H116Z"/>` +
  // the trash guard: an angled frame rising at the back of the bowl
  `<path class="yr" d="M99 29L103 15L109 17L107 25M103 15L107 25M101 22H108" style="stroke-width:1.1"/>` +
  `<path class="st" d="M56 49.6H74V52H57.6Z"/><path class="c" d="M58 47H106L105 50H59Z"/>` +
  // the draft beam: near level at mid height from the tractor back, then down to the bowl; hoses over it
  `<path class="y" d="M36 23H58Q62 23 62 27V40H57.4V29Q57.4 28 56.4 28H36Z"/><path class="yh" d="M36 23H58Q61.4 23 61.9 25.6L60.6 25.6Q60.2 24.2 58 24.2H36Z"/>` +
  `<path class="cab" d="M37 22Q46 17 54 19.6Q60 21.4 61 26M37 21Q48 15.4 56 18.6" style="stroke-width:.7"/>` +
  `<path class="c" d="M56 28.6L57.8 28.2L60.6 41L58.8 41.4Z"/><path class="stl" d="M58 34L58.8 33.8L59.8 38.6L59 38.8Z"/>` +
  // tractor: a big bonnet up front with a grille and lamps, steps, the body and fender over the front tyre, tall black cab, stack
  `<path class="y" d="M14 31H40V41H14Z"/><path class="yh" d="M14 31H40V32.2H14Z"/><path class="yd" d="M14 38H40V41H14Z"/>` +
  `<path class="y" d="M15.6 42Q17 31.6 28 31.6Q39 31.6 40.4 42H37.6Q36.4 34.4 28 34.4Q19.6 34.4 18.4 42Z"/>` +
  `<path class="y" d="M0.6 26H17V46.6H0.6Z"/><path class="yh" d="M0.6 26H17V27.4H0.6Z"/><path class="yd" d="M0.6 43H17V46.6H0.6Z"/>` +
  `<rect class="c" x="0.6" y="29" width="4.4" height="12" rx=".6"/><path class="c2" d="M1.2 31.4H4.4M1.2 34H4.4M1.2 36.6H4.4M1.2 39.2H4.4"/>` +
  `<rect class="lt" x="6" y="28.4" width="2.6" height="1.6" rx=".5"/><path class="yk" d="M8 32H15M8 36H15"/>` +
  `<path class="c" d="M9.4 46.6H10.6V54H9.4ZM13 46.6H14.2V54H13Z"/><path class="stl" d="M9.4 49.6H14.2V50.6H9.4ZM9.4 53H14.2V54H9.4Z"/>` +
  `<path class="c" d="M17.6 6.6H35L36 31H16.6Z"/><rect class="c2" x="16.2" y="4.8" width="20.4" height="2.2"/><rect class="am" x="30" y="2.4" width="3.6" height="2.4" rx="1.1"/>` +
  `<path class="gs" d="M19.4 9.4H25.6V28.4H18.8Z"/><path class="gs" d="M27.4 9.4H32.8L33.6 28.4H27.4Z"/>` +
  `<path class="gr" d="M20.6 9.4H23.6L20.2 28.4H18.9Z"/><path class="gr" d="M28.4 9.4H30.4L28.8 28.4H27.4Z"/>` +
  `<rect class="c" x="37" y="13" width="2.2" height="18"/><rect class="c2" x="36.4" y="12" width="3.4" height="1.6"/>` +
  tyre2(28, 45, 11) + tyre2(100, 46, 10);

// wheel tractor-scrapers (a 651 / 657-class), from the side photos: a single-axle tractor with a small front
// counterweight and steps, a tall black cab ahead of a huge tyre, the gooseneck arching up behind the tyre to the draft
// yoke's big round pivot; the long draft arm running down and back along the bowl; the bowl low and long with an apron
// at the front and the ejector frame rising at the back; over the rear wheel either a frame with a push block (open
// bowl) or a second engine with its hood, stacks and handrail (push-pull, with a push-pull bail at the very back)
const wts = (pushPull: boolean) =>
  `<ellipse class="sh" cx="60" cy="56.8" rx="59" ry="1.6"/>` +
  // rear unit
  (pushPull
    ? `<path class="y" d="M90 26H115Q118 26 118 29V42H90Z"/><path class="yh" d="M90 26H115Q117.4 26 117.9 27.4H90Z"/><path class="yd" d="M90 38.6H118V42H90Z"/>` +
      `<rect class="c" x="115.4" y="29" width="2.4" height="8"/>`+`<path class="yk" d="M100 28V37M108 28V37"/>` +
      `<rect class="c" x="97" y="15" width="2.2" height="11"/><rect class="c2" x="96.4" y="14" width="3.4" height="1.6"/><rect class="c" x="102" y="18" width="2.2" height="8"/>` +
      `<path class="rail" d="M106 26V19H116V26M111 19V26"/>` +
      `<path class="c" d="M117 34H120V44H117Z"/>`
    : `<path class="y" d="M92 30H115V41H92Z"/><path class="yh" d="M92 30H115V31.2H92Z"/><path class="yd" d="M92 38H115V41H92Z"/><path class="yk" d="M106 32V37"/>` +
      `<path class="rail" d="M100 30V24H112V30"/><path class="c" d="M115 32H119.6V42H115Z"/>`) +
  // the bowl: low and long, apron at the front, ejector frame rising at the back, cutting edge
  `<path class="y" d="M54 48L58 30H94L100 27V44L92 50H60Z"/><path class="yh" d="M58 30H94L100 27L100 28.4L94.4 31.4H57.7Z"/><path class="yd" d="M55.2 44H100L92 50H60L54 48Z"/>` +
  `<path class="yk" d="M64 34H90V44H62Z"/><path class="yk" d="M77 34V44"/>` +
  `<path class="y" d="M52 32H60L57 48H50Z"/><path class="yh" d="M52 32H60L59.8 33.2H51.8Z"/><path class="yd" d="M57.6 33H60L57 48H55.4Z"/>` +
  `<path class="yr" d="M88 30L92 16L98 18L96 27M92 16L96 27M90 23H97" style="stroke-width:1.1"/>` +
  `<path class="st" d="M50 48H62V50.6H51Z"/>` +
  // gooseneck arching up behind the tyre to the yoke pivot; hoses; the bowl lift cylinder
  `<path class="y" d="M34 30Q34 15 46 15H52Q56 15 56 19V24H50Q48 21 44 21Q40 21 40 30Z"/><path class="yh" d="M34 30Q34 15 46 15H52Q56 15 56 19H54.8Q54.6 16.4 52 16.4H46Q35.4 16.4 35.4 30Z"/>` +
  `<path class="cab" d="M30 20Q38 12 52 13.6" style="stroke-width:.7"/>` +
  `<path class="c" d="M54 20L55.8 20.4L56 32L54.2 32Z"/><path class="stl" d="M54.6 26L55.4 26L55.6 31H54.8Z"/>` +
  // tractor: the 623's big bonnet up front (grille, lamp, panel lines, steps), body, tall black cab ahead of the tyre, fender
  `<path class="y" d="M14 30H34V44H14Z"/><path class="yd" d="M14 40H34V44H14Z"/>` +
  `<path class="y" d="M0.6 26H15.4V46.6H0.6Z"/><path class="yh" d="M0.6 26H15.4V27.4H0.6Z"/><path class="yd" d="M0.6 43H15.4V46.6H0.6Z"/>` +
  `<rect class="c" x="0.6" y="29" width="4.4" height="12" rx=".6"/><path class="c2" d="M1.2 31.4H4.4M1.2 34H4.4M1.2 36.6H4.4M1.2 39.2H4.4"/>` +
  `<rect class="lt" x="6" y="28.4" width="2.6" height="1.6" rx=".5"/><path class="yk" d="M7.6 32H13.6M7.6 36H13.6"/>` +
  `<path class="c" d="M8.4 46.6H9.6V54H8.4ZM12 46.6H13.2V54H12Z"/><path class="stl" d="M8.4 49.6H13.2V50.6H8.4ZM8.4 53H13.2V54H8.4Z"/>` +
  `<path class="c" d="M15.6 12H31L32 32H14.6Z"/><rect class="c2" x="14.4" y="10.2" width="18.4" height="2.2"/><rect class="am" x="25" y="7.8" width="3.6" height="2.4" rx="1.1"/>` +
  `<path class="gs" d="M17.4 14.6H22.8V29.4H16.8Z"/><path class="gs" d="M24.6 14.6H28.8L29.6 29.4H24.6Z"/>` +
  `<path class="gr" d="M18.6 14.6H21.2L18.2 29.4H16.9Z"/><path class="gr" d="M25.6 14.6H27.2L25.8 29.4H24.6Z"/>` +
  `<path class="y" d="M19.4 42Q21 25.6 35 25.6Q49 25.6 50.6 42H47.8Q46.4 28.4 35 28.4Q23.6 28.4 22.2 42Z"/>` +
  tyre2(35, 42.6, 13.4) + tyre2(100, 44, 12);

/** A compactor's steel tamping wheel: a yellow drum with blocky pads all round and a yellow hub. */
const tampWheel = (x: number, y: number, r: number) =>
  Array.from({ length: 18 }, (_, i) => `<path class="yd" d="M${x - 1.2} ${y - r + 0.6}L${x + 1.2} ${y - r + 0.6}L${x + 1} ${y - r - 1.4}Q${x} ${y - r - 1.8} ${x - 1} ${y - r - 1.4}Z" transform="rotate(${i * 20 + 10} ${x} ${y})"/>`).join('') +
  Array.from({ length: 18 }, (_, i) => `<path class="${i * 20 >= 290 || i * 20 <= 70 ? 'yh' : 'y'}" d="M${x - 1.6} ${y - r + 0.6}L${x + 1.6} ${y - r + 0.6}L${x + 1.3} ${y - r - 2.2}Q${x} ${y - r - 2.7} ${x - 1.3} ${y - r - 2.2}Z" transform="rotate(${i * 20} ${x} ${y})"/>`).join('') +
  `<circle class="yd" cx="${x}" cy="${y}" r="${r}"/><circle class="y" cx="${x}" cy="${y}" r="${(r - 1.2).toFixed(2)}"/>` +
  `<circle class="yk" cx="${x}" cy="${y}" r="${(r * 0.6).toFixed(2)}"/><circle class="yd" cx="${x}" cy="${y}" r="${(r * 0.3).toFixed(2)}"/><circle class="c2" cx="${x}" cy="${y}" r="${(r * 0.12).toFixed(2)}"/>`;
// a soil compactor (an 815 / 825-class), from the photos: a low dozer blade on push arms with a lift cylinder, steel
// tamping wheels front and rear, the front frame with its tower, a black-framed cab in the middle with steps and rails,
// a long boxy engine hood behind with a grille and the stack, a rear bumper
const COMPACTOR2 =
  `<ellipse class="sh" cx="49" cy="56.8" rx="48" ry="1.6"/>` +
  // engine hood behind the cab (a third shorter), grille, rear bumper, stack, rail
  `<path class="y" d="M56 25H91Q95 25 95 29V43H56Z"/><path class="yh" d="M56 25H91Q94.4 25 94.9 27H56Z"/><path class="yd" d="M56 39.6H95V43H56Z"/>` +
  `<path class="yk" d="M70 27.4V39M82 27.4V39M58 32H93"/><rect class="c" x="92" y="28.6" width="3" height="9"/><path class="c2" d="M92.5 30.6H94.6M92.5 33H94.6M92.5 35.4H94.6"/>` +
  `<path class="y" d="M82 43H97V47.6H86Z"/><path class="yd" d="M82 45.6H97V47.6H86Z"/><rect class="lt" x="94.8" y="44" width="2" height="1.4" rx=".4"/>` +
  `<rect class="c" x="74" y="12" width="3.4" height="13"/><path class="rail" d="M60 25V19H70V25M65 19V25"/>` +
  // front frame and tower, the hinge
  `<path class="y" d="M24 30H44V42H24Z"/><path class="yh" d="M24 30H44V31.2H24Z"/><path class="yd" d="M24 38.6H44V42H24Z"/>` +
  `<path class="y" d="M30 22H38V30H30Z"/><path class="yh" d="M30 22H38V23.2H30Z"/><rect class="c" x="42" y="34" width="8" height="10"/>` +
  // cab: black frame, beacon; steps and a rail between the wheels
  `<path class="c" d="M40.6 6H58L59 33H39.6Z"/><rect class="y" x="39.4" y="4.4" width="20.4" height="2"/><rect class="am" x="46" y="2" width="3.6" height="2.4" rx="1.1"/>` +
  `<path class="gs" d="M42.4 8.6H49V30.4H41.8Z"/><path class="gs" d="M50.8 8.6H56L56.8 30.4H50.8Z"/>` +
  `<path class="gr" d="M43.6 8.6H46.6L43.2 30.4H41.9Z"/><path class="gr" d="M51.8 8.6H53.8L52.2 30.4H50.8Z"/>` +
  `<path class="c" d="M52 33H53.2V50H52ZM56.6 33H57.8V50H56.6Z"/><path class="stl" d="M52 37H57.8V38.2H52ZM52 41.4H57.8V42.6H52ZM52 45.8H57.8V47H52Z"/>` +
  `<path class="st" d="M38.4 12H39.4V33H38.4Z"/>` +
  // the wheels
  tampWheel(30, 45.4, 9) + tampWheel(78, 45.4, 9) +
  // push arm and lift cylinder to the blade
  `<path class="y" d="M30 44L8 46.6L8.4 49.2L30.4 46.8Z"/><path class="c" d="M31 27L14 38.4L15.2 40L32.2 28.6Z"/><path class="stl" d="M22 33L17 36.4L17.6 37.2L22.6 33.8Z"/>` +
  // the blade: low, with a cutting edge
  `<path class="y" d="M3 34H11L12 50L4.6 55Q8 44 3 34Z"/><path class="yh" d="M3 34H11V35.2H3.6Z"/><path class="yd" d="M10 35.2H11L12 50L10.8 50.6Z"/>` +
  `<path class="st" d="M4 54L11.8 49.6L12.2 51L5 56Z"/>`;

/** GPS on the grader: a mast on each end of the moldboard, a receiver dome on top. */
const GRADER_GPS =
  `<path class="y" d="M29.6 45.4H31.4V11H29.6Z"/><path class="yh" d="M29.6 45.4H30.2V11H29.6Z"/>` +
  `<path class="y" d="M60.4 45.4H62.2V2H60.4Z"/><path class="yh" d="M60.4 45.4H61V2H60.4Z"/>` +
  `<path class="cab" d="M31.4 30Q34 37 32.4 45M62.2 22Q64.4 31 62.6 45"/>` +
  `<rect class="yd" x="28.6" y="9" width="3.8" height="2.4"/><ellipse class="dm" cx="30.5" cy="8.4" rx="3.2" ry="1.8"/><path class="dms" d="M27.3 8.4A3.2 1.8 0 0 0 33.7 8.4Z"/>` +
  `<rect class="yd" x="59.4" y="1.8" width="3.8" height="2.2"/><ellipse class="dm" cx="61.3" cy="1.6" rx="3.2" ry="1.4"/><path class="dms" d="M58.1 1.6A3.2 1.4 0 0 0 64.5 1.6Z"/>`;

/** Each machine type's drawing (and the roadtrain), keyed as the engine names them. */
export const MACHINE_ART: Record<string, string> = {
  grader: GRADER,
  roller: drumRoller(false),
  padfoot: drumRoller(true),
  cart: CART,
  truck: TRUCK,
  roadtrain: ROADTRAIN,
  d6: size(0.8, dozer2(false)),
  d8: size(0.88, dozer2(true)),
  d9: size(0.94, dozer2(true)),
  d10: dozer2(true),
  pull: PULL2,
  s623: S623,
  s627: size(0.84, wts(true)),
  s631: size(0.9, wts(false)),
  s637: size(0.9, wts(true)),
  s651: wts(false),
  s657: wts(true),
  c815: size(0.9, COMPACTOR2),
  c825: COMPACTOR2,
  excavator: EXCAVATOR2,
  moxy: MOXY2,
  moxycart: MOXYCART2,
  loader: LOADER2,
};
/** Extras drawn over a machine when it has them fitted. */
export const MACHINE_GPS: Record<string, string> = {
  grader: GRADER_GPS,
  excavator: EXCAVATOR_GPS,
  pull: PULL_GPS,
  d6: size(0.8, DOZER_GPS), d8: size(0.88, DOZER_GPS), d9: size(0.94, DOZER_GPS), d10: DOZER_GPS,
};
/** Laser control, drawn over a machine that has it fitted. */
export const MACHINE_LASER: Record<string, string> = { pull: PULL_LASER };
export const ART_VIEWBOX = '0 0 120 60';
