# Site content

Every word on the site lives in this folder. Edit a file, save it, and an open dev page (`npm run dev`) reloads with the change. Nothing else needs touching.

## Files

- `profile.md` is the top of the plain CV: name, role, tagline, summary, experience, education and interests. Its `description` line is the text search engines and link previews (LinkedIn, Slack) show.
- `roles/` has one file per robot: its skill card and what it says. The number at the start of the file name sets the order, and the rest is the robot's id (for example `02-cto.md` is the CTO robot, linked as `#agent-cto`).
- `tour.md` is every caption in the guided tour, scene by scene, plus the lines robots say during it, the boot log and the "pull the lever" hint.
- `making.md` is the "how this was made" page.

## A role file

```markdown
---
title: CTO
pitch: One line under the title on the skill card.
tools: Java, Python, React
---
## Skills

- One achievement or skill per bullet

## Story

A short paragraph or two.

## Says

- something the robot says now and then
- another one
```

The three lines between the `---` markers are the title, the pitch and a comma-separated list of tools. Then `## Skills` is a bullet list, `## Story` is plain text, and `## Says` is the robot's small talk in explore mode (one line per bullet, kept short so it fits a speech bubble).

## tour.md

Each line is `- key: text`. Change the text after the colon freely, but leave the key before it alone, because that is how the tour finds the line. If a key goes missing, the tour shows `[missing scene.key]` on screen so it is easy to spot. Captions stay up long enough to be read, so longer text simply stays on screen longer.

## House style

- No em dashes or en dashes, and no semicolons in page copy.
- Short sentences. Confident, warm, a little wry.
- Only real facts. If something is not known yet, write `TODO_ROBERT` and it shows as "to be written" on the card and is left out of the plain CV.
- Give the team the doing. Use "led", "brought in", "pushed for" for team outcomes, and keep "built" and "wrote" for things done hands-on.
