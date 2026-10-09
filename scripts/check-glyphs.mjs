// Checks which glyphs a font actually contains, so we never rely on silent fallback.
import opentype from 'opentype.js';
import fs from 'node:fs';

const file = process.argv[2];
const chars = process.argv[3] ?? '─│┌┐└┘├┤┬┴┼╔═╗║╚╝╠╣╦╩╬╭╮╯╰░▒▓█▀▄▌▐■□▪▫◆◇●○◉◎◐◑◒◓▲▼◀▶⠁⠂⠄⡀⣿⠿⢸⡇╓╖╙╜╒╕╘╛┃━┏┓┗┛';
const buf = fs.readFileSync(file);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
const missing = [...chars].filter((c) => font.charToGlyphIndex(c) === 0);
const adv = new Set([...chars].filter((c) => !missing.includes(c)).map((c) => font.charToGlyph(c).advanceWidth));
console.log(`${file.split('/').pop()}: ${font.numGlyphs} glyphs, upm ${font.unitsPerEm}`);
console.log('missing:', missing.join(' ') || 'none');
console.log('advance widths of present glyphs:', [...adv].join(','));
