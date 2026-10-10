// The CV as plain semantic HTML, built from the Markdown in content/. It is injected into index.html
// at build time (see vite.config.js), so search engines and screen readers get real
// text, and the "plain text CV" mode shows it. Unwritten items are simply left out.

const TODO = 'TODO_ROBERT';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const known = (list) => list.filter((s) => s && s !== TODO);
// Text with blank lines between paragraphs becomes one <p> per paragraph.
const paras = (s) => (s ? s.split('\n\n').map((p) => `<p>${esc(p)}</p>`).join('') : '');

export function renderCv(content) {
  const { person, agents } = content;
  const roles = agents
    .map((a) => {
      const skills = known(a.skills);
      const tools = known(a.tools);
      const story = a.story && a.story !== TODO ? paras(a.story) : '';
      return `
      <section class="cv-role" id="cv-${esc(a.id)}" aria-labelledby="cv-${esc(a.id)}-title">
        <h2 id="cv-${esc(a.id)}-title">${esc(a.title)}</h2>
        <p class="cv-pitch">${esc(a.pitch)}</p>
        ${skills.length ? `<ul>${skills.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
        ${story}
        ${tools.length ? `<p class="cv-tools"><span class="cv-label">Tools:</span> ${tools.map(esc).join(', ')}</p>` : ''}
      </section>`;
    })
    .join('');

  const jobs = (person.experience ?? [])
    .map((j) => {
      const head = [j.title && `<strong>${esc(j.title)}</strong>`, esc(j.org)].filter(Boolean).join(', ');
      return `<li>${head} <span class="cv-dates">${esc(j.dates)}</span>${paras(j.detail)}</li>`;
    })
    .join('');

  return `
    <header class="cv-head">
      <h1>${esc(person.name)}</h1>
      <p class="cv-role-line">${esc(person.role)}</p>
      <p class="cv-tagline">${esc(person.tagline)}</p>
      ${paras(person.summary)}
    </header>
    ${person.intro ? `<p class="cv-intro">${esc(person.intro)}</p>` : ''}
    ${roles}
    <section aria-labelledby="cv-experience">
      <h2 id="cv-experience">Experience</h2>
      <ul class="cv-jobs">${jobs}</ul>
    </section>
    <section aria-labelledby="cv-education">
      <h2 id="cv-education">Education</h2>
      <ul>${person.education.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    </section>
    ${person.interests ? `<section aria-labelledby="cv-interests"><h2 id="cv-interests">Interests</h2>${paras(person.interests)}</section>` : ''}`;
}
