// The ten robots: who they are, where they work, how they idle, and their station props.
// CV text lives in content.json. This file only knows names, places and behaviour.

import { C } from './grid.js';
import { makeRobot, W } from './robots.js';
import content from './content.json';

const TITLES = Object.fromEntries(content.agents.map((a) => [a.id, a.title]));

export const CREW_FLOOR = 49; // feet row under the line
export const CATWALK = 22; // feet row on the catwalk
export const OFFICE = 25; // feet row in the upper offices

// wake: seconds after power on. min/max: patrol range (left x). arm: pose while working.
const ROLES = [
  {
    id: 'ceo', feet: OFFICE, min: 16, max: 18, speed: 4, wake: 0.9, arm: 'down',
    robot: { label: 'CEO', antenna: 'dish', head: 'dome', body: 'tall', tool: 'clipboard', accent: C.amber },
    quips: ['love the energy.', 'vision: delivered.', 'numbers look good.'],
  },
  {
    id: 'cto', feet: OFFICE, min: 135, max: 137, speed: 4, wake: 1.5, arm: 'down',
    robot: { label: 'CTO', antenna: 'tip', head: 'monitor', accent: C.green },
    quips: ['all green.', 'hmm. one odd log line.', 'keep it simple.', 'checking. again.'],
  },
  {
    id: 'pm', feet: CATWALK, min: 49, max: 66, speed: 7, wake: 1.2, arm: 'up', walkArm: 'up',
    robot: { label: 'PM', antenna: 'twin', head: 'square', tool: 'kanban', accent: C.amber },
    quips: ['blocker cleared.', 'on track.', 'milestone!'],
  },
  {
    id: 'design', feet: CATWALK, min: 78, max: 96, speed: 5, wake: 1.35, arm: 'up', sketches: true,
    robot: { label: 'UX', antenna: 'none', head: 'beret', body: 'slim', tool: 'stylus', accent: C.cyan },
    quips: ['one char to the left.', 'more whitespace.', 'better.'],
  },
  {
    id: 'backend', feet: CREW_FLOOR, min: 33, max: 36, speed: 4, wake: 2.3, arm: 'reach',
    robot: { label: 'API', antenna: 'tip', head: 'goggles', body: 'wide', accent: C.green },
    quips: ['schema migrated.', 'query is fast now.', 'pipes are flowing.'],
  },
  {
    id: 'frontend', feet: CREW_FLOOR, min: 58, max: 60, speed: 4, wake: 2.45, arm: 'reach',
    robot: { label: 'UI', antenna: 'twin', head: 'round', tool: 'palette', accent: C.cyan },
    quips: ['pixel perfect.', 'dark mode, obviously.', 'snaps right in.'],
  },
  {
    id: 'fullstack', feet: CREW_FLOOR, min: 40, max: 96, stops: [47, 75], speed: 16, wake: 2.6, arm: 'down', front: true,
    robot: { label: 'FULL', antenna: 'tip', head: 'split', legs: 'wheel', tool: 'bridge', accent: C.white },
    quips: ['on my way!', 'both ends covered.', 'need a hand?'],
  },
  {
    id: 'qa', feet: CREW_FLOOR, min: 89, max: 92, speed: 4, wake: 2.75, arm: 'reach',
    robot: { label: 'QA', antenna: 'none', head: 'mono', tool: 'magnifier', accent: C.green, eye: '◎' },
    quips: ['found one.', 'not ignoring that.', 'passes. for now.'],
  },
  {
    id: 'devops', feet: CREW_FLOOR, min: 116, max: 134, speed: 6, wake: 2.9, arm: 'reach', cable: true,
    robot: { label: 'OPS', antenna: 'none', head: 'hardhat', body: 'stocky', legs: 'treads', tool: 'plug', accent: C.amber },
    quips: ['deploying.', 'it is 2am somewhere.', 'rack is happy.'],
  },
  {
    id: 'security', feet: CREW_FLOOR, min: 15, max: 19, speed: 4, wake: 2.15, arm: 'down',
    robot: { label: 'SEC', antenna: 'none', head: 'visor', body: 'heavy', tool: 'shield', accent: C.red },
    quips: ['access denied.', 'nice try.', 'perimeter secure.'],
  },
];

const DB_X = 49;
const UI_X = 77;
const BIN_X = 106;
const RACK_X = 150;

export function createCrew(rnd, audio) {
  const agents = ROLES.map((r) => ({
    ...r,
    draw: makeRobot(r.robot),
    x: r.min + Math.floor(rnd() * (r.max - r.min + 1)),
    from: 0, to: 0, t0: 0, dur: 0,
    state: 'work', until: 1 + rnd() * 3, dir: 1, box: null,
  }));
  const sketches = [];
  let speaker = null; // only one robot talks at a time
  let nextTalk = 4;

  function update(t, awakeAt) {
    for (const a of agents) {
      if (!awakeAt(a.wake)) continue;
      if (a.state === 'walk') {
        const p = Math.min(1, (t - a.t0) / a.dur);
        a.x = a.from + (a.to - a.from) * easeInOutSine(p);
        if (p >= 1) {
          a.state = 'work';
          a.until = t + 1.5 + rnd() * 3.5;
        }
      } else if (t > a.until && a !== speaker?.agent) {
        let to = a.x;
        if (a.stops) to = a.stops.find((s) => Math.abs(s - a.x) > 3) ?? a.x; // shuttle between docking spots
        for (let i = 0; i < 8 && !a.stops && Math.abs(to - a.x) < 3; i++) to = a.min + Math.floor(rnd() * (a.max - a.min + 1));
        if (to === a.x) { a.until = t + 2; continue; }
        Object.assign(a, { from: a.x, to, t0: t, dur: Math.abs(to - a.x) / a.speed + 0.5, dir: Math.sign(to - a.x), state: 'walk' });
      }

      // The designer sketches boxes in the air while working.
      if (a.sketches && a.state === 'work' && a.box && (a.nextSketch ?? 0) < t) {
        a.nextSketch = t + 1.4 + rnd();
        sketches.push({ x: a.box.rh.x + 3 + Math.floor(rnd() * 4), y: a.box.rh.y - 3 - Math.floor(rnd() * 3), w: 4 + Math.floor(rnd() * 3), born: t });
      }
    }
    for (let i = sketches.length - 1; i >= 0; i--) if (t - sketches[i].born > 2.6) sketches.splice(i, 1);

    // Someone idle says something every few seconds.
    if (speaker && t > speaker.end) speaker = null;
    if (!speaker && t > nextTalk) {
      const idle = agents.filter((a) => a.state === 'work' && awakeAt(a.wake));
      if (idle.length) {
        const a = idle[Math.floor(rnd() * idle.length)];
        const text = a.quips[Math.floor(rnd() * a.quips.length)];
        speaker = { agent: a, text, start: t + 0.3, end: t + 0.3 + 1 + text.length * 0.06 + 1.6, typed: 0 };
        a.until = Math.max(a.until, speaker.end);
      }
      nextTalk = t + 4 + rnd() * 4;
    }
    if (speaker && audio) {
      const n = Math.floor((t - speaker.start) * 28);
      while (speaker.typed < Math.min(n, speaker.text.length)) {
        if (speaker.typed % 2 === 0 && speaker.text[speaker.typed] !== ' ') audio.blip();
        speaker.typed++;
      }
    }
  }

  // layer: 'upper' (offices and catwalk) or 'floor' (under the line)
  function draw(g, t, layer, { awakeAt, hover, hits }) {
    const upper = layer === 'upper';
    if (!upper) drawProps(g, t, awakeAt);
    const list = agents.filter((a) => (a.feet === CREW_FLOOR) !== upper);
    // Robots that roam in front are drawn last.
    list.sort((a, b) => (a.front ? 1 : 0) - (b.front ? 1 : 0));
    for (const a of list) {
      const awake = awakeAt(a.wake);
      const walking = a.state === 'walk';
      const phase = walking ? Math.floor(Math.abs(a.x - a.from) / 1.6) % 4 : 0;
      const talking = speaker?.agent === a && t > speaker.start;
      const x = Math.round(a.x);
      const work = !walking && awake;
      // Asleep robots are drawn entirely in the unlit colour.
      g.tinted(awake ? 0 : C.greyDark, () => (a.box = a.draw(g, x, a.feet, {
        t,
        asleep: !awake,
        walk: ['stand', 'stepA', 'stand', 'stepB'][phase],
        swing: walking ? [0, 1, 0, -1][phase] : 0,
        look: walking ? a.dir : 0,
        arm: talking && a.arm === 'down' ? 'wave' : work || a.walkArm ? a.arm : 'down',
        blink: hash(Math.floor(t * 0.37 + a.wake * 10)) % 3 === 0 && (t * 0.37 + a.wake * 10) % 1 < 0.07,
        mouth: talking ? (/[?!]|\.\.\.|hmm|not/.test(speaker.text) ? 'o' : 'smile') : 'smile',
        mood: talking && /!|delivered|perfect|green|good/.test(speaker.text) ? 'happy' : undefined,
        chest: Math.floor(t * 6 + a.wake * 3),
        tip: Math.floor(t * 2 + a.wake * 4) % 2 === 0,
        visor: t * 7,
        roll: a.x * 1.5,
        highlight: hover === a.id,
      })));
      hits.push({ id: a.id, ...a.box });
      if (hover === a.id) {
        const tag = `▾ ${TITLES[a.id] ?? a.robot.label}`;
        g.text(x + Math.floor((W - tag.length) / 2), a.box.y - 1, tag, C.white);
      }
      if (a.cable && awake) drawCable(g, a.box.rh, t);
    }
    if (upper) {
      for (const s of sketches) drawSketch(g, s, t);
    }
    if (speaker && t > speaker.start && (speaker.agent.feet === CREW_FLOOR) !== upper) {
      drawBubble(g, speaker.agent.box, speaker.text, Math.floor((t - speaker.start) * 28));
    }
  }

  function drawProps(g, t, awakeAt) {
    // Database drum next to the backend robot, with a data pipe up to the line.
    g.tinted(awakeAt(2.3) ? 0 : C.greyDark, () => {
      const y = 43;
      g.text(DB_X, y, '╭───────╮', C.steel);
      g.text(DB_X, y + 1, '├───────┤', C.steel);
      g.text(DB_X, y + 2, '│```````│', C.steel);
      g.text(DB_X, y + 3, '│``D`B``│', C.steel);
      g.text(DB_X + 3, y + 3, 'D B', C.green);
      g.text(DB_X, y + 4, '├───────┤', C.steel);
      g.text(DB_X, y + 5, '│```````│', C.steel);
      g.text(DB_X, y + 6, '╰───────╯', C.steel);
      for (const row of [y + 2, y + 5]) {
        for (let i = 0; i < 3; i++) g.put(DB_X + 2 + i * 2, row, '▪', hash(Math.floor(t * 5) + i * 7 + row) % 3 ? C.greenDark : C.green);
      }
      for (let yy = 38; yy < y; yy++) g.put(DB_X + 4, yy, '║', C.greyDark);
      const pulse = 42 - (Math.floor(t * 6) % 5);
      g.put(DB_X + 4, pulse, '║', C.cyan);
    });

    // A UI component the frontend robot keeps restyling.
    g.tinted(awakeAt(2.45) ? 0 : C.greyDark, () => {
      const y = 44;
      const tone = [C.cyan, C.green, C.amber][Math.floor(t / 2.5) % 3];
      g.text(UI_X, y, '┌──────┐', C.cyanDim);
      g.text(UI_X, y + 1, '│▀▀▀▀▀▀│', C.cyanDim);
      g.text(UI_X + 1, y + 1, '▀▀▀▀▀▀', tone);
      g.text(UI_X, y + 2, '│`──```│', C.cyanDim);
      g.text(UI_X, y + 3, '│`┌──┐`│', C.cyanDim);
      g.text(UI_X + 2, y + 3, '┌──┐', tone);
      g.text(UI_X, y + 4, '│`└──┘`│', C.cyanDim);
      g.text(UI_X + 2, y + 4, '└──┘', tone);
      g.text(UI_X, y + 5, '└──────┘', C.cyanDim);
    });

    // The bug bin. Rejected bugs crawl around inside it.
    g.tinted(awakeAt(2.75) ? 0 : C.greyDark, () => {
      const y = 46;
      g.text(BIN_X, y, '┌─BUGS─┐', C.grey);
      g.text(BIN_X, y + 1, '│``````│', C.grey);
      g.text(BIN_X, y + 2, '│``````│', C.grey);
      g.text(BIN_X, y + 3, '└──────┘', C.grey);
      for (let i = 0; i < 3; i++) {
        const k = Math.floor(t * 1.3 + i * 2.1);
        g.put(BIN_X + 1 + ((k * 3 + i * 2) % 6), y + 1 + ((k + i) % 2), '¤', C.red);
      }
    });

    // Server rack with blinking lights.
    g.tinted(awakeAt(2.9) ? 0 : C.greyDark, () => {
      const y = 40;
      g.text(RACK_X, y, '╔═════════╗', C.grey);
      for (let j = 1; j < 9; j++) {
        g.text(RACK_X, y + j, j % 2 ? '║`````````║' : '╟─────────╢', C.grey);
        if (j % 2) {
          for (let i = 0; i < 7; i++) {
            const on = hash(Math.floor(t * (3 + j)) * 31 + i * 7 + j) % 4;
            g.put(RACK_X + 2 + i, y + j, '▪', on === 0 ? C.amber : on === 1 ? C.greenDark : C.green);
          }
        }
      }
      g.text(RACK_X, y + 9, '╚═════════╝', C.grey);
    });
  }

  function drawCable(g, hand, t) {
    const y = hand.y;
    const x1 = RACK_X - 1;
    for (let x = hand.x + 2; x < x1; x++) {
      const sag = Math.round(Math.sin(((x - hand.x) / (x1 - hand.x)) * Math.PI) * 1.2);
      g.put(x, y + sag, '·', (x + Math.floor(t * 12)) % 6 === 0 ? C.amber : C.amberDim);
    }
    g.put(x1, y, '╼', C.amber);
  }

  function drawSketch(g, s, t) {
    const age = (t - s.born) / 2.6;
    const col = age < 0.6 ? C.cyan : C.cyanDim;
    const drawn = Math.min(1, age * 3); // the box draws itself, then fades
    const perimeter = s.w * 2 + 2;
    const cells = [];
    for (let i = 0; i < s.w; i++) cells.push([s.x + i, s.y, i === 0 ? '┌' : i === s.w - 1 ? '┐' : '─']);
    cells.push([s.x + s.w - 1, s.y + 1, '┘']);
    for (let i = s.w - 2; i > 0; i--) cells.push([s.x + i, s.y + 1, '─']);
    cells.push([s.x, s.y + 1, '└']);
    cells.slice(0, Math.ceil(drawn * perimeter)).forEach(([x, y, ch]) => g.put(x, y, ch, col));
  }

  return {
    agents,
    update,
    draw,
    say(id, text, t) {
      const a = agents.find((x) => x.id === id);
      if (a) speaker = { agent: a, text, start: t, end: t + 1e9, typed: 0 };
    },
  };
}

function drawBubble(g, box, text, n) {
  const shown = text.slice(0, Math.max(0, n));
  const w = text.length + 4;
  const left = box.x + W + w > 178;
  const x = left ? box.x - w - 1 : box.x + W;
  const y = Math.max(0, box.y + 1);
  g.text(x, y, '╭' + '─'.repeat(w - 2) + '╮', C.steel);
  g.text(x, y + 1, '│`' + '`'.repeat(text.length) + '`│', C.steel);
  g.text(x + 2, y + 1, shown, C.white);
  g.text(x, y + 2, '╰' + '─'.repeat(w - 2) + '╯', C.steel);
  g.put(left ? x + w : x - 1, y + 1, left ? '▶' : '◀', C.steel);
}

function easeInOutSine(p) {
  return -(Math.cos(Math.PI * p) - 1) / 2;
}

export function hash(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  return (n ^ (n >>> 15)) >>> 0;
}
