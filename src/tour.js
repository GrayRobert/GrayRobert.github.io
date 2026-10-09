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
  async function carry(pkg, key, x = stop(key)) {
    world.moveTo(pkg, x);
    await until(() => world.arrived(pkg, x));
  }

  const scripts = {
    async boot() {
      view('base', { dur: 0 });
      ui.caption(['power ............ ok', 'line 01 .......... online', 'crew ............. asleep'], { log: true });
      await wait(3.6);
      ui.caption('Lights out. This is the dark factory.');
      await wait(2.4);
    },

    async overview() {
      ui.caption('Seven stations, ten robots. Each one is a role Robert has held or can cover. He can run the whole factory: a fleet of AI agents, a real team, or every station himself.');
      camera.to(WORLD_COLS / 2, { zoom: Math.min(1, screen.cols / WORLD_COLS), dur: 2.4, now });
      await wait(7.5);
      view('why', { dur: 2 });
      await wait(2);
    },

    async why() {
      world.light('why');
      view('why');
      ui.caption('Every idea starts at the WHY gate.');
      const bad = world.spawn({ bad: true, label: '{ hype }' });
      world.moveTo(bad, stop('why'));
      await until(() => bad.x >= 20);
      hero = world.spawn();
      await until(() => world.arrived(bad, stop('why')));
      ui.caption('Who uses it? Will they pay? Is it worth it? Is it safe? Is it allowed?');
      st.why.check(bad, false, now, 0.45);
      await wait(st.why.duration(0.45) + 0.5);
      ui.caption('No clear value? Laser.');
      st.why.zap(bad, now);
      await wait(0.8);
      say('ceo', 'next.');
      await wait(1.2);
      ui.caption('Next.');
      await carry(hero, 'why');
      ui.caption('Same questions.');
      st.why.check(hero, true, now, 0.3);
      await wait(st.why.duration(0.3) + 0.4);
      ui.caption('Real users, real money, real reasons. Approved.');
      say('ceo', 'love it.');
      await wait(2.8);
    },

    async plan() {
      world.light('plan');
      view('plan');
      ui.caption('Approved ideas get a plan.');
      await carry(hero, 'plan');
      say('cto', 'build, not buy.');
      await wait(1.8);
      st.plan.stamp(hero, now);
      await wait(0.9);
      ui.caption('The CTO picks the approach. The PM clears the blockers.');
      say('pm', 'on track.');
      await wait(2.8);
    },

    async design() {
      world.light('design');
      view('design');
      ui.caption('Then it gets designed, so people can actually use it.');
      await carry(hero, 'design');
      st.design.project(hero, now, 1.8);
      say('design', 'more whitespace.');
      await wait(3);
    },

    async build() {
      world.light('build');
      view('build');
      ui.caption('Backend, frontend, and the robot who does both.');
      await carry(hero, 'build');
      st.build.weld(hero, now, 2.6);
      say('backend', 'schema migrated.');
      await wait(1.6);
      say('fullstack', 'on my way!');
      await wait(1.8);
      ui.caption('Built.');
      await wait(1.2);
    },

    async secure() {
      world.light('secure');
      view('secure');
      ui.caption('Nothing ships without security.');
      await carry(hero, 'secure');
      st.secure.attack(6, now);
      await wait(0.8);
      st.secure.raiseDome(true);
      say('security', 'nice try.');
      await until(() => !st.secure.busy, 6);
      st.secure.scan(hero, now, 1.2);
      await wait(1.4);
      st.secure.raiseDome(false);
      ui.caption('Intruders bounced. Signed, sealed, scanned.');
      await wait(2);
    },

    async test() {
      world.light('test');
      view('test');
      ui.caption('QA will not let one odd log line go.');
      await carry(hero, 'test');
      st.test.scan(hero, now, { bug: true, dur: 1.4 });
      await wait(1.7);
      say('qa', 'found one.');
      await wait(1.8);
      st.test.fix(hero);
      ui.caption('Found it. Fixed it. Tested it.');
      await wait(2.2);
    },

    async ship() {
      world.light('ship');
      view('ship');
      ui.caption('Then it ships.');
      await carry(hero, 'ship', STATION.ship - 8);
      st.ship.launch(hero, now);
      hero = null;
      say('devops', 'deployed.');
      await wait(2.8);
      ui.caption('And it keeps shipping. Even at 2am.');
      await wait(2.8);
    },

    async explore() {
      world.lightAll();
      world.setMode('free');
      camera.free = true;
      ui.caption('Your turn. Drag or scroll to look around. Click any robot to see the real CV behind it.');
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
        await wait(0.6);
        if (mine === token) go(i + 1, { jump: false });
      }
    } catch (e) {
      if (e !== CANCEL) throw e;
    }
  }

  function go(i, { jump = true } = {}) {
    i = Math.max(0, Math.min(EXPLORE, i));
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
