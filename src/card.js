// Skill cards. Real HTML in a native <dialog>, so the text is selectable, readable by
// screen readers, and closes with Escape. Content comes only from the Markdown in content/.

import content from 'virtual:content';

const TODO = 'TODO_ROBERT';

export function createCards() {
  const dialog = document.createElement('dialog');
  dialog.className = 'card';
  dialog.setAttribute('aria-labelledby', 'card-title');
  document.body.append(dialog);

  // Clicking the dim backdrop (outside the panel) closes it.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  function open(id) {
    const agent = content.agents.find((a) => a.id === id);
    if (!agent) return false;
    dialog.replaceChildren(render(agent));
    dialog.showModal();
    dialog.querySelector('.card-close').focus();
    return true;
  }

  return { open, get isOpen() { return dialog.open; }, close: () => dialog.close() };
}

function render(agent) {
  const frag = document.createDocumentFragment();
  frag.append(
    el('div', { className: 'card-bar' }, [
      el('h2', { id: 'card-title' }, [`┤ ${agent.title}`]),
      el('button', { className: 'card-close', type: 'button', ariaLabel: 'Close', onclick: (e) => e.target.closest('dialog').close() }, ['[x]']),
    ]),
    el('p', { className: 'card-pitch' }, [text(agent.pitch)]),
    el('h3', {}, ['skills']),
    el('ul', {}, agent.skills.map((s) => el('li', {}, [text(s)]))),
    el('h3', {}, ['story']),
    ...agent.story.split('\n\n').map((p) => el('p', {}, [text(p)])),
    el('h3', {}, ['tools']),
    el('p', { className: 'card-tools' }, agent.tools.map((s) => el('span', {}, [text(s)]))),
  );
  return frag;
}

// Unwritten content shows as an obvious placeholder, never as invented copy.
function text(s) {
  return s === TODO ? el('span', { className: 'todo' }, ['to be written']) : s;
}

function el(tag, props, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'ariaLabel') node.setAttribute('aria-label', v);
    else node[k] = v;
  }
  node.append(...children);
  return node;
}
