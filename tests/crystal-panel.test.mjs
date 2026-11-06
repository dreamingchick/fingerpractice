import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const image = readFileSync(new URL('../public/crystal-touch-v3.webp', import.meta.url));

test('crystal artwork is a usable WebP file with a transparent bubble design', () => {
  assert.equal(image.toString('ascii', 0, 4), 'RIFF');
  assert.equal(image.toString('ascii', 8, 12), 'WEBP');
  assert.ok(statSync(new URL('../public/crystal-touch-v3.webp', import.meta.url)).size > 50_000);
});

test('the new target shows the dynamic 10-second and result values', () => {
  assert.match(page, /phase==='waiting'\?String\(count\)/);
  assert.match(page, /phase==='go'\?'0'/);
  assert.match(page, /phase==='success'\?String\(ms\)/);
  assert.match(page, /src="\/crystal-touch-v3\.webp"/);
  assert.match(page, /className="crystal-hitbox"/);
  assert.doesNotMatch(page, /className=\{'target '/);
});

test('a trusted touch must be used, and the game timing handler stays unchanged', () => {
  assert.match(page, /e\.isTrusted&&e\.isPrimary&&e\.pointerType==='touch'/);
  assert.match(page, /hit\(performance\.now\(\)\)/);
  assert.match(css, /\.crystal-hitbox\s*\{[^}]*top:\s*28%;[^}]*width:\s*100%;[^}]*height:\s*70%/s);
  assert.match(css, /\.crystal-clock\s*\{[^}]*top:\s*8\.65%/s);
});
