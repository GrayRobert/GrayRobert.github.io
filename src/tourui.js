// Caption and scene strip for the tour. Real HTML: the strip is a row of buttons and
// the caption has a screen reader copy, so the tour works without seeing the canvas.

import { SCENES } from './tour.js';

const TYPE_RATE = 45; // characters per second

export function createTourUI(onPick, onSkip) {
  const root = document.createElement('div');
  root.className = 'tour';
  root.hidden = true;

  const caption = document.createElement('div');
  caption.className = 'caption';
  caption.setAttribute('aria-hidden', 'true');
  const live = document.createElement('div');
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');

  const strip = document.createElement('nav');
  strip.className = 'strip';
  strip.setAttribute('aria-label', 'Factory tour');
  const buttons = SCENES.map((s, i) => {
    if (s.id === 'boot') return null;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s.name;
    b.addEventListener('click', () => onPick(i));
    strip.append(b);
    return b;
  });
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'skip';
  skip.textContent = 'skip tour ▸▸';
  skip.addEventListener('click', onSkip);
  strip.append(skip);

  root.append(caption, strip, live);
  document.body.append(root);

  let lines = [];
  let started = 0;
  let isLog = false;

  return {
    show() { root.hidden = false; },
    hide() { root.hidden = true; },
    caption(text, { log = false } = {}) {
      lines = Array.isArray(text) ? text : [text];
      isLog = log;
      started = performance.now();
      live.textContent = lines.join('. ');
    },
    setScene(i) {
      buttons.forEach((b, k) => {
        if (!b) return;
        b.classList.toggle('active', k === i);
        b.classList.toggle('done', k < i);
        if (k === i) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
      skip.hidden = i === SCENES.length - 1;
    },
    // Types the caption out, a terminal line at a time.
    update() {
      const n = Math.floor(((performance.now() - started) / 1000) * TYPE_RATE);
      let left = n;
      const shown = lines.map((l) => {
        const part = l.slice(0, Math.max(0, left));
        left -= l.length;
        return part;
      });
      const text = (isLog ? shown.map((l) => (l ? '> ' + l : '')).filter(Boolean) : shown).join('\n');
      const cursor = Math.floor(performance.now() / 400) % 2 ? '▌' : ' ';
      const next = text + cursor;
      if (caption.textContent !== next) caption.textContent = next;
    },
  };
}
