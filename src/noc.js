// The network operations centre: a wall of live graphs, a clock, a rack, a console
// desk and a bed. The OPS robot works the console by day and sleeps by night. At 2am
// a memory leak trips the alarm and it gets up, takes a heap dump, redeploys, and
// goes back to bed. The heap graph shows the leak building all night beforehand.

import { C } from './grid.js';
import { bigText } from './bigtext.js';
import { FLOOR_Y } from './layout.js';
import { hash } from './crew.js';

const X0 = 401; // room walls
const X1 = 468;
const TOP = 11;
const RACK_X = 403;
const DESK_X = 429;
const BED_X = 450;
const AT_DESK = 416; // robot's x when working the console
const BY_BED = 449; // robot's x when getting in or out of bed
const DAY_RATE = 10; // explore mode: factory minutes per real second (a day is about 2.4 minutes)
const BED_TIME = 23 * 60;
const ALERT_TIME = 2 * 60;
const WAKE_TIME = 7 * 60;
const SAMPLES = 38; // graph points: two braille dots per cell across 19 cells

export function createNoc(w, crew) {
  const n = {
    clock: 90, // minutes since midnight
    rate: 0,
    phase: 'sleep', // desk, toBed, sleep, alert, rush, fix, back, toDesk
    t0: 0,
    heapTarget: 0.5,
    series: { cpu: [], heap: [], traffic: [] },
    sampleAt: 0,
    lines: [],
    progress: 0,
    zz: [],
    nextZ: 0,
    nextAlarm: 0,
    typed: 0,
  };
  for (const k of Object.keys(n.series)) n.series[k] = Array(SAMPLES).fill(0.4);

  const bot = () => crew.agents.find((a) => a.id === 'devops');

  function inBed() {
    const a = bot();
    a.hidden = true;
    a.x = BY_BED;
    a.state = 'work';
  }

  function getUp(t) {
    const a = bot();
    a.hidden = false;
    a.x = BY_BED;
    a.wokeAt = t;
  }

  function arrived(x) {
    const a = bot();
    return a.state === 'work' && Math.round(a.x) === x;
  }

  function log(text) {
    n.lines.push(text);
    if (n.lines.length > 4) n.lines.shift();
    n.typed = 0;
  }

  function setPhase(p, t) {
    n.phase = p;
    n.t0 = t;
  }

  function alert(t) {
    setPhase('alert', t);
    n.heapTarget = 0.98;
    n.lines = [];
    log('ALERT heap 98%');
    n.nextAlarm = t;
  }

  function update(t, dt) {
    const a = bot();
    const before = n.clock;
    const incident = ['alert', 'rush', 'fix'].includes(n.phase);
    n.clock = (n.clock + dt * (incident ? 0.5 : n.rate)) % 1440;
    const crossed = (mark) => before < mark && n.clock >= mark;

    // The leak builds through the night and the heap graph creeps up to match.
    if (n.phase === 'sleep' || n.phase === 'toBed') {
      const night = ((n.clock - BED_TIME + 1440) % 1440) / ((ALERT_TIME - BED_TIME + 1440) % 1440);
      n.heapTarget = 0.5 + Math.min(1, night) * 0.42;
    }

    switch (n.phase) {
      case 'desk':
        if (crossed(BED_TIME)) {
          crew.walkTo('devops', BY_BED, t, 10);
          setPhase('toBed', t);
        }
        break;
      case 'toBed':
      case 'back':
        if (arrived(BY_BED)) {
          inBed();
          setPhase('sleep', t);
        }
        break;
      case 'sleep':
        if (crossed(ALERT_TIME)) alert(t);
        else if (crossed(WAKE_TIME)) {
          getUp(t);
          crew.walkTo('devops', AT_DESK, t, 10);
          setPhase('toDesk', t);
        }
        break;
      case 'alert':
        if (t - n.t0 > 0.8 && a.hidden) {
          getUp(t);
          crew.say('devops', 'on it.', t, 1.4);
        }
        if (t - n.t0 > 1.5) {
          crew.walkTo('devops', AT_DESK, t, 24);
          setPhase('rush', t);
        }
        break;
      case 'rush':
        if (arrived(AT_DESK)) {
          setPhase('fix', t);
          log('> heap dump api-2');
        }
        break;
      case 'fix': {
        const e = t - n.t0;
        if (e > 0.9 && n.lines.at(-1) === '> heap dump api-2') n.lines[n.lines.length - 1] += ' ok';
        if (e > 1.3 && !n.lines.includes('> redeploy api-2')) log('> redeploy api-2');
        n.progress = Math.max(0, Math.min(1, (e - 1.4) / 1.8));
        if (e > 3.4 && n.heapTarget > 0.5) {
          n.heapTarget = 0.38;
          log('> health ..... ok');
          w.audio?.approve();
        }
        if (e > 4.4) {
          crew.say('devops', 'back to bed.', t, 1.6);
          crew.walkTo('devops', BY_BED, t, 12);
          setPhase('back', t);
        }
        break;
      }
      case 'toDesk':
        if (arrived(AT_DESK)) {
          setPhase('desk', t);
          n.heapTarget = 0.42;
        }
        break;
    }

    // Alarm keeps sounding until the heap is back to normal.
    if (incident && n.heapTarget > 0.9 && t >= n.nextAlarm) {
      w.audio?.alarm();
      n.nextAlarm = t + 1.3;
    }
    // Typing clicks while console lines appear.
    const last = n.lines.at(-1) ?? '';
    if (n.typed < last.length) {
      n.typed = Math.min(last.length, n.typed + dt * 40);
      if (n.phase === 'fix' && Math.floor(n.typed) % 3 === 0) w.audio?.blip();
    }

    // Live graphs
    if (t >= n.sampleAt) {
      n.sampleAt = t + 0.18;
      const s = n.series;
      const heapNow = s.heap.at(-1);
      push(s.cpu, 0.3 + w.rnd() * 0.15 + (incident ? 0.35 : 0));
      push(s.heap, heapNow + (n.heapTarget - heapNow) * 0.25 + (w.rnd() - 0.5) * 0.02);
      push(s.traffic, 0.45 + Math.sin(t * 0.7) * 0.15 + w.rnd() * 0.08);
    }

    // Zs drift up from the bed while it sleeps.
    if (a.hidden && t >= n.nextZ) {
      n.nextZ = t + 0.9;
      n.zz.push({ x: BED_X + 6, y: FLOOR_Y - 6, born: t, ch: n.zz.length % 2 ? 'Z' : 'z' });
    }
    n.zz = n.zz.filter((z) => t - z.born < 2.6);
  }

  function draw(g, t) {
    const alarm = n.heapTarget > 0.9 && ['alert', 'rush', 'fix'].includes(n.phase);
    const flash = alarm && Math.floor(t * 4) % 2 === 0;
    const wall = alarm ? (flash ? C.red : C.redDim) : C.grey;

    // Room
    g.box(X0, TOP, X1 - X0 + 1, FLOOR_Y - TOP, wall, 'double');
    g.erase(X0 + 1, TOP + 1, X1 - X0 - 1, FLOOR_Y - TOP - 2); // empty, not blank: the braille graphs need empty cells
    g.text(X0 + 2, TOP, ' NOC ', C.steel);
    g.put(434, TOP, '◉', alarm ? (flash ? C.red : C.white) : C.greenDark);

    // Clock
    const hh = String(Math.floor(n.clock / 60)).padStart(2, '0');
    const mm = String(Math.floor(n.clock % 60)).padStart(2, '0');
    bigText(g, 404, TOP + 2, `${hh}:${mm}`, alarm ? (flash ? C.red : C.amber) : C.amber);
    g.text(404, TOP + 5, 'local time', C.amberDim);

    // Status panel
    g.box(436, TOP + 1, 31, 6, alarm ? C.red : C.grey, 'round');
    g.text(438, TOP + 1, ' status ', C.steel);
    if (alarm) {
      g.text(438, TOP + 2, flash ? 'ALERT' : '', C.red);
      g.text(438, TOP + 3, 'heap 98% on api-2', C.red);
      g.text(438, TOP + 4, 'paging: OPS', C.amber);
    } else {
      g.text(438, TOP + 2, 'all green', C.green);
      g.text(438, TOP + 3, 'on call: OPS', C.greenDim);
      g.text(438, TOP + 4, n.phase === 'desk' || n.phase === 'toDesk' ? 'at the console' : 'asleep, phone on', C.steel);
    }

    // Wall of graphs
    graph(g, 403, TOP + 8, 'cpu', n.series.cpu, () => C.cyan);
    graph(g, 425, TOP + 8, 'heap', n.series.heap, (v) => (v > 0.85 ? C.red : v > 0.7 ? C.amber : C.green));
    graph(g, 447, TOP + 8, 'traffic', n.series.traffic, () => C.green);

    // Rack
    const ry = 40;
    g.text(RACK_X, ry, '╔═════════╗', C.grey);
    for (let j = 1; j < 9; j++) {
      g.text(RACK_X, ry + j, j % 2 ? '║`````````║' : '╟─────────╢', C.grey);
      if (j % 2) {
        for (let i = 0; i < 7; i++) {
          const on = hash(Math.floor(t * (3 + j)) * 31 + i * 7 + j) % 4;
          g.put(RACK_X + 2 + i, ry + j, '▪', alarm && i === 3 && j === 3 ? C.red : on === 0 ? C.amber : on === 1 ? C.greenDark : C.green);
        }
      }
    }
    g.text(RACK_X, ry + 9, '╚═════════╝', C.grey);

    // Console desk
    g.box(DESK_X, 39, 19, 6, alarm ? C.red : C.grey, 'round');
    n.lines.forEach((line, i) => {
      const shown = i === n.lines.length - 1 ? line.slice(0, Math.floor(n.typed)) : line;
      g.text(DESK_X + 1, 40 + i, shown.slice(0, 17), line.startsWith('ALERT') ? C.red : C.greenDim);
    });
    if (n.phase === 'fix' && n.progress > 0 && n.progress < 1) {
      const fill = Math.round(n.progress * 15);
      g.text(DESK_X + 1, 43, '[' + '█'.repeat(fill) + '·'.repeat(15 - fill) + ']', C.cyan);
    }
    g.text(DESK_X - 2, 45, '▀'.repeat(23), C.grey);
    for (let y = 46; y < FLOOR_Y; y++) {
      g.put(DESK_X - 1, y, '║', C.greyDark);
      g.put(DESK_X + 19, y, '║', C.greyDark);
    }

    // Bed. When the robot is in it you see a hard hat on the pillow and a breathing blanket.
    const sleeping = bot().hidden;
    const by = FLOOR_Y - 5;
    g.put(BED_X, by, '╻', C.grey);
    g.put(BED_X + 16, by + 1, '╻', C.grey);
    if (sleeping) {
      g.text(BED_X + 2, by, '▗█▖', C.amber);
      g.text(BED_X + 1, by + 1, '(-_-)', alarm ? C.white : C.steel);
      const breathe = Math.floor(t * 0.8) % 2;
      g.text(BED_X + 6, by + 1, breathe ? '▒▒▒▒▒▒▒▒▒▒' : '▒▒▒▒▒▒▒▒▒░', C.steel);
    } else {
      g.text(BED_X + 1, by + 1, '▄▄', C.steel);
      g.text(BED_X + 6, by + 1, '░▒▒░  ░▒▒▒', C.greyDark);
    }
    g.put(BED_X, by + 1, '┃', C.grey);
    g.text(BED_X, by + 2, '╠═══════════════╣', C.grey);
    g.put(BED_X, by + 3, '║', C.grey);
    g.put(BED_X + 16, by + 3, '║', C.grey);
    g.put(BED_X, by + 4, '╨', C.grey);
    g.put(BED_X + 16, by + 4, '╨', C.grey);
  }

  function drawFx(g, t, hits, lit) {
    if (!lit) return;
    for (const z of n.zz) {
      const k = (t - z.born) / 2.6;
      g.put(z.x + Math.sin(k * 6) + k * 3, z.y - k * 4, z.ch, k < 0.6 ? C.cyan : C.cyanDim);
    }
    const a = bot();
    if (a.hidden) {
      hits.push({ id: 'devops', x: BED_X, y: FLOOR_Y - 6, w: 17, h: 6 }); // click the sleeper too
    } else if (a.wokeAt && t - a.wokeAt < 1.2 && a.box) {
      g.put(a.box.x + 6, a.box.y - 1, '!', Math.floor(t * 10) % 2 ? C.red : C.white);
    }
  }

  return {
    update,
    draw,
    drawFx,
    get phase() { return n.phase; },
    // Free running in explore mode, frozen otherwise.
    setRate(free) { n.rate = free ? DAY_RATE : 0; },
    // The tour's set-up: in bed, a few minutes before 2am, with the clock running.
    night(t, minutesBefore = 4, rate = 1.6) {
      inBed();
      n.clock = (ALERT_TIME - minutesBefore + 1440) % 1440;
      n.rate = rate;
      n.heapTarget = 0.9;
      n.series.heap = n.series.heap.map((_, i) => 0.6 + (i / SAMPLES) * 0.28);
      n.lines = ['> nightly backup ok'];
      setPhase('sleep', t);
    },
    reset() {
      inBed();
      n.clock = 23 * 60 + 30; // explore mode reaches 2am about 15 seconds in
      n.rate = 0;
      n.lines = [];
      setPhase('sleep', 0);
    },
  };
}

function push(arr, v) {
  arr.push(Math.max(0.02, Math.min(0.98, v)));
  arr.shift();
}

// A line chart in braille dots: two dots across and four down per cell.
function graph(g, x, y, title, series, colorOf) {
  const w = 21;
  const h = 14;
  g.box(x, y, w, h, C.grey, 'round');
  g.text(x + 2, y, ` ${title} `, C.steel);
  const ih = h - 2;
  let prev = null;
  series.forEach((v, i) => {
    const px = x + 1 + i * 0.5 + 0.25;
    const py = y + 1 + (1 - v) * (ih - 0.01);
    const col = colorOf(v);
    g.dot(px, py, col);
    if (prev !== null) {
      const step = py > prev ? 0.25 : -0.25;
      for (let yy = prev; Math.abs(yy - py) > 0.25; yy += step) g.dot(px, yy, col);
    }
    prev = py;
  });
}
