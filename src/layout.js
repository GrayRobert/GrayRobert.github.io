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

export const CAMERA_MIN = VIEW_COLS / 2;
export const CAMERA_MAX = WORLD_COLS - VIEW_COLS / 2;
