// The ten robots: who they are, where they work, how they idle, and their station props.
// CV text lives in content.json. This file only knows names, places and behaviour.

import { C } from './grid.js';
import { makeRobot, W } from './robots.js';
import content from './content.json';
import { CREW_FLOOR, CATWALK, OFFICE, WORLD_COLS } from './layout.js';

const TITLES = Object.fromEntries(content.agents.map((a) => [a.id, a.title]));

// zone: which part of the line wakes it. wake: extra delay after its zone lights up.
// min/max: patrol range (left x). arm: pose while working.
const ROLES = [
  {
    id: 'ceo', zone: 'why', wake: 0.3, feet: OFFICE, min: 17, max: 19, speed: 4, arm: 'down',
    robot: { label: 'CEO', antenna: 'dish', head: 'dome', body: 'tall', tool: 'clipboard', accent: C.amber },
    quips: ['love the energy.', 'vision: delivered.', 'numbers look good.'],
  },
  {
    id: 'cto', zone: 'plan', wake: 0.2, feet: OFFICE, min: 76, max: 78, speed: 4, arm: 'down',
    robot: { label: 'CTO', antenna: 'tip', head: 'monitor', accent: C.green },
    quips: ['all green.', 'hmm. one odd log line.', 'keep it simple.', 'checking. again.'],
  },
  {
    id: 'pm', zone: 'plan', wake: 0.5, bubble: 'left', feet: CATWALK, min: 108, max: 124, speed: 7, arm: 'up', walkArm: 'up',
    robot: { label: 'PM', antenna: 'twin', head: 'square', tool: 'kanban', accent: C.amber },
    quips: ['blocker cleared.', 'on track.', 'milestone!'],
  },
  {
    id: 'design', zone: 'design', wake: 0.3, bubble: 'left', feet: CATWALK, min: 142, max: 158, speed: 5, arm: 'up', sketches: true,
    robot: { label: 'UX', antenna: 'none', head: 'beret', body: 'slim', tool: 'stylus', accent: C.cyan },
    quips: ['one char to the left.', 'more whitespace.', 'better.'],
  },
  {
    id: 'backend', zone: 'build', wake: 0.3, feet: CREW_FLOOR, min: 193, max: 196, speed: 4, arm: 'reach',
    robot: { label: 'API', antenna: 'tip', head: 'goggles', body: 'wide', accent: C.green },
    quips: ['schema migrated.', 'query is fast now.', 'pipes are flowing.'],
  },
  {
    id: 'frontend', zone: 'build', wake: 0.5, feet: CREW_FLOOR, min: 220, max: 222, speed: 4, arm: 'reach',
    robot: { label: 'UI', antenna: 'twin', head: 'round', tool: 'palette', accent: C.cyan },
    quips: ['pixel perfect.', 'dark mode, obviously.', 'snaps right in.'],
  },
  {
    id: 'fullstack', zone: 'build', wake: 0.7, feet: CREW_FLOOR, min: 205, max: 240, stops: [207, 237], speed: 16, arm: 'down', front: true,
    robot: { label: 'FULL', antenna: 'tip', head: 'split', legs: 'wheel', tool: 'bridge', accent: C.white },
    quips: ['on my way!', 'both ends covered.', 'need a hand?'],
  },
  {
    id: 'security', zone: 'secure', wake: 0.3, feet: CREW_FLOOR, min: 280, max: 285, speed: 4, arm: 'down',
    robot: { label: 'SEC', antenna: 'none', head: 'visor', body: 'heavy', tool: 'shield', accent: C.red },
    quips: ['access denied.', 'nice try.', 'perimeter secure.'],
  },
  {
    id: 'qa', zone: 'test', wake: 0.3, feet: CREW_FLOOR, min: 318, max: 321, speed: 4, arm: 'reach',
    robot: { label: 'QA', antenna: 'none', head: 'mono', tool: 'magnifier', accent: C.green, eye: '◎' },
    quips: ['found one.', 'not ignoring that.', 'passes. for now.'],
  },
  {
    // Lives in the NOC. The NOC moves it (desk, bed, the 2am dash), so it never patrols.
    id: 'devops', zone: 'noc', wake: 0, bubble: 'above', feet: CREW_FLOOR, min: 416, max: 416, speed: 6, arm: 'reach', puppet: true,
    robot: { label: 'OPS', antenna: 'none', head: 'hardhat', body: 'stocky', legs: 'treads', tool: 'plug', accent: C.amber },
    quips: ['deploying.', 'it is 2am somewhere.', 'rack is happy.'],
  },
];

const DB_X = 209;
const UI_X = 238;
export const BIN_X = 334; // drawn by the TEST station

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
  let chatter = false; // random small talk, explore mode only

  function update(t, isAwake) {
    const awake = (a) => isAwake(a.zone, a.wake);
    for (const a of agents) {
      if (!awake(a)) continue;
      if (a.state === 'walk') {
        const p = Math.min(1, (t - a.t0) / a.dur);
        a.x = a.from + (a.to - a.from) * easeInOutSine(p);
        if (p >= 1) {
          a.state = 'work';
          a.until = a.puppet ? Infinity : t + 1.5 + rnd() * 3.5;
        }
      } else if (!a.puppet && t > a.until && a !== speaker?.agent) {
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
    if (!speaker && chatter && t > nextTalk) {
      const idle = agents.filter((a) => a.state === 'work' && awake(a) && !a.hidden);
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
  function draw(g, t, layer, { isAwake, hover, hits }) {
    const awake = (a) => isAwake(a.zone, a.wake);
    const upper = layer === 'upper';
    if (!upper) drawProps(g, t, isAwake);
    const list = agents.filter((a) => (a.feet === CREW_FLOOR) !== upper);
    // Robots that roam in front are drawn last.
    list.sort((a, b) => (a.front ? 1 : 0) - (b.front ? 1 : 0));
    for (const a of list) {
      if (a.hidden) continue; // tucked up in bed: the NOC draws it
      const lit = awake(a);
      const walking = a.state === 'walk';
      const phase = walking ? Math.floor(Math.abs(a.x - a.from) / 1.6) % 4 : 0;
      const talking = speaker?.agent === a && t > speaker.start;
      const x = Math.round(a.x);
      const work = !walking && lit;
      // Asleep robots are drawn entirely in the unlit colour.
      g.tinted(lit ? 0 : C.greyDark, () => (a.box = a.draw(g, x, a.feet - Math.round(liftOf(a, t)), {
        t,
        asleep: !lit,
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
      if (lit) hits.push({ id: a.id, ...a.box });
      if (hover === a.id) {
        const tag = `▾ ${TITLES[a.id] ?? a.robot.label}`;
        g.text(x + Math.floor((W - tag.length) / 2), a.box.y - 1, tag, C.white);
      }
    }
    if (upper) {
      for (const s of sketches) drawSketch(g, s, t);
    }
    if (speaker && t > speaker.start && (speaker.agent.feet === CREW_FLOOR) !== upper) {
      drawBubble(g, speaker.agent, speaker.text, Math.floor((t - speaker.start) * 28), list);
    }
  }

  function drawProps(g, t, isAwake) {
    // Database drum next to the backend robot, with a data pipe up to the line.
    g.tinted(isAwake('build', 0.3) ? 0 : C.greyDark, () => {
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
    g.tinted(isAwake('build', 0.5) ? 0 : C.greyDark, () => {
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
    set chatter(v) { chatter = v; },
    // Send a robot somewhere (used by the NOC to move the OPS robot).
    walkTo(id, x, t, speed) {
      const a = agents.find((r) => r.id === id);
      if (!a) return;
      Object.assign(a, { from: a.x, to: x, t0: t, dur: Math.abs(x - a.x) / speed + 0.2, dir: Math.sign(x - a.x) || 1, state: 'walk' });
    },
    // Make one robot say a line now. It stops moving while it talks.
    say(id, text, t, hold = 1.2 + text.length * 0.06 + 1.4) {
      const a = agents.find((x) => x.id === id);
      if (!a) return;
      speaker = { agent: a, text, start: t, end: t + hold, typed: 0 };
      a.until = Math.max(a.until, t + hold);
    },
    hush() { speaker = null; },
  };
}

// Speech goes beside the head, on whichever side is clear of other robots.
function drawBubble(g, agent, text, n, others) {
  const box = agent.box;
  const shown = text.slice(0, Math.max(0, n));
  const w = text.length + 4;
  const right = box.x + W;
  const leftX = box.x - w - 1;
  const blocked = (x0) => x0 < 0 || x0 + w > WORLD_COLS - 2 ||
    others.some((o) => o !== agent && o.box && o.box.x < x0 + w && o.box.x + W > x0);
  // Both sides crowded: put it above the head instead, pointing down.
  const above = agent.bubble === 'above' || (blocked(right) && blocked(leftX));
  const left = !above && (agent.bubble === 'left' ? !blocked(leftX) || blocked(right) : blocked(right));
  const x = above ? box.x + Math.floor((W - w) / 2) : left ? leftX : right;
  const y = above ? Math.max(0, box.y - 3) : Math.max(0, box.y + 1);
  g.text(x, y, '╭' + '─'.repeat(w - 2) + '╮', C.steel);
  g.text(x, y + 1, '│`' + '`'.repeat(text.length) + '`│', C.steel);
  g.text(x + 2, y + 1, shown, C.white);
  g.text(x, y + 2, '╰' + '─'.repeat(w - 2) + '╯', C.steel);
  if (above) g.put(x + Math.floor(w / 2), y + 2, '┬', C.steel);
  else g.put(left ? x + w : x - 1, y + 1, left ? '▶' : '◀', C.steel);
}

// A little jump when a robot springs to its feet: up two rows and back down.
function liftOf(a, t) {
  if (!a.wokeAt) return 0;
  const p = (t - a.wokeAt) / 0.45;
  return p > 0 && p < 1 ? Math.sin(p * Math.PI) * 2.4 : 0;
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
