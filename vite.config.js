import { defineConfig } from 'vite';
import fs from 'node:fs';
import { renderCv } from './src/cv.js';
import { renderMarkdown } from './src/md.js';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Puts the full CV and the "how this was made" page into index.html as real HTML.
function pagesHtml() {
  return {
    name: 'pages-html',
    transformIndexHtml(html) {
      const content = JSON.parse(fs.readFileSync('src/content.json', 'utf8'));
      const making = fs.readFileSync('src/making.md', 'utf8');
      return html.replace('<!-- CV -->', renderCv(content)).replace('<!-- MAKING -->', renderMarkdown(making));
    },
  };
}

export default defineConfig({
  // One self-contained index.html: code, styles and the font are all inlined.
  plugins: [pagesHtml(), viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 1e7 },
});
