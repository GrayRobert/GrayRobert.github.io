import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { renderCv } from './src/cv.js';
import { renderMarkdown } from './src/md.js';
import { loadContent } from './src/content-loader.js';
import { viteSingleFile } from 'vite-plugin-singlefile';

// All the site's words live in content/ as Markdown.
//  - "virtual:content" gives the page { person, agents } for the skill cards.
//  - index.html gets the full CV and the "how this was made" page as real HTML.
// Editing any file in content/ reloads the page in dev.
function content() {
  const id = 'virtual:content';
  const contentDir = path.resolve('content');
  return {
    name: 'content',
    resolveId: (source) => (source === id ? '\0' + id : null),
    load: (key) => (key === '\0' + id ? `export default ${JSON.stringify(loadContent())};` : null),
    transformIndexHtml(html) {
      const making = fs.readFileSync('content/making.md', 'utf8');
      return html.replace('<!-- CV -->', renderCv(loadContent())).replace('<!-- MAKING -->', renderMarkdown(making));
    },
    configureServer(server) {
      server.watcher.add(contentDir);
      const reload = (file) => {
        if (!file.startsWith(contentDir)) return;
        const mod = server.moduleGraph.getModuleById('\0' + id);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.config.logger.info(`content changed: ${path.relative(contentDir, file)}`, { timestamp: true });
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.on('change', reload);
      server.watcher.on('add', reload);
      server.watcher.on('unlink', reload);
    },
  };
}

export default defineConfig({
  // One self-contained index.html: code, styles and the font are all inlined.
  plugins: [content(), viteSingleFile()],
  build: { target: 'es2022', assetsInlineLimit: 1e7 },
});
