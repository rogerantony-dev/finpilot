// Renders every docs/diagrams/*.mmd to a PNG next to it using mermaid-cli.
// Uses the locally installed Chrome (see ../diagrams/puppeteer-config.json).
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../diagrams/', import.meta.url));
for (const file of readdirSync(dir).filter((f) => f.endsWith('.mmd'))) {
  const out = file.replace(/\.mmd$/, '.png');
  execFileSync(
    'node_modules/.bin/mmdc',
    [
      '-i',
      dir + file,
      '-o',
      dir + out,
      '-c',
      dir + 'mermaid-config.json',
      '-p',
      dir + 'puppeteer-config.json',
      '-b',
      'white',
      '-s',
      '2.5',
      '-q',
    ],
    { stdio: 'inherit' },
  );
  console.log(`rendered ${out}`);
}
