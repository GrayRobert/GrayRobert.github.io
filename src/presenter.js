// ROB: a robot version of Robert who presents the intro. While the camera is zoomed
// out, robots in the factory are tiny, so ROB is drawn full size on his own small
// canvas next to the caption, with the same renderer and glow. His mouth moves while
// the caption types out.

import { createGrid, C } from './grid.js';
import { createRenderer } from './renderer.js';
import { makeRobot, W } from './robots.js';

const COLS = W + 2;
const ROWS = 13;

export function createPresenter(stage, mainRenderer, captionEl) {
  const grid = createGrid(COLS, ROWS);
  const renderer = createRenderer(stage, grid, { cell: () => mainRenderer.cell, className: 'presenter' });
  renderer.layer.setAttribute('aria-hidden', 'true');
  const rob = makeRobot({ label: 'ROB', antenna: 'tip', head: 'monitor', accent: C.green });
  let visible = false;
  let since = 0;

  // Beside the caption on wide screens, above it on narrow ones.
  function place() {
    const cap = captionEl.getBoundingClientRect();
    const { w, h } = mainRenderer.cssCell;
    const width = COLS * w;
    const height = ROWS * h;
    const roomLeft = cap.left - width - 16 > 8;
    const left = roomLeft ? cap.left - width - 12 : cap.left + cap.width / 2 - width / 2;
    const top = roomLeft ? cap.bottom - height : cap.top - height - 6;
    renderer.layer.style.transform = `translate(${left}px, ${top}px)`;
    captionEl.classList.toggle('from-rob-left', visible && roomLeft);
    captionEl.classList.toggle('from-rob-above', visible && !roomLeft);
  }

  return {
    setVisible(on, t) {
      if (on === visible) return;
      visible = on;
      since = t;
      renderer.layer.classList.toggle('on', on);
      if (!on) captionEl.classList.remove('from-rob-left', 'from-rob-above');
    },
    draw(t, talking) {
      if (!visible) return;
      place();
      grid.clear();
      const blink = !talking && (t * 0.6) % 1 < 0.06;
      rob(grid, 1, ROWS - 1, {
        t,
        mouth: talking ? (Math.floor(t * 9) % 3 === 0 ? 'smile' : 'open') : 'smile',
        blink,
        chest: Math.floor(t * 6),
        tip: Math.floor(t * 2) % 2 === 0,
        arm: talking && t - since < 1.4 ? 'wave' : 'down', // a wave hello as he starts
      });
      renderer.paint();
    },
  };
}
