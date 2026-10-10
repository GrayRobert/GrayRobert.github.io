// The stations along the line, in story order. Each one draws itself and exposes the
// actions the tour calls (check, zap, stamp, weld, attack, scan, launch). In explore
// mode the world triggers the same actions automatically as packages pass.

import { C } from './grid.js';
import { bigText } from './bigtext.js';
import { BELT_Y, FLOOR_Y, PKG_W, STATION } from './layout.js';
import { BIN_X } from './crew.js';

const WHY_CHECKS = ['who uses it?', 'will they pay?', 'roi?', 'secure?', 'governance?'];
// Three possible answers to each question. "Don't know yet" on the value questions is not
// a no: it makes the idea an experiment. Security and governance always need a yes.
const MARKS = {
  pass: ['✓', '✓', '✓', '✓', '✓'],
  fail: ['✗', '✗', '✗', '✓', '✓'], // we asked: nobody wants it
  experiment: ['?', '?', '?', '✓', '✓'], // nobody knows yet
};
const VERDICT = { pass: 'approved', fail: 'rejected', experiment: 'experiment' };
const MARK_COLOR = { '✓': C.green, '✗': C.red, '?': C.amber };
const outcomeOf = (o) => (o === true ? 'pass' : o === false ? 'fail' : o);

export function createStations(w) {
  // w: { rnd, audio, lit(zone, delay), setStage(pkg, s), remove(pkg), burst(...), debris(pkg), packages, deployed() }

  // WHY gate: every idea is questioned before it gets in. No clear value, no entry.
  const why = {
    run: null, // { pkg, t0, step, pass, verdict }
    verdict: null, // 'approved' | 'rejected'
    verdictAt: -9,
    laser: null, // { x, y, t0 }
    scrap: 0,

    // step: seconds per question. pass: will it pass?
    // outcome: 'pass', 'fail' or 'experiment'
    check(pkg, outcome, t, step = 0.4) {
      outcome = outcomeOf(outcome);
      why.run = { pkg, t0: t, step, outcome, marks: MARKS[outcome], ticked: 0 };
      why.verdict = null;
    },

    zap(pkg, t) {
      why.laser = { x: pkg.x + PKG_W / 2, y: BELT_Y - 2, t0: t };
      w.audio?.zap();
      w.debris(pkg);
      w.remove(pkg);
      why.scrap++;
    },

    update(t) {
      const r = why.run;
      if (!r) return;
      const n = Math.min(WHY_CHECKS.length, Math.floor((t - r.t0) / r.step));
      while (r.ticked < n) {
        r.ticked++;
        w.audio?.tick(r.marks[r.ticked - 1]);
      }
      if (n >= WHY_CHECKS.length && !why.verdict) {
        why.verdict = VERDICT[r.outcome];
        why.verdictAt = t;
        r.done = t;
        if (r.outcome === 'pass') w.audio?.approve();
      }
    },

    // Jump straight to a finished check (used when the tour skips ahead).
    show(outcome) {
      outcome = outcomeOf(outcome);
      why.run = { outcome, marks: MARKS[outcome], ticked: WHY_CHECKS.length, t0: -9, step: 1 };
      why.verdict = VERDICT[outcome];
      why.verdictAt = -9;
    },

    // Seconds a full check takes at a given step.
    duration: (step = 0.4) => WHY_CHECKS.length * step,

    draw(g, t) {
      // The question board above the gate
      const bx = 48, by = 12, bw = 26, bh = 15;
      g.box(bx, by, bw, bh, C.grey, 'double');
      g.fill(bx + 1, by + 1, bw - 2, bh - 2, ' ', 0);
      bigText(g, bx + 2, by + 1, 'WHY?', C.amber);
      const r = why.run;
      WHY_CHECKS.forEach((q, i) => {
        const y = by + 5 + i;
        const done = r && i < r.ticked;
        const active = r && i === r.ticked && !why.verdict;
        g.text(bx + 2, y, q, active ? C.white : done ? C.steel : C.grey);
        const mark = done ? r.marks[i] : active && Math.floor(t * 8) % 2 ? '?' : '·';
        g.put(bx + bw - 3, y, mark, done ? MARK_COLOR[mark] : C.greyDark);
      });
      const v = why.verdict;
      if (v) {
        const flash = t - why.verdictAt < 0.6 && Math.floor(t * 12) % 2;
        const word = v.toUpperCase();
        const col = { approved: C.green, rejected: C.red, experiment: C.amber }[v];
        g.text(bx + Math.floor((bw - word.length) / 2), by + 12, word, flash ? C.white : col);
      } else {
        g.text(bx + 9, by + 12, '. . .', C.greyDark);
      }

      // The gate itself, with a laser emitter on top
      const x0 = STATION.why - 8, x1 = STATION.why + 8, top = BELT_Y - 8;
      g.text(x0, top, '╔' + '═'.repeat(x1 - x0 - 1) + '╗', C.grey);
      g.put(STATION.why, top, '╦', C.grey);
      g.put(STATION.why, top + 1, '▼', why.laser && t - why.laser.t0 < 0.5 ? C.white : C.red);
      for (let y = top + 1; y < BELT_Y; y++) {
        g.put(x0, y, '║', C.grey);
        g.put(x1, y, '║', C.grey);
      }
      const lamp = v === 'approved' ? C.green : v === 'rejected' ? C.red : v === 'experiment' || r ? C.amber : C.greyDark;
      g.put(x0, top + 2, '●', lamp);
      g.put(x1, top + 2, '●', lamp);

      // Scrap heap of rejected ideas, on the floor to the left of the lab
      const heap = Math.min(5, why.scrap);
      for (let i = 0; i < heap; i++) g.text(20 + i, FLOOR_Y - 1, '▄', i % 2 ? C.amberDim : C.redDim);
      if (heap) g.text(19, FLOOR_Y - 2, 'scrap', C.greyDark);
    },

    drawFx(g, t) {
      const l = why.laser;
      if (!l || t - l.t0 > 0.45) return;
      const sx = STATION.why + 0.5, sy = BELT_Y - 6;
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        g.dot(sx + (l.x - sx) * k, sy + (l.y - sy) * k, Math.floor(t * 30) % 2 ? C.white : C.red);
        g.dot(sx + (l.x - sx) * k + 0.5, sy + (l.y - sy) * k, C.red);
      }
    },
  };

  // PLAN: a press on the catwalk stamps the approved idea into a spec.
  const plan = {
    t0: -9,
    pkg: null,
    stamp(pkg, t) {
      plan.t0 = t;
      plan.pkg = pkg;
      plan.done = false;
    },
    update(t) {
      if (plan.pkg && !plan.done && t - plan.t0 > 0.3) {
        plan.done = true;
        w.setStage(plan.pkg, 'spec');
        w.audio?.thunk();
      }
    },
    draw(g, t) {
      const x = STATION.plan;
      const p = t - plan.t0;
      // drop fast, hold, then lift with a little bounce
      let drop = 0;
      if (p < 0.3) drop = (p / 0.3) ** 2;
      else if (p < 0.45) drop = 1;
      else if (p < 0.9) drop = 1 - easeOutBack((p - 0.45) / 0.45);
      const headY = 26 + Math.round(drop * 3);
      g.text(x - 4, 24, '╘═══╤═══╛', C.grey);
      for (let y = 25; y < headY; y++) g.put(x, y, '┃', C.grey);
      g.text(x - 3, headY, '╔══╧══╗', C.steel);
      g.text(x - 3, headY + 1, '║`````║', C.steel);
      g.text(x - 1, headY + 1, 'PLAN', drop > 0.9 ? C.white : C.amberDim);
      g.text(x - 3, headY + 2, '╚═════╝', C.steel);
    },
  };

  // DESIGN: a projector shines the designer's wireframe onto the package.
  const design = {
    pkg: null,
    project(pkg, t, dur = 1.8) {
      design.pkg = pkg;
      design.end = t + dur;
    },
    update(t) {
      if (design.pkg && t >= design.end) {
        w.setStage(design.pkg, 'wire');
        design.pkg = null;
        w.audio?.chime();
      }
    },
    draw(g, t) {
      const x = STATION.design;
      g.text(x - 4, 24, '╘═══╤═══╛', C.grey);
      g.text(x - 1, 25, '▄█▄', C.steel);
      const active = design.pkg && t < design.end;
      g.put(x, 26, '▼', active ? C.cyan : C.cyanDim);
      if (!active) return;
      for (let row = 0; row < 5; row++) {
        const half = row + 1;
        for (let dx = -half; dx <= half; dx++) {
          if ((dx + row + Math.floor(t * 10)) % 3 === 0) g.scan(x + dx, 27 + row, '░', C.cyanDim);
        }
      }
    },
  };

  // BUILD: the welder. Sparks are braille dots, so they move smoothly between cells.
  const build = {
    drop: 0,
    until: -9,
    pkg: null,
    get welding() { return build.drop > 0.8 && (build.auto || build.until > build.now); },
    weld(pkg, t, dur = 2.4) {
      build.pkg = pkg;
      build.until = t + dur;
    },
    update(t, dt, auto) {
      build.now = t;
      build.auto = auto;
      const want = auto || t < build.until;
      build.drop += ((want ? 1 : 0) - build.drop) * Math.min(1, dt * 10);
      if (build.pkg && t >= build.until) {
        w.setStage(build.pkg, 'code');
        build.pkg = null;
      }
      const on = build.drop > 0.8 && want;
      w.audio?.weld(on ? 0.4 + w.rnd() * 0.6 : 0);
      if (on) {
        for (let i = 0; i < 3; i++) {
          w.spark(STATION.build + 0.5, BELT_Y - 3.2, (w.rnd() - 0.5) * 28, -6 - w.rnd() * 14);
        }
      }
      build.on = on;
    },
    draw(g, t) {
      const x = STATION.build;
      const tipY = Math.round(BELT_Y - 6 + build.drop * 2.4);
      g.text(x - 4, 24, '╘═══╧═══╛', C.grey);
      for (let y = 25; y < tipY - 3; y++) g.put(x, y, '┃', C.grey);
      g.text(x - 1, tipY - 3, '╔╧╗', C.steel);
      g.text(x - 1, tipY - 2, '║`║', C.steel);
      g.put(x, tipY - 2, '▓', build.on ? C.amber : C.amberDim);
      g.text(x - 1, tipY - 1, '╚╤╝', C.steel);
      g.put(x, tipY, '▼', C.amber);
      if (build.on) g.put(x, tipY + 1, Math.floor(t * 24) % 2 ? '*' : '✶', C.white);
    },
  };

  // SECURE: a scanner gate, a shield dome, and intruders dropping in from the roof.
  const DOME_RX = 20;
  const DOME_RY = 10;
  const secure = {
    dome: 0, // 0 down, 1 fully raised
    domeTarget: 0,
    intruders: [],
    scanPkg: null,
    scanEnd: 0,
    attack(n, t) {
      for (let i = 0; i < n; i++) {
        secure.intruders.push({
          x: STATION.secure - 14 + w.rnd() * 28, y: 2.5, vx: (w.rnd() - 0.5) * 2, vy: 0,
          born: t + i * 0.35, ch: '¤жλ§×'[i % 5], alive: true,
        });
      }
      w.audio?.alarm();
    },
    raiseDome(on = true) {
      secure.domeTarget = on ? 1 : 0;
      if (on) w.audio?.shield();
    },
    scan(pkg, t, dur = 1.2) {
      secure.scanPkg = pkg;
      secure.scanEnd = t + dur;
    },
    update(t, dt) {
      secure.dome += (secure.domeTarget - secure.dome) * Math.min(1, dt * 6);
      if (secure.scanPkg && t >= secure.scanEnd) {
        w.setStage(secure.scanPkg, 'secure');
        secure.scanPkg = null;
      }
      const cx = STATION.secure, cy = BELT_Y;
      for (const m of secure.intruders) {
        if (!m.alive || t < m.born) continue;
        // drift toward the line with a wobble
        m.vy = Math.min(m.vy + 9 * dt, 7);
        m.vx += ((cx - m.x) * 0.15 - m.vx) * dt + Math.sin(t * 6 + m.born * 10) * 0.6 * dt * 10;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        const dx = (m.x - cx) / (DOME_RX * secure.dome + 0.01);
        const dy = (m.y - cy) / (DOME_RY * secure.dome + 0.01);
        if (secure.dome > 0.5 && dx * dx + dy * dy <= 1.05) {
          m.alive = false;
          w.burst(m.x, m.y, 14, [C.white, C.cyan, C.red]);
          w.audio?.fizz();
        } else if (m.y > BELT_Y - 3) {
          m.alive = false; // no dome: it slips into the line and vanishes (the tour never lets this happen)
        }
      }
      secure.intruders = secure.intruders.filter((m) => m.alive || t < m.born);
    },
    get busy() { return secure.intruders.length > 0; },
    draw(g, t) {
      const x0 = STATION.secure - 8, x1 = STATION.secure + 8, top = BELT_Y - 8;
      g.text(x0, top, '┏' + '━'.repeat(x1 - x0 - 1) + '┓', C.grey);
      g.text(x0 + 6, top, ' SEC ', C.red);
      for (let y = top + 1; y < BELT_Y; y++) {
        g.put(x0, y, '┃', C.grey);
        g.put(x1, y, '┃', C.grey);
      }
      if (secure.scanPkg && t < secure.scanEnd) {
        const k = (Math.sin(t * 9) + 1) / 2;
        const by = top + 1 + Math.round(k * 6);
        for (let x = x0 + 1; x < x1; x++) g.scan(x, by, '┄', C.red);
      }
      // Roof vents the intruders come through
      for (const vx of [STATION.secure - 12, STATION.secure + 10]) g.text(vx - 1, 2, '▚▞▚', C.redDim);
      // Shield emitter on the floor
      g.text(STATION.secure + 8, FLOOR_Y - 2, '╔═◈═╗', C.grey);
      g.put(STATION.secure + 10, FLOOR_Y - 2, '◈', secure.dome > 0.1 ? C.cyan : C.cyanDim);
      g.text(STATION.secure + 8, FLOOR_Y - 1, '╚═══╝', C.grey);
    },
    drawFx(g, t) {
      const d = secure.dome;
      if (d > 0.02) {
        const cx = STATION.secure + 0.5, cy = BELT_Y;
        const steps = 260;
        for (let i = 0; i <= steps; i++) {
          const a = (Math.PI * i) / steps;
          const shimmer = (i + Math.floor(t * 40)) % 23 === 0;
          g.dot(cx + Math.cos(a) * DOME_RX * d, cy - Math.sin(a) * DOME_RY * d, shimmer ? C.white : C.cyan);
        }
        for (let i = 0; i < 40; i++) {
          const a = w.rnd() * Math.PI;
          const r = Math.sqrt(w.rnd());
          g.dot(cx + Math.cos(a) * DOME_RX * d * r, cy - Math.sin(a) * DOME_RY * d * r, C.cyanDim);
        }
      }
      for (const m of secure.intruders) {
        if (m.alive && t >= m.born) g.put(m.x, m.y, m.ch, Math.floor(t * 8) % 2 ? C.red : C.redDim);
      }
    },
  };

  // TEST: QA scans. Sometimes a bug jumps out and lands in the bin, then it is fixed.
  const test = {
    scanPkg: null,
    scanEnd: 0,
    bug: null, // the flying bug
    binned: 3,
    scan(pkg, t, { bug = false, dur = 1.4 } = {}) {
      test.scanPkg = pkg;
      test.scanEnd = t + dur;
      test.willBug = bug;
    },
    fix(pkg) {
      w.setStage(pkg, 'tested');
      w.audio?.approve();
    },
    update(t, dt) {
      const p = test.scanPkg;
      if (p && t >= test.scanEnd) {
        test.scanPkg = null;
        if (test.willBug) {
          w.setStage(p, 'bug');
          test.bug = { x: p.x + PKG_W / 2, y: BELT_Y - 3, vx: -3, vy: -14 };
          w.audio?.buzz();
          if (test.auto) test.fixAt = { pkg: p, t: t + 1.2 };
        } else {
          w.setStage(p, 'tested');
        }
      }
      if (test.fixAt && t >= test.fixAt.t) {
        if (w.packages.includes(test.fixAt.pkg)) test.fix(test.fixAt.pkg);
        test.fixAt = null;
      }
      const b = test.bug;
      if (b) {
        b.vy += 40 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y >= FLOOR_Y - 3) {
          test.bug = null;
          test.binned++;
          w.burst(b.x, b.y, 6, [C.red, C.redDim]);
        }
      }
    },
    draw(g, t) {
      const x0 = STATION.test - 8, x1 = STATION.test + 8, top = BELT_Y - 8;
      g.text(x0, top, '╔' + '═'.repeat(x1 - x0 - 1) + '╗', C.grey);
      g.text(x0 + 6, top, ' QA ', C.cyan);
      for (let y = top + 1; y < BELT_Y; y++) {
        g.put(x0, y, '║', C.grey);
        g.put(x1, y, '║', C.grey);
      }
      const scanning = test.scanPkg && t < test.scanEnd;
      g.put(x0, top + 2, '●', scanning ? C.cyan : C.cyanDim);
      g.put(x1, top + 2, '●', scanning ? C.cyan : C.cyanDim);
      if (scanning) {
        const bx = x0 + 1 + Math.round(((Math.sin(t * 7) + 1) / 2) * (x1 - x0 - 2));
        for (let y = top + 1; y < BELT_Y; y++) g.scan(bx, y, '┊', C.white);
      }
      // the bug bin under the arch
      const y = FLOOR_Y - 4;
      g.text(BIN_X, y, '┌─BUGS─┐', C.grey);
      g.text(BIN_X, y + 1, '│``````│', C.grey);
      g.text(BIN_X, y + 2, '│``````│', C.grey);
      g.text(BIN_X, y + 3, '└──────┘', C.grey);
      for (let i = 0; i < Math.min(6, test.binned); i++) {
        const k = Math.floor(t * 1.3 + i * 2.1);
        g.put(BIN_X + 1 + ((k * 3 + i * 2) % 6), y + 1 + ((k + i) % 2), '¤', C.red);
      }
    },
    drawFx(g, t) {
      const b = test.bug;
      if (b) g.put(b.x, b.y, '¤', Math.floor(t * 10) % 2 ? C.red : C.white);
    },
  };

  // SHIP: packages drop into the dock, then a capsule rides the chute up through the roof.
  const ship = {
    capsules: [],
    launch(pkg, t) {
      w.remove(pkg);
      ship.capsules.push({ y: 26, vy: -2, t0: t });
      w.audio?.launch();
    },
    update(t, dt) {
      for (const c of ship.capsules) {
        c.vy -= 30 * dt;
        c.y += c.vy * dt;
        w.exhaust(STATION.ship + 0.5, c.y + 1.2);
        if (c.y < 2 && !c.done) {
          c.done = true;
          w.deploy();
          w.burst(STATION.ship, 3, 50, [C.white, C.amber, C.green, C.cyan], { speed: 22, gravity: 18, life: 1.4 });
          w.audio?.ship();
        }
      }
      ship.capsules = ship.capsules.filter((c) => !c.done);
    },
    draw(g) {
      const x = STATION.ship;
      for (let y = 3; y < 27; y++) {
        g.put(x - 2, y, '║', C.greyDark);
        g.put(x + 2, y, '║', C.greyDark);
      }
      g.text(x - 2, 2, '╨   ╨', C.greyDark);
      g.text(358 + 2, 11, 'DEPLOYED', C.cyanDim);
      bigText(g, 360, 13, String(w.deployed()).padStart(4, '0'), C.cyan);
    },
    drawFx(g) {
      for (const c of ship.capsules) {
        g.text(STATION.ship - 1, Math.round(c.y), '╱▲╲', C.white);
        g.text(STATION.ship - 1, Math.round(c.y) + 1, '▐█▌', C.steel);
      }
    },
  };

  return { why, plan, design, build, secure, test, ship };
}

function easeOutBack(p) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}
