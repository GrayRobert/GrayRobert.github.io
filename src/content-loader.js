// Reads the site's words from Markdown files in content/ and returns the same shape
// the site has always used: { person, agents }. Runs at build time (in Node), via the
// virtual:content module in vite.config.js.
//
//   content/profile.md        name, role, tagline, summary, experience, education, interests
//   content/roles/01-ceo.md   one file per robot. The number sets the order, the rest is its id.
//
// A role file has a little front matter (title, pitch, tools) and two sections:
// "## Skills" as a bullet list and "## Story" as plain paragraphs.

import fs from 'node:fs';
import path from 'node:path';

export function loadContent(dir = 'content') {
  const person = parseProfile(read(path.join(dir, 'profile.md')));
  const roleDir = path.join(dir, 'roles');
  const agents = fs
    .readdirSync(roleDir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => parseRole(f.replace(/^\d+-/, '').replace(/\.md$/, ''), read(path.join(roleDir, f))));
  const tourFile = path.join(dir, 'tour.md');
  const tour = fs.existsSync(tourFile) ? parseTour(read(tourFile)) : {};
  return { person, agents, tour };
}

// House style: no em dashes, en dashes or semicolons in the copy. Returns one
// "file:line  text" string per offending line, for the build to print as a warning.
export function styleProblems(dir = 'content') {
  const files = ['profile.md', 'tour.md', 'making.md', ...fs.readdirSync(path.join(dir, 'roles')).map((f) => path.join('roles', f))];
  const problems = [];
  for (const f of files.filter((f) => f.endsWith('.md'))) {
    read(path.join(dir, f))
      .split('\n')
      .forEach((line, i) => /[—–;]/.test(line) && problems.push(`content/${f}:${i + 1}  ${line.trim()}`));
  }
  return problems;
}

// tour.md: "## scene" headings, then "- key: text" lines.
function parseTour(text) {
  const out = {};
  for (const [scene, body] of Object.entries(sections(text))) {
    out[scene] = {};
    for (const line of body.split('\n')) {
      const m = line.match(/^- ([a-z0-9-]+): (.*)$/);
      if (m) out[scene][m[1]] = m[2].trim();
    }
  }
  return out;
}

function read(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

// "---\nkey: value\n---\nbody" -> { meta, body }
function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m[2] };
}

// Splits a body into { heading: text } on "## " lines.
function sections(body, level = '## ') {
  const out = {};
  let key = null;
  for (const line of body.split('\n')) {
    if (line.startsWith(level)) {
      key = line.slice(level.length).trim().toLowerCase();
      out[key] = '';
    } else if (key) {
      out[key] += line + '\n';
    }
  }
  return out;
}

const bullets = (text = '') => text.split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
const paragraphs = (text = '') => text.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean).join('\n\n');
const list = (value = '') => value.split(',').map((s) => s.trim()).filter(Boolean);

function parseRole(id, text) {
  const { meta, body } = frontMatter(text);
  const s = sections(body);
  return {
    id,
    title: meta.title,
    pitch: meta.pitch,
    skills: bullets(s.skills),
    story: paragraphs(s.story),
    tools: list(meta.tools),
    says: bullets(s.says), // the robot's small talk in explore mode
  };
}

function parseProfile(text) {
  const { meta, body } = frontMatter(text);
  const s = sections(body);
  // Experience: "### Title | Org | Dates", or "### Org | Dates" with a "#### Title" line
  // under it, then one or more paragraphs of detail.
  const experience = [];
  let detail = '';
  const finish = () => experience.length && (experience.at(-1).detail = paragraphs(detail));
  for (const line of (s.experience ?? '').split('\n')) {
    if (line.startsWith('#### ') && experience.length) {
      experience.at(-1).title = line.slice(5).trim();
    } else if (line.startsWith('### ')) {
      finish();
      detail = '';
      const parts = line.slice(4).split('|').map((x) => x.trim());
      const [title, org, dates] = parts.length >= 3 ? parts : ['', parts[0], parts[1] ?? ''];
      experience.push({ title, org, dates, detail: '' });
    } else {
      detail += line + '\n';
    }
  }
  finish();
  return {
    name: meta.name,
    role: meta.role,
    tagline: meta.tagline,
    description: meta.description,
    intro: meta.intro,
    summary: paragraphs(s.summary),
    experience,
    education: bullets(s.education),
    interests: paragraphs(s.interests),
  };
}
