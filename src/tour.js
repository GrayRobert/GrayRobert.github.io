// The guided tour: named scenes, each a short script that runs on the simulation
// clock. Jumping to a scene cancels the running script and settles the factory into
// the state the earlier scenes would have left it in. window.deck drives it by hand.

import { PKG_W, STATION, ZONES, WORLD_COLS, view as screen, viewFor } from './layout.js';

export const SCENES = [
  { id: 'boot', name: 'power' },
  { id: 'overview', name: 'intro' },
  { id: 'why', name: 'why', zone: 'why', stage: 'idea' },
  { id: 'plan', name: 'plan', zone: 'plan', stage: 'spec' },
  { id: 'design', name: 'design', zone: 'design', stage: 'wire' },
  { id: 'build', name: 'build', zone: 'build', stage: 'code' },
  { id: 'secure', name: 'secure', zone: 'secure', stage: 'secure' },
  { id: 'test', name: 'test', zone: 'test', stage: 'tested' },
  { id: 'ship', name: 'ship', zone: 'ship' },
  { id: 'noc', name: '2am', zone: 'noc' },
  { id: 'explore', name: 'explore' },
];
const EXPLORE = SCENES.length - 1;
const CANCEL = Symbol('cancel');

export function createTour({ world, camera, ui }) {
  let index = -1;
  let token = 0;
  let waits = [];
  let now = 0;
  let hero = null;
  const log = []; // [scene, start time], handy for timing the tour
  const st = world.stations;

  // Promises that resolve on the simulation clock, and reject if the scene is cancelled.
  const wait = (s) => new Promise((res, rej) => waits.push({ at: now + s, res, rej, token }));
  const until = (fn, max = 20) => new Promise((res, rej) => waits.push({ fn, at: now + max, res, rej, token }));
  const say = (id, text) => world.say(id, text, now);
  const view = (zone, opts = {}) => {
    const v = viewFor(zone);
    camera.to(v.cx, { now, dur: 1.8, zoom: v.zoom, ...opts });
  };
  const stop = (key) => STATION[key] - PKG_W / 2;
  // Captions get time to be read: the time it takes to type, plus a pause that grows with
  // the number of words. A new caption, or the next scene, waits until the current one
  // has had its time.
  const TYPE_RATE = 45; // must match tourui.js
  let readyAt = 0;
  const readTime = (text) => {
    const all = Array.isArray(text) ? text.join(' ') : text;
    return all.length / TYPE_RATE + 2.5 + all.split(/\s+/).length * 0.15;
  };
  const readable = () => wait(Math.max(0, readyAt - now));
  async function show(text, opts) {
    await readable();
    ui.caption(text, opts);
    readyAt = now + readTime(text);
  }

  async function carry(pkg, key, x = stop(key)) {
    world.moveTo(pkg, x);
    await until(() => world.arrived(pkg, x));
  }

  const scripts = {
    async boot() {
      view('base', { dur: 0 });
      await show(['power ............ ok', 'line 01 .......... online', 'crew ............. asleep'], { log: true });
      await wait(3.6);
      await show('Lights out. This is the dark factory.');
      await wait(2.4);
    },

    async overview() {
      // Robert's own words: why this CV is a factory.
      camera.to(WORLD_COLS / 2, { zoom: Math.min(1, screen.cols / WORLD_COLS), dur: 2.4, now });
      await show('I believe smart, well-intentioned people can use AI to run an entire factory of agents that build and ship quality software.');
      await show('Agents are no different from people. They make mistakes, over-bake, take shortcuts and ignore patterns.');
      await show('So I designed my CV as a dark factory: ten robots, ten core roles in software delivery, and how my experience ties them together.');
      await readable();
      view('why', { dur: 2 });
      await wait(2);
    },

    async why() {
      world.light('why');
      view('why');
      await show('Every idea starts at the WHY gate.');
      const bad = world.spawn({ bad: true, label: '{ hype }' });
      world.moveTo(bad, stop('why'));
      await until(() => bad.x >= 20);
      hero = world.spawn();
      await until(() => world.arrived(bad, stop('why')));
      await show('Who uses it? Will they pay? Is it worth it? Is it safe? Is it allowed?');
      st.why.check(bad, false, now, 0.38);
      await wait(st.why.duration(0.38) + 0.4);
      await show('No clear value? Laser.');
      st.why.zap(bad, now);
      await wait(0.8);
      say('ceo', 'next.');
      await wait(1.2);
      await show('Next.');
      await carry(hero, 'why');
      await show('Same questions.');
      st.why.check(hero, true, now, 0.3);
      await wait(st.why.duration(0.3) + 0.4);
      await show('Real users, real money, real reasons. Approved.');
      say('ceo', 'love it.');
      await wait(2.8);
    },

    async plan() {
      world.light('plan');
      view('plan');
      await show('Approved ideas get a plan.');
      await carry(hero, 'plan');
      say('cto', 'build, not buy.');
      await wait(1.8);
      st.plan.stamp(hero, now);
      await wait(0.9);
      await show('The CTO picks the approach. The PM clears the blockers.');
      say('pm', 'on track.');
      await wait(2.8);
    },

    async design() {
      world.light('design');
      view('design');
      await show('Then it gets designed, so people can actually use it.');
      await carry(hero, 'design');
      st.design.project(hero, now, 1.8);
      say('design', 'more whitespace.');
      await wait(3);
    },

    async build() {
      world.light('build');
      view('build');
      await show('Backend, frontend, and the robot who does both.');
      await carry(hero, 'build');
      st.build.weld(hero, now, 2.6);
      say('backend', 'schema migrated.');
      await wait(1.6);
      say('fullstack', 'on my way!');
      await wait(1.8);
      await show('Built.');
      await wait(1.2);
    },

    async secure() {
      world.light('secure');
      view('secure');
      await show('Nothing ships without security.');
      await carry(hero, 'secure');
      st.secure.attack(6, now);
      await wait(0.8);
      st.secure.raiseDome(true);
      say('security', 'nice try.');
      await until(() => !st.secure.busy, 6);
      st.secure.scan(hero, now, 1.2);
      await wait(1.4);
      st.secure.raiseDome(false);
      await show('Intruders bounced. Signed, sealed, scanned.');
      await wait(2);
    },

    async test() {
      world.light('test');
      view('test');
      await show('QA will not let one odd log line go.');
      await carry(hero, 'test');
      st.test.scan(hero, now, { bug: true, dur: 1.4 });
      await wait(1.7);
      say('qa', 'found one.');
      await wait(1.8);
      st.test.fix(hero);
      await show('Found it. Fixed it. Tested it.');
      await wait(2.2);
    },

    async ship() {
      world.light('ship');
      view('ship');
      await show('Then it ships.');
      await carry(hero, 'ship', STATION.ship - 8);
      st.ship.launch(hero, now);
      hero = null;
      await wait(2.6);
      await wait(0.6);
    },

    async noc() {
      world.light('noc');
      view('noc');
      // The NOC runs its own story. At each beat it holds while the caption is read.
      st.noc.night(now, 4, 0); // in bed, clock stopped
      await show('Shipping is not the end. Something has to keep it running.');
      await readable();
      st.noc.night(now, 4, 1.6); // let the clock run to 2am
      await until(() => st.noc.phase === 'alert', 10);
      await show('2:00am. A memory leak. Heap at 98%.');
      st.noc.hold(now, readyAt);
      await until(() => st.noc.phase === 'fix', 20);
      await show('Up. Heap dump. Redeploy. Back to green.');
      st.noc.hold(now, readyAt);
      await until(() => st.noc.phase === 'back', 20);
      await show('Robert is first responder for what he builds.');
      await until(() => st.noc.phase === 'sleep', 15);
    },

    async explore() {
      world.lightAll();
      world.setMode('free');
      camera.free = true;
      await show('Your turn. Drag or scroll to look around. Click any robot to see the real CV behind it.');
    },
  };

  // Put the factory in the state it would be in just before scene i starts.
  function settle(i) {
    world.clearLine();
    world.setMode('tour');
    camera.free = false;
    hero = null;
    const keep = new Set(['base']);
    for (let k = 0; k < i; k++) if (SCENES[k].zone) keep.add(SCENES[k].zone);
    for (const z of ZONES) if (keep.has(z.id)) world.light(z.id, true);
    world.unlight(ZONES.map((z) => z.id).filter((z) => !keep.has(z)));
    const prev = SCENES[i - 1];
    if (prev?.stage) {
      hero = world.spawn({ stage: prev.stage });
      world.place(hero, stop(prev.id));
    }
    if (i > SCENES.findIndex((s) => s.id === 'why')) st.why.show(true);
    if (i > SCENES.findIndex((s) => s.id === 'ship')) world.deployed = Math.max(world.deployed, 1);
  }

  async function run(i) {
    const mine = token;
    try {
      await scripts[SCENES[i].id]();
      if (i < EXPLORE) {
        await readable();
        await wait(0.6);
        if (mine === token) go(i + 1, { jump: false });
      }
    } catch (e) {
      if (e !== CANCEL) throw e;
    }
  }

  function go(i, { jump = true } = {}) {
    i = Math.max(0, Math.min(EXPLORE, i));
    readyAt = 0;
    token++;
    for (const w of waits) w.rej(CANCEL);
    waits = [];
    world.crew.hush();
    if (jump) settle(i);
    if (jump && i !== EXPLORE) view(SCENES[i].zone ?? (i <= 1 ? 'base' : 'why'), { dur: 0.9 });
    index = i;
    log.push([SCENES[i].id, Math.round(now * 10) / 10]);
    ui.setScene(i);
    const id = SCENES[i].id;
    if (id !== 'boot') history.replaceState(null, '', '#' + id);
    run(i);
  }

  return {
    get index() { return index; },
    get scene() { return SCENES[index]?.id; },
    log,
    start(t) { now = t; go(0, { jump: false }); },
    go,
    goto(id) {
      const i = SCENES.findIndex((s) => s.id === id);
      if (i >= 0) go(i);
    },
    // Cancel whatever is running (power off). The index stays, so it can resume.
    stop() {
      token++;
      for (const w of waits) w.rej(CANCEL);
      waits = [];
    },
    next() { go(index + 1); },
    prev() { go(Math.max(2, index - 1)); },
    skip() { go(EXPLORE); },
    update(t) {
      now = t;
      for (const w of [...waits]) {
        if (w.token !== token) continue;
        if ((w.fn && w.fn()) || now >= w.at) {
          waits = waits.filter((x) => x !== w);
          w.res();
        }
      }
    },
  };
}
