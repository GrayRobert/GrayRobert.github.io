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
