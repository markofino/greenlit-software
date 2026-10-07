import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const files = {};
async function collect(dir, prefix = '') {
 for (const entry of await readdir(dir, { withFileTypes: true })) {
  const key = prefix + entry.name;
  if (entry.isDirectory()) await collect(join(dir, entry.name), key + '/');
  else if (entry.isFile()) files['/' + key] = (await readFile(join(dir, entry.name))).toString('base64');
 }
}
await collect(fileURLToPath(new URL('./public/', import.meta.url)));
await writeFile(new URL('./website-assets.mjs', import.meta.url), 'export default Object.freeze(' + JSON.stringify(files) + ');\n');
console.log('Bundled ' + Object.keys(files).length + ' website files.');
