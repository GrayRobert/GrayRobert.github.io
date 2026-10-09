// Where everything is. The world is a long line, the screen shows a 180 column window
// onto it, and a camera glides along. Stations run left to right in story order.

export const WORLD_COLS = 400;
export const VIEW_COLS = 180;
export const ROWS = 54;

export const FLOOR_Y = 50; // floor surface
export const BELT_Y = 35; // belt surface. Packages ride on the 3 rows above.
export const BELT_X0 = 3;
export const BELT_X1 = 391;
export const PKG_W = 12;

export const CREW_FLOOR = 49; // feet row under the line
export const CATWALK = 22; // feet row on the catwalk
export const OFFICE = 25; // feet row in the upper rooms

// Zones light up one at a time as the product reaches them.
export const ZONES = [
  { id: 'base', x0: 0, x1: 15 },
  { id: 'why', x0: 15, x1: 75 },
  { id: 'plan', x0: 75, x1: 140 },
  { id: 'design', x0: 140, x1: 190 },
  { id: 'build', x0: 190, x1: 270 },
  { id: 'secure', x0: 270, x1: 315 },
  { id: 'test', x0: 315, x1: 358 },
  { id: 'ship', x0: 358, x1: WORLD_COLS },
];

export function zoneAt(x) {
  for (const z of ZONES) if (x < z.x1) return z.id;
  return 'ship';
}

// Station centres along the belt.
export const STATION = {
  why: 60,
  plan: 122,
  design: 172,
  build: 255,
  secure: 296,
  test: 338,
  ship: 389,
};

// Where the camera centres for each zone.
export const VIEW = {
  base: 90,
  why: 90,
  plan: 120,
  design: 170,
  build: 228,
  secure: 296,
  test: 320,
  ship: 320,
};

// On narrow screens the camera shows fewer columns so text stays readable.
// These centres frame each station for that closer view.
const NARROW = {
  base: 54,
  why: 58,
  plan: 100,
  design: 160,
  build: 226,
  secure: 296,
  test: 334,
  ship: 372,
};

// How many columns fit across the screen right now. Updated on resize.
export const view = { cols: VIEW_COLS };
export const MIN_CELL_CSS = 6; // below this, text is too small to read

export function updateViewCols(width, height) {
  const fitByHeight = height / (ROWS * 1.9); // the cell size the height allows
  const cell = Math.min(width / VIEW_COLS, fitByHeight);
  view.cols = cell >= MIN_CELL_CSS ? VIEW_COLS : Math.max(56, Math.floor(width / Math.min(MIN_CELL_CSS, fitByHeight)));
  view.cols = Math.min(VIEW_COLS, view.cols);
  return view.cols;
}

export const isNarrow = () => view.cols < 140;

// Screen y (CSS px) the world is centred on. On narrow screens the tour caption and
// strip take the bottom of the screen, so the factory sits higher, clear of them.
const NARROW_UI_HEIGHT = 190;
export function screenCentreY(stageHeight) {
  return isNarrow() ? Math.max(0, stageHeight - NARROW_UI_HEIGHT) / 2 + 24 : stageHeight / 2;
}

// Camera centre (and zoom) for a zone, for whichever width is active.
export function viewFor(zone) {
  if (!isNarrow()) return { cx: VIEW[zone], zoom: 1 };
  if (zone === 'base') return { cx: 54, zoom: Math.min(1, view.cols / 84) }; // fit the whole name sign
  return { cx: NARROW[zone], zoom: 1 };
}
