// Caption and scene strip for the tour. Real HTML: the strip is a row of buttons and
// the caption has a screen reader copy, so the tour works without seeing the canvas.

import { SCENES } from './tour.js';

const TYPE_RATE = 45; // characters per second

export function createTourUI(onPick, onSkip, onPause) {
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
  // Pause freezes everything: the factory, the tour and the caption mid-sentence.
  const pause = document.createElement('button');
  pause.type = 'button';
  pause.className = 'pause';
  pause.addEventListener('click', onPause);
  strip.append(pause);

  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'skip';
  skip.textContent = 'skip tour ▸▸';
  skip.addEventListener('click', onSkip);
  strip.append(skip);

  root.append(caption, strip, live);
  document.body.append(root);

  let lines = [];
  let typing = 0; // seconds of typing so far, which stops while paused
  let isLog = false;
  let paused = false;
  let talking = false; // true while the caption is still typing out
  const cursorEl = document.createElement('span');
  cursorEl.className = 'cursor';
  let shownText = null;

  return {
    captionEl: caption,
    get talking() { return talking; },
    show() { root.hidden = false; },
    hide() { root.hidden = true; },
    caption(text, { log = false } = {}) {
      lines = Array.isArray(text) ? text : [text];
      isLog = log;
      typing = paused ? 1e6 : 0; // while paused, a new caption appears in full so it can be read
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
    setPaused(on) {
      paused = on;
      pause.textContent = on ? '▶ play' : '❚❚ pause';
      pause.setAttribute('aria-pressed', String(on));
      pause.classList.toggle('active', on);
    },
    // Types the caption out, a terminal line at a time.
    update(dt) {
      if (!paused) typing += dt;
      const n = Math.floor(typing * TYPE_RATE);
      talking = !paused && n < lines.join('').length;
      let left = n;
      const shown = lines.map((l) => {
        const part = l.slice(0, Math.max(0, left));
        left -= l.length;
        return part;
      });
      const text = (isLog ? shown.map((l) => (l ? '> ' + l : '')).filter(Boolean) : shown).join('\n');
      // The cursor is glued to the last word (a word joiner, so it can never wrap onto a
      // line of its own) and blinks by hiding, not by swapping characters, so the caption
      // never changes size as it blinks.
      const mark = paused ? ' ❚❚' : '▌';
      if (shownText !== text || cursorEl.textContent !== mark) {
        shownText = text;
        cursorEl.textContent = mark;
        caption.replaceChildren(document.createTextNode(text + '⁠'), cursorEl);
      }
      cursorEl.style.visibility = paused || Math.floor(performance.now() / 400) % 2 ? 'visible' : 'hidden';
    },
  };
}
