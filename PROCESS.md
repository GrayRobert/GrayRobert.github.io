# PROCESS

A running log of how this site is being built: prompts, decisions, what broke and how it got fixed. This becomes the "making of" layer.

## Phase 0: the spike

**Date:** 2026-10-09
**Agent:** Claude Code (Claude Opus 5.5), working from `dark-factory-cv-context.md`
**Goal:** prove a character grid renderer with one robot walking and one conveyor at 60fps, glowing and crisp.

### The prompt

The whole brief was handed over as one context file. Phase 0's instruction, in short: build the ASCII grid renderer and one animated robot on a moving conveyor, glowing on a dark background, screenshot it in a headless browser and say what to improve before Phase 1.

### Decisions

- **Grid of 180 x 54 cells, cell ratio 1 : 1.9.** Picked so the grid is close to 16:9 and never reflows. The cell size is a whole number of device pixels, so a 4K screen gets 21 x 40 pixel cells and everything stays sharp.
- **Canvas, not DOM text.** Each frame, the scene writes characters and palette colours into two typed arrays. The renderer compares them with last frame and repaints only the cells that changed.
- **A glyph atlas.** Every (character, colour) pair is drawn once into an offscreen atlas, then cells are copied with `drawImage`. It's faster than `fillText`, and clipping each atlas slot stops glyphs bleeding into neighbours.
- **Box drawing, blocks, shades and braille are drawn as rectangles, not font glyphs.** Font box characters often leave hairline gaps or overlap depending on line height and browser. Drawing them procedurally means `║` always meets `═`, at every size, in every browser. Each box character is described as four arms (up, right, down, left) with a weight: light, heavy or double. One routine handles corners, tees and crossings.
- **Braille as a particle layer.** A braille character is a 2 x 4 grid of dots, so `grid.dot(x, y)` gives sparks eight sub-positions per cell. They move smoothly while staying pure text. Particles never overwrite real glyphs, so sparks fly behind labels instead of eating them.
- **Glow without per-glyph blur.** The canvas is copied into two small canvases (1/3 and 1/8 size). CSS blurs them and screen-blends them underneath, giving a tight halo plus a wide bloom. Cheap on the GPU.
- **Robots are generated, not drawn.** `makeRobot({ label, head, antenna, accent, eye })` builds a robot from parts. A pose object drives legs, arm swing, eye direction, blink, mouth, mood, chest lights and a wave. Ten roles will be ten parameter sets.
- **Belt moves in whole cell steps.** Packages and belt cleats share one step counter, so they never drift apart by a frame.
- **No GSAP yet.** Phase 0 only needs easing on the robot's walk, so it has a one-line ease. GSAP comes in with the master timeline in Phase 2.

### What went wrong, and the fixes

1. **The font subset had no box drawing characters.** The `@fontsource` JetBrains Mono package splits the font by language, and its latin subset has none of `─ │ ═ ░ █` or braille. A cmap check script (`npm run glyphs`) caught this before anything was drawn. Fix: bundle the full JetBrains Mono 2.304 webfont from JetBrains' own GitHub release (OFL licence included). Even the full font has no braille, which the procedural renderer covers anyway.
2. **Typo'd pixel font.** The first version of the 5 x 5 block letter font was packed into 25 character strings by hand, and some were 24 long. Rewritten as five space separated rows per letter so it can be read and checked at a glance.
3. **Half the factory vanished in the first screenshot.** Everything static (roof, monitors, most letters of the sign) was missing, and everything animated was fine. A probe showed the pixels were on the canvas, so it was a compositing bug. The CRT flicker animated the canvas's own `opacity`, and Chrome then dropped regions that weren't repainted that frame. Fix: the flicker now animates a dark overlay above the canvas, never the canvas itself. Rule for later: never animate CSS properties on the main canvas.
4. **The robot looked welded into the conveyor.** At 12 rows tall, its body sat exactly on the belt rollers. Fix: the line now runs on tall braced legs, and the crew walks a floor lane underneath. That's a classic two-tier cutaway, and it leaves the line clear for stations.
5. **Sparks overwrote package labels** (`</> code` became `< >  o e`). Fix: separate "empty" (code 0) from "opaque blank" (a space), and particles only draw into empty or braille cells.

### Measurements

- Real browser (Chromium with GPU, 1512 x 945 at 2x DPR, canvas 2880 x 1620): **120 fps**, simulation plus paint **0.3 ms** average, 1.2 ms worst.
- Headless Chromium (software compositing, no GPU): 25 to 30 fps. That's the virtual machine, not the page. JavaScript work is still 1.3 to 2.5 ms at 1080p.
- Build: 22 KB JavaScript (10 KB gzipped), 1.4 KB CSS, plus 92 KB for the font.

### Tools added

- `npm run shoot`: starts Vite, opens headless Chromium at 1080p and at 4K (2x DPR), saves screenshots to `shots/` plus a close-up of the robot, and prints frame stats. Extra shots: `node scripts/shoot.mjs name='query'`.
- `npm run glyphs -- <font.ttf> '<chars>'`: lists which characters a font is missing.
- URL switches: `?glyphs` (glyph test sheet), `?fps` (stats overlay), `?nocrt`, `?t=14` (fast forward the simulation), `?say=ship%20it.` (make the robot talk), `?seed=7`.
- Keys: `space` pause, `c` CRT, `g` glow, `f` stats.

## Phase 1: the crew, the power lever and the first skill cards

**Date:** 2026-10-09

### What Robert asked for after Phase 0

- Remove the "CTO · Topflight · The Dark Factory" line under the sign. Just the name.
- Start with the factory off and a lever to turn it on. Sound on by default, with a mute lever that's part of the factory.
- He couldn't find anything to click. Skill cards were planned for Phase 3, so a working version was pulled forward.
- No PDF, GitHub or LinkedIn for now. "This is the CV."

### Decisions

- **One screen, no camera yet.** Phase 1's acceptance says "whole factory visible", and ten robots fit in 180 x 54 cells with a three-level layout: boardroom, catwalk and control tower on top, the line in the middle, the crew floor underneath. Panning can arrive with the guided tour if it's needed.
- **Robots are built from parts.** Antennas (tip, twin, dish), heads (monitor, dome, goggles, beret, hard hat, visor, single eye, split colour), bodies (standard, tall, wide, slim, stocky, heavy), legs, treads or a wheel, plus a tool in one hand (clipboard, kanban board, stylus, palette, magnifier, cable plug, shield). Each role is about one line of config.
- **Silhouette first, colour second.** The palette only has four hues, so roles are told apart by shape. The colours repeat but the shapes don't.
- **Power on is a cascade.** Each part of the factory has a wake time. It flickers for half a second, then stays lit: lever, sign (letter by letter), boardroom, catwalk, tower, then the belt spins up and the crew wake one by one. Anything not yet awake is drawn through a grid colour override, so "unlit" is one line around any drawing code.
- **Levers are springs.** An underdamped spring makes the handle slam past its stop and settle, which feels heavy.
- **Sound is synthesised.** WebAudio makes the hum (detuned saws through a breathing lowpass), the lever clunk, the welding crackle, robot chatter blips and a two-note chime per shipped package. No audio files. The mute choice is remembered in localStorage.
- **Skill cards are real HTML.** A native `<dialog>`: selectable text, Escape to close, readable by screen readers. All text comes from `content.json`. Anything Robert hasn't supplied yet says "to be written" in amber, never invented copy.
- **Clicks use the grid.** Each frame, everything clickable registers a rectangle in cells. A pointer position becomes a cell, and the topmost rectangle wins.

### What went wrong, and the fixes

1. **The start hint landed on top of the sleeping CEO.** It moved to the empty band above the belt as a callout, with a trail of marching dots leading back to the lever.
2. **Sleeping robots still glowed.** The hard hat, beret and shield have their own colours in the part masks. Fix: draw sleeping robots entirely through the unlit colour override.
3. **Scanner beams erased package labels.** Fix: `grid.scan()` recolours whatever is already in a cell and only draws a beam character into empty cells, so the beam sweeps across text instead of replacing it.
4. **The full stack robot parked on top of other robots.** It now shuttles between two docking spots, the database and the UI rack, which is closer to the brief anyway.
5. **Control tower log lines were clipped** at 13 characters. They were shortened to fit.

### New debug switches

`?on` (skip the lever), `?pause`, `?card=cto`, `?hover=devops`, `?say=hello&who=pm`. Key `m` toggles sound, and Enter or Space pulls the power lever.

## Phase 2: the guided tour

**Date:** 2026-10-09

### What Robert asked for after Phase 1

- "It's very cluttered now with all the robots." Spread it out, and introduce robots a few at a time rather than all at once.
- Turn the entrance scanner into a **WHY gate**: ideas are checked for who uses it, will they pay, ROI, security and governance. A laser destroys ideas without a clear value proposition.
- Move security further along the line, before QA.

### Decisions

- **A long line and a camera.** The world grew to 400 x 54 cells, with stations in story order: WHY, PLAN, DESIGN, BUILD, SECURE, TEST, SHIP. The screen still shows 180 columns. The canvas holds the whole world and the camera moves it with a CSS transform, so pans and zooms are smooth and sub-cell while the art stays on the grid. The overview zooms out to show the whole factory at once.
- **Lights follow the product.** Every zone stays dark until the idea arrives, then flickers on and its robots wake. That answers "introduce some but not all at once" without hiding anyone for good.
- **The lever panel became a HUD.** It is drawn with the same grid and renderer, on its own small canvas pinned to the top-left corner, so mute stays in reach wherever the camera is.
- **Scenes are small async scripts on the simulation clock.** For example: `await carry(hero, 'plan'); say('cto', 'build, not buy.'); await wait(1.8); stamp(hero)`. Waits resolve from the simulation, so pause works and a jump cancels everything pending. Jumping to any scene first settles the factory into the state the earlier scenes would have left it in: zones lit, the idea parked at the previous station at the right stage.
- **Two belt modes.** During the tour the belt only moves when a script asks it to carry the idea to a station, then stops there for the moment. In explore mode it runs freely, new ideas keep arriving, about a quarter of them are lasered at the WHY gate, a fifth hit a bug at QA, and intruders try their luck every 40 to 65 seconds.
- **Same station code for both.** Each station exposes actions (check, zap, stamp, project, weld, attack, raise dome, scan, fix, launch). The tour calls them on cue. Explore mode triggers them as packages pass.
- **The shield dome is braille.** An ellipse plotted as hundreds of sub-cell dots gives a smooth curve that's still pure text. Intruders burst into sparks when they touch it.
- **Navigation:** a scene strip of real buttons, URL hashes (`#build`, `#agent-qa`), arrow keys, Space and the mouse wheel during the tour, Escape to skip. In explore mode: drag or wheel to pan, arrows to hop between stations. `window.deck` mirrors the inspiration's debug navigator.

### What went wrong, and the fixes

1. **The good idea never left the intake in screenshots.** Live it worked. The fast-forward used for screenshots ran the simulation in a tight loop, and tour scripts continue in promise callbacks that never got a turn. Fix: the fast-forward yields a few microtask turns after every step.
2. **The fixed lever panel covered the catwalk** once the camera panned. Fix: a compact 13 x 9 panel tucked under the roof in the top-left corner.
3. **Speech bubbles covered neighbouring robots.** Fix: a bubble goes on whichever side of the head is clear of other robots.
4. **"PLANN"** on the plan press, from overlapping text. **"SËCURË"**, because the roof vents sat on top of the zone label. Both moved.
5. **The zone divider cut through the name sign**, and "PLAN" sat right after "ROBERT GRAY" so it read as one phrase. The divider is skipped there and the PLAN label moved right.

### Timing

The whole tour runs from lever to explore mode in about 90 seconds: boot 0s, overview 6.6s, why 14.5s, plan 30s, design 40.4s, build 47.6s, secure 58.2s, test 70.8s, ship 80.3s, explore 90s.

## Phase 3: the CV itself, keyboard, phones, and real content

**Date:** 2026-10-09

### What Robert gave and asked for

- His Word CV. Every skill card is now filled from it, and nothing on the cards is invented. Contact details are left off the site.
- "What the CV is trying to say is that Robert Gray, a CTO and Engineering Manager, can run an entire dark factory, a fleet of AI agents, real teams, or just do it all." That line is now the spine of the copy: the page description, the opening of the plain CV, and the tour's intro caption.
- "Power and sound don't turn off." PWR now switches the factory off: lights out, belt stopped, audio engine suspended. Pulling it again resumes the tour where it was. SND was tested in a real browser and drops the output to exactly zero.

### Decisions

- **The CV is real HTML in the page,** built from `content.json` by a tiny Vite plugin at build time. Screen readers and search engines get the actual text. In factory mode it's visually hidden. The "≡ plain CV" button (or a `#cv` link) shows it as a clean page with roles, experience, education and interests.
- **Every robot is a real button.** A visually hidden "Meet the crew" list has one button per role. Focusing one glides the camera to that robot and lights it up, so the robot itself is the focus indicator. Enter opens its card, and Escape returns focus to the robot. There's a skip link to the plain CV at the very top.
- **Phones get a closer camera,** not a squashed factory. The view drops from 180 columns to about 64 on a phone, so cells stay at least 6px wide and the text stays readable. The tour has its own framing for each station at that width, the opening shot zooms just enough to fit the name sign, and the factory sits higher so the caption and scene strip don't cover it. Touch devices also skip the wide bloom and the CRT overlay, and cap the canvas size for mobile browser limits.
- **Reduced motion** (the system setting) gets the factory fully lit and still, in explore mode, with everything still clickable.

### What went wrong, and the fixes

1. **The plain CV stopped after two sections.** `html` still had `overflow: hidden` from the factory layout. Plain mode now unlocks scrolling on both `html` and `body`.
2. **Resizing while the plain CV was showing broke the factory.** The hidden stage measured 0 x 0, so the cell size became NaN. Sizing now skips while hidden and re-runs on the way back.
3. **On a phone, the opening shot cut the name sign in half** and the lever callout ran off screen. The opening view zooms to fit the sign, and the callout wraps onto shorter lines.
4. **Speech bubbles still covered neighbours in the crowded build zone.** When both sides are taken, the bubble goes above the head.
5. **Two places where the CV disagreed with the original brief:** the engineer to TPM to CTO progression was at Topflight Travel Group (not Directski.com), and the BSc ran 2017 to 2019. The CV wins. The "BSc in one year" claim is left out until Robert confirms it.

## Phase 4: the NOC, the 2am alert, and how this was made

**Date:** 2026-10-09

### What Robert asked for

- Answers to the open questions. The BSc took two years, as the CV says. Topflight merged with Directski to become Topflight Travel Group, and he never left either, so the experience section shows one continuous role with a single line about the merger. He wasn't sure whether to split them, so this is easy to change.
- "I like the idea that it shows what I do to keep systems running, perhaps it would be part of the tour where we have a NOC (network operations centre) with screens and lots of monitoring going on, and like that perhaps it's a robot sleeping on a bed being woken up by alerts at 2am and responding immediately."

### Decisions

- **The NOC is the last stop on the line,** after SHIP: shipping is not the end. The world grew to 470 columns. The room has a big clock, a status panel, three live graphs (cpu, heap, traffic), a server rack, a console desk and a bed.
- **The OPS robot lives there, on a clock.** In explore mode the factory clock runs ten minutes per second, so a day takes about 2.4 minutes. The robot works the console by day, goes to bed at 23:00, and a memory leak builds overnight. You can watch the heap graph creep from green to amber to red. At 02:00 the alarm goes, the room turns red, the robot springs out of bed ("on it."), rushes to the console, takes a heap dump, redeploys, waits for health checks, and goes back to bed ("back to bed."). At 07:00 it gets up for work.
- **The NOC directs the robot.** The robot became a "puppet" the NOC moves around, rather than a patroller. When it's in bed, the NOC draws a hard hat on a pillow and a breathing blanket, and clicking the bed still opens its skill card.
- **The graphs are braille line charts:** two dots across and four down per cell, so they curve smoothly.
- **The tour got a "2am" scene** after SHIP. It sets the clock to a few minutes before 2am and lets the NOC's own logic play out, with captions following its phases. The tour now runs about 105 seconds in total.
- **"How this was made" is a curated page,** not the raw log. `src/making.md` is written for visitors and rendered into the page at build time by a tiny Markdown converter. The raw PROCESS.md has internal back-and-forth that isn't meant for an audience.

### What went wrong, and the fixes

1. **The graphs didn't draw at all at first.** Braille dots only go into empty cells, and the room filled its interior with opaque blanks to hide the wall behind it. Fix: `grid.erase()` clears the room to truly empty cells.
2. **A page error repeated in explore mode** (the PM's kanban animation indexed outside its table). Fix: the index is clamped to 0 to 5. Explore ran clean for 50 seconds through a full incident afterwards.
3. **The "on it" bubble covered the console** the robot was rushing to. The OPS robot now always speaks above its head.
4. **The making-of quoted Robert loosely** inside quote marks. The quotes are now his actual words.

### Measurements

Real browser, 1512 x 945 at 2x, canvas 7520 x 1620: 120 fps, 0.5 ms of work per frame, 1.1 ms worst.
