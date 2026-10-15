const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, '_workspace/manifests/runtime-assets.json')));
for (const asset of manifest) {
 const bytes=fs.readFileSync(path.join(root,'dist',asset.output));
 assert.ok(asset.output.includes('.'+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.'),asset.output);
}
const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
for(const ref of html.matchAll(/(?:src|data-src|poster|href)="((?:assets|content)\/[^"]+)"/g))assert.ok(fs.existsSync(path.join(root,'dist',ref[1])),ref[1]);
const json=manifest.find(i=>i.source==='content/portfolio.json');const data=JSON.parse(fs.readFileSync(path.join(root,'dist',json.output)));
assert.deepEqual(require('../../assets/portfolio-model.js').validate(data),[]);
for(const work of data.projects)for(const ref of [work.cover,...work.images])if(!/^https?:/.test(ref))assert.ok(fs.existsSync(path.join(root,'dist',ref)),ref);
assert.doesNotMatch(html,/\.webm/);assert.match(html,/id="outro-video" data-src="[^"]+"[^>]+preload="none"/);assert.match(html,/id="work-video" data-src="[^"]+"[^>]+preload="none"/);
assert.ok(!fs.existsSync(path.join(root,'dist/_workspace')));
console.log('PASS: content-hash versions, dependency paths, lazy MP4 sources and runtime-only build');
