import { defineConfig } from 'vite';
import fs from 'node:fs';
import { renderCv } from './src/cv.js';

// Puts the full CV into index.html as real HTML, from content.json.
function cvHtml() {
  return {
    name: 'cv-html',
    transformIndexHtml(html) {
      const content = JSON.parse(fs.readFileSync('src/content.json', 'utf8'));
      return html.replace('<!-- CV -->', renderCv(content));
    },
  };
}

export default defineConfig({
  plugins: [cvHtml()],
  build: { target: 'es2022' },
});
