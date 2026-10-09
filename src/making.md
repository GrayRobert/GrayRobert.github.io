# How this was made

Every character on this page is text. No images, no video, no game engine. Robert built it by directing an AI coding agent, Claude Code, through a series of short phases, the same way he runs a real team: a clear brief, small steps, honest reviews.

## The brief

It started with one context file. It said what the page should be (an animated factory that is also a CV), the reaction it should get ("wait, this is just text?"), the ten roles, a visual direction and a technical plan. It also set the working rules:

- Never invent a fact about Robert. Ask.
- Look at it before saying it looks good. Screenshot every change.
- Keep it simple. No framework, no images, nothing loaded from anyone else's server.
- No em dashes. They make writing look machine made.

## The loop

Every phase ran the same way. Build it, open it in a headless browser, screenshot it at 1080p, 4K and phone size, look at the screenshots, fix what is wrong, then write down what happened. Robert reviewed each phase and steered.

Some of the steering that shaped what you see:

- **"It's very cluttered now with all the robots."** The factory became a long line with a camera, and each station only lights up when the idea reaches it.
- **"I like the idea that ideas are scanned for WHY at the start."** The WHY gate asks who uses it, will they pay, what's the return, is it secure, is it allowed. No good answers, and the laser fires.
- **"Power and sound don't turn off."** Both levers were fixed, then tested by actually clicking them.
- **"I like the idea that it shows what I do to keep systems running."** The NOC and the 2am alert.
- **"Robert Gray, a CTO and Engineering Manager, can run an entire dark factory, a fleet of AI agents, real teams, or just do it all."** That became the line the whole site is built around.

## The tricks

- **One big grid of characters.** The factory is 470 by 54 cells drawn on a canvas. The screen shows a window of it and the camera glides along with a CSS transform, so motion is smooth while the art stays on the grid.
- **Lines and blocks are drawn, not typed.** Box drawing, block and shade characters are drawn as shapes, so every corner joins perfectly in every browser at every size.
- **Braille as tiny pixels.** A braille character is a 2 by 4 grid of dots. Sparks, the security dome and the NOC graphs are drawn with those dots, so they move and curve smoothly while still being text.
- **Glow without shaders.** The canvas is copied twice at low resolution and blurred, once for a halo and once for a bloom.
- **Robots are built from parts.** Heads, antennas, bodies, legs, treads, wheels and tools. Each role is one line of settings.
- **The sound is made in the browser.** The hum, lever clunks, welding crackle, alarms and robot chatter are all synthesised. There are no audio files.
- **The tour is ten little scripts.** Each scene waits on the factory's own clock, so you can pause, jump or skip, and everything stays in step.

## What went wrong

- The first font package had none of the box drawing characters, so the whole approach would have collapsed in silence. A glyph check caught it first.
- Half the factory vanished in the first screenshot. The CRT flicker was animating the canvas itself, and the browser stopped redrawing anything that wasn't moving.
- The first robot looked welded into the conveyor belt. The line went up on legs and the crew got their own floor.
- In screenshots, the good idea never left the intake. Live, it worked fine. The fast forward used for screenshots never let the tour scripts take their turn.
- The plain text CV stopped after two sections, because the page still couldn't scroll.

## Numbers

- About 80 KB of code and a 92 KB font. No images.
- 120 frames a second in a desktop browser, with the factory using a small fraction of each frame.
- Built in phases over a few long sessions, with a screenshot review and a written log for every step.

## Built with

Claude Code for the building, Vite for bundling, JetBrains Mono for the type, and a lot of looking at screenshots.
