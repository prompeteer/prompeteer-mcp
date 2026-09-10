// Preserve the tested proxy runtime without asking npm consumers to resolve it
// again. npm overrides only apply in a root project; Express's upstream qs
// range would otherwise reintroduce a vulnerable parser for downstream users.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, basename } from 'node:path';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../package.json', import.meta.url));
const proxy = JSON.parse(readFileSync(require.resolve('mcp-remote/package.json'), 'utf8'));
const qs = JSON.parse(readFileSync(require.resolve('qs/package.json'), 'utf8'));
if (proxy.version !== '0.8.6' || qs.version !== '6.16.0') {
  throw new Error('Install the reviewed dependency tree with npm ci --ignore-scripts before building.');
}
const modules = join(root, 'node_modules');
const vendor = join(root, 'vendor');
if (!existsSync(join(root, 'npm-shrinkwrap.json'))) throw new Error('The release lock is missing.');
rmSync(vendor, {recursive:true, force:true});
mkdirSync(vendor, {recursive:true});
cpSync(modules, join(vendor, 'node_modules'), {
  recursive:true,
  filter: path => !['.bin', '.package-lock.json'].includes(basename(path)),
});
writeFileSync(join(vendor, 'runtime-manifest.json'), JSON.stringify({
  proxy: `${proxy.name}@${proxy.version}`,
  patchedQueryParser: `${qs.name}@${qs.version}`,
  source: 'npm-shrinkwrap.json',
  note: 'Unmodified runtime package files, including upstream licenses. Built with install scripts disabled.',
}, null, 2) + '\n');
