import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function berkas(dir: string, acc: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) berkas(p, acc);
    else acc.push(p);
  }
  return acc;
}

describe('larangan stack (AGENTS.md)', () => {
  const sumber = berkas('src').filter((f) => /\.(svelte|ts)$/.test(f));

  test('tanpa `$:` gaya lama di komponen', () => {
    const buruk = sumber.filter((f) => /^\s*\$:/m.test(readFileSync(f, 'utf8')));
    expect(buruk).toEqual([]);
  });

  test('tanpa Next.js/React/echarts di dependensi', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const semua = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(semua.filter((d) => /^(next|react|react-dom|echarts)$/.test(d))).toEqual([]);
  });

  test('Tailwind tetap 3.4.x', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.devDependencies.tailwindcss).toMatch(/^3\.4\./);
  });
});
