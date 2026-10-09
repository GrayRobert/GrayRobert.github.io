# Site content

Every word on the site lives in this folder. Edit a file, save it, and an open dev page (`npm run dev`) reloads with the change. Nothing else needs touching.

## Files

- `profile.md` is the top of the plain CV: name, role, tagline, summary, experience, education and interests.
- `roles/` has one file per robot. The number at the start sets the order, and the rest of the name is the robot's id (for example `02-cto.md` is the CTO robot, linked as `#agent-cto`).
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
```

The three lines between the `---` markers are the title, the pitch and a comma-separated list of tools. Under that, `## Skills` is a bullet list and `## Story` is plain text.

## House style

- No em dashes or en dashes, and no semicolons in page copy.
- Short sentences. Confident, warm, a little wry.
- Only real facts. If something is not known yet, write `TODO_ROBERT` and it shows as "to be written" on the card and is left out of the plain CV.
