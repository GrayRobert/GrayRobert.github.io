# How this was made

Every character on this page is text. No images, no video, no game engine. I built it by directing an AI coding agent, Claude Code, through a series of short phases, much the way I'd work with a team: a clear brief, small steps and honest reviews.

## Why a factory

I believe AI agents can help us build and ship good software, with people setting the direction and checking the work. Agents make mistakes too. They overcomplicate things, take shortcuts and miss the point. So I designed my CV as a dark factory, with ten robots for ten roles in software delivery, to show how the pieces fit together and the experience I bring to each.

## The brief

It started with one context file. It said what the page should be (an animated factory that is also a CV), the reaction it should get ("wait, this is just text?"), the ten roles, a visual direction and a technical plan. It also set the working rules:

- Never invent a fact about me. Ask.
- Look at it before saying it looks good. Screenshot every change.
- Keep it simple. No framework, no images, nothing loaded from anyone else's server.
- No em dashes. They make writing look machine made.

## The loop

Every phase ran the same way. The agent built it, opened it in a headless browser, took screenshots at 1080p, 4K and phone size, looked at them, fixed what was wrong, then wrote down what happened. I reviewed each phase and steered.

Some of the steering that shaped what you see:

- **"It's very cluttered now with all the robots."** The factory became a long line with a camera, and each station only lights up when the idea reaches it.
- **"I like the idea that ideas are scanned for WHY at the start."** The WHY gate asks who needs it, what value it brings, whether it's worth building, whether it's safe and whether it's allowed. No good answers, and the laser fires.
- **"I think the WHY gate should have an override for experiment or innovation."** Not knowing isn't a no. Unknowns drop into the lab for a small, time-boxed experiment, and either get promoted back to the line or kept as a lesson.
- **"Power and sound don't turn off."** Both levers were fixed, then tested by actually clicking them.
- **"I like the idea that it shows what I do to keep systems running."** The NOC and the 2am alert.
- **"It probably makes sense that the sprint demo happens after build or during build."** The demo room moved up under BUILD, so you can watch it run while the work is being built.
- **"We need to rework the CV and the descriptions so they are not coming across like I do everything."** The copy moved into Markdown files, I rewrote it in my own words, and the team got the credit for the doing.

## The tricks

- **One big grid of characters.** The factory is 470 by 54 cells drawn on a canvas. The screen shows a window of it and the camera glides along with a CSS transform, so motion is smooth while the art stays on the grid.
- **Lines and blocks are drawn, not typed.** Box drawing, block and shade characters are drawn as shapes, so every corner joins perfectly in every browser at every size.
- **Braille as tiny pixels.** A braille character is a 2 by 4 grid of dots. Sparks, the security dome and the NOC graphs are drawn with those dots, so they move and curve smoothly while still being text.
- **Glow without shaders.** The canvas is copied twice at low resolution and blurred, once for a halo and once for a bloom.
- **Robots are built from parts.** Heads, hats, antennas, bodies, legs, treads and tools. Each role is one line of settings.
- **The sound is made in the browser.** The hum, lever clunks, welding crackle, alarms, the transporter beam and robot chatter are all synthesised. There are no audio files.
- **The tour is a set of little scripts.** Each scene waits on the factory's own clock, so you can pause, jump or skip, and everything stays in step.
- **The words live in Markdown.** Every caption, card and line of robot small talk is in a plain text file, so the copy can change without touching the code.

## What went wrong

- The first font package had none of the box drawing characters, so the whole approach would have collapsed in silence. A glyph check caught it first.
- Half the factory vanished in the first screenshot. The CRT flicker was animating the canvas itself, and the browser stopped redrawing anything that wasn't moving.
- The first robot looked welded into the conveyor belt. The line went up on legs and the crew got their own floor.
- In screenshots, the good idea never left the intake. Live, it worked fine. The fast forward used for screenshots never let the tour scripts take their turn.
- The plain text CV stopped after two sections, because the page still couldn't scroll.

## Numbers

- About 125 KB of code and words, and a 92 KB font. No images.
- 120 frames a second in a desktop browser, with the factory using a small fraction of each frame.
- Built in phases over a few long sessions, with a screenshot review and a written log for every step.

## Built with

Claude Code for the building, Vite for bundling, JetBrains Mono for the type, and a lot of looking at screenshots.
