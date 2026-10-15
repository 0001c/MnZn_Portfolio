const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
for (const file of ['assets/portfolio-model.js', 'assets/portfolio-content.js', '_workspace/editor/assets/content-editor.js']) new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'));
const data = JSON.parse(fs.readFileSync(path.join(root, 'content/portfolio.json'), 'utf8'));
assert.deepEqual(require('../../assets/portfolio-model.js').validate(data), [], 'portfolio content fields');
for (const item of data.projects) for (const media of [item.cover, ...item.images]) {
  if (!/^https?:\/\//i.test(media)) assert(fs.statSync(path.join(root, media)).size > 0, media);
}
const assets = [...html.matchAll(/(?:src|poster|href)="([^"]+)"/g)].map(match => match[1]).filter(value => !/^(?:#|data:|https?:)/.test(value));
assets.push('assets/images/人物九方向-3x3.webp', 'assets/videos/尾部视频.mp4');
for (const asset of assets) assert(fs.statSync(path.join(root, asset)).size > 0, asset);
const captions = [...html.matchAll(/<p class="emotion">([\s\S]*?)<\/p>/g)].map(match => match[1].replace(/<br>/g, ''));
assert.equal(captions.length, 3);
for (const caption of captions) assert([...caption].length >= 15 && [...caption].length <= 30);
console.log(JSON.stringify({ syntax: 'OK', assets: assets.length, captions: captions.map(text => ({ text, characters: [...text].length })) }, null, 2));
