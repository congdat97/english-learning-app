/**
 * Generate avatar SVG cục bộ (không cần gọi API ngoài khi chạy app).
 * Render từ @dicebear/core + @dicebear/styles -> public/avatars/*.svg
 */
import { Style, Avatar } from '@dicebear/core';
import avataaars from '@dicebear/styles/avataaars.json' with { type: 'json' };
import lorelei from '@dicebear/styles/lorelei.json' with { type: 'json' };
import notionists from '@dicebear/styles/notionists.json' with { type: 'json' };
import openPeeps from '@dicebear/styles/open-peeps.json' with { type: 'json' };
import bottts from '@dicebear/styles/bottts.json' with { type: 'json' };
import thumbs from '@dicebear/styles/thumbs.json' with { type: 'json' };
import { mkdirSync, writeFileSync } from 'node:fs';

const outDir = new URL('../public/avatars/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(outDir, { recursive: true });

const styles = {
  avataaars,
  lorelei,
  notionists,
  'open-peeps': openPeeps,
  bottts,
  thumbs
};

const seeds = ['Leo', 'Mai', 'Son', 'Hoa', 'Kai', 'Yen', 'Luna', 'Orion'];
const backgrounds = ['b6e3f4', 'ffd5dc', 'c0aede', 'ffdfbf', 'd1d4f9', 'd3d4dd', 'ffeaa7', 'b8f2d8'];

let count = 0;
for (const [styleName, definition] of Object.entries(styles)) {
  for (let i = 0; i < seeds.length; i++) {
    const style = new Style(definition);
    const svg = new Avatar(style, {
      seed: seeds[i],
      size: 96,
      backgroundColor: backgrounds[i],
      borderRadius: 48
    }).toString();
    const file = `${styleName}-${seeds[i].toLowerCase()}.svg`;
    writeFileSync(outDir + file, svg, 'utf8');
    count++;
  }
}

console.log(`Generated ${count} avatars -> public/avatars/`);
