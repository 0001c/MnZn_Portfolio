const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'dist');
if (path.resolve(out) !== path.resolve(root, 'dist') || path.dirname(out) !== root) throw new Error('Unsafe output directory');
const outputs = new Map(), active = new Set();
const references = /(["'])(assets\/[^"'<>\s]+|content\/portfolio\.json)\1/g;
function publish(relative) {
  if (outputs.has(relative)) return outputs.get(relative);
  if (active.has(relative)) throw new Error(`Circular asset reference: ${relative}`);
  active.add(relative);
  const source = path.resolve(root, relative);
  if (!source.startsWith(root + path.sep) || !fs.statSync(source).isFile()) throw new Error(`Missing/unsafe asset: ${relative}`);
  let bytes = fs.readFileSync(source);
  if (/\.(js|css|json|svg)$/.test(relative)) bytes = Buffer.from(bytes.toString('utf8').replace(references, (_, quote, dependency) => quote + publish(dependency) + quote));
  const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
  const parsed = path.posix.parse(relative), versioned = `${parsed.dir}/${parsed.name}.${hash}${parsed.ext}`;
  outputs.set(relative, versioned);
  assets.push({ source: relative, output: versioned, bytes });
  active.delete(relative);
  return versioned;
}
const assets = [];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(references, (_, quote, dependency) => quote + publish(dependency) + quote);
fs.rmSync(out, { recursive: true, force: true }); // Only the verified generated dist directory.
fs.mkdirSync(out, { recursive: true });
for (const asset of assets) {
  const target = path.join(out, asset.output);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, asset.bytes);
}
fs.writeFileSync(path.join(out, 'index.html'), html);
fs.copyFileSync(path.join(root, '_headers'), path.join(out, '_headers'));
const manifest = assets.map(({ source, output, bytes }) => ({ source, output, bytes: bytes.length }));
fs.mkdirSync(path.join(root, '_workspace/manifests'), { recursive: true });
fs.writeFileSync(path.join(root, '_workspace/manifests/runtime-assets.json'), JSON.stringify(manifest, null, 2));
console.log(`Built ${manifest.length} versioned assets; ${(manifest.reduce((sum, asset) => sum + asset.bytes, Buffer.byteLength(html)) / 1e6).toFixed(2)} MB. Publish dist/.`);
