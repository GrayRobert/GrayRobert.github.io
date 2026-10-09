// The camera moves the whole world canvas with a CSS transform, so pans and zooms are
// smooth (sub-cell, on the GPU) while the art itself stays on the character grid.

import { ROWS, VIEW_COLS, WORLD_COLS } from './layout.js';

export function createCamera(stage, renderer) {
  const cam = { cx: VIEW_COLS / 2, zoom: 1 };
  let move = null; // { from, to, t0, dur }
  let free = false; // explore mode: the visitor can drag and scroll

  function clampX(cx, zoom) {
    const half = VIEW_COLS / 2 / zoom;
    if (half * 2 >= WORLD_COLS) return WORLD_COLS / 2;
    return Math.max(half, Math.min(WORLD_COLS - half, cx));
  }

  function apply() {
    const { w, h } = renderer.cssCell;
    const tx = stage.clientWidth / 2 - cam.cx * w * cam.zoom;
    const ty = stage.clientHeight / 2 - (ROWS / 2) * h * cam.zoom;
    renderer.layer.style.transform = `translate(${tx}px, ${ty}px) scale(${cam.zoom})`;
  }

  function update(now) {
    if (move) {
      const p = Math.min(1, (now - move.t0) / move.dur);
      const e = easeInOutCubic(p);
      cam.zoom = move.from.zoom + (move.to.zoom - move.from.zoom) * e;
      cam.cx = clampX(move.from.cx + (move.to.cx - move.from.cx) * e, cam.zoom);
      if (p >= 1) move = null;
    }
    apply();
  }

  // Drag to pan in explore mode. A drag that moves more than a few pixels is not a click.
  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    if (!free || e.button !== 0) return;
    drag = { x: e.clientX, cx: cam.cx, moved: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 4) drag.moved = true;
    if (drag.moved) {
      move = null;
      cam.cx = clampX(drag.cx - dx / (renderer.cssCell.w * cam.zoom), cam.zoom);
    }
  });
  window.addEventListener('pointerup', () => {
    if (drag?.moved) suppressClick = true;
    drag = null;
  });
  let suppressClick = false;
  stage.addEventListener('click', (e) => {
    if (suppressClick) { e.stopImmediatePropagation(); suppressClick = false; }
  }, true);

  stage.addEventListener('wheel', (e) => {
    if (!free) return;
    e.preventDefault();
    move = null;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    cam.cx = clampX(cam.cx + d / (renderer.cssCell.w * cam.zoom), cam.zoom);
  }, { passive: false });

  window.addEventListener('resize', apply);

  return {
    update,
    get x() { return cam.cx; },
    get zoom() { return cam.zoom; },
    set free(v) { free = v; },
    get free() { return free; },
    // Glide to a column (and zoom). dur 0 cuts straight there.
    to(cx, { zoom = 1, dur = 1.6, now = 0 } = {}) {
      const target = { cx: clampX(cx, zoom), zoom };
      if (dur <= 0) {
        move = null;
        Object.assign(cam, target);
        apply();
      } else {
        move = { from: { cx: cam.cx, zoom: cam.zoom }, to: target, t0: now, dur };
      }
    },
    // Columns currently on screen, for culling and for keyboard panning.
    get span() {
      const half = VIEW_COLS / 2 / cam.zoom;
      return [cam.cx - half, cam.cx + half];
    },
  };
}

function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}
