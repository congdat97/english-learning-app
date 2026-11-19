const fs = require('fs');
const path = require('path');

const target = path.join('dist', 'english-learning-app', 'browser', 'index.html');
const buildId = `${Date.now().toString(36)}-${process.env.RENDER_GIT_COMMIT || 'local'}`;

let text = fs.readFileSync(target, 'utf8');
const hadBom = text.charCodeAt(0) === 0xfeff;
if (hadBom) text = text.slice(1);

text = text.replace(/__BUILD_ID__/g, buildId);

if (!text.startsWith('\ufeff')) {
  text = '\ufeff' + text;
}

fs.writeFileSync(target, text, 'utf8');

console.log('BOM added, build id:', buildId);
