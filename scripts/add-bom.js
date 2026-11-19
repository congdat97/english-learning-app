const fs = require('fs');
const path = require('path');

const target = path.join('dist', 'english-learning-app', 'browser', 'index.html');
const buffer = fs.readFileSync(target);

if (!(buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF)) {
  fs.writeFileSync(target, Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), buffer]));
}

console.log('BOM added');
