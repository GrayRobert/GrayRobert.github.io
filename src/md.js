// A tiny Markdown to HTML converter for the "how this was made" page. Handles just what
// that page uses: headings, paragraphs, bullet lists, bold, inline code and links.

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

export function renderMarkdown(md) {
  const out = [];
  let list = null;
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
    if (list) out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`);
    list = null;
  };
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    const h = line.match(/^(#{1,3}) (.*)$/);
    if (!line) flush();
    else if (h) {
      flush();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (line.startsWith('- ')) {
      if (para.length) flush();
      (list ??= []).push(line.slice(2));
    } else {
      if (list) flush(); // a paragraph after a list closes the list first
      para.push(line);
    }
  }
  flush();
  return out.join('\n');
}
