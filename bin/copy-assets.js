#!/usr/bin/env node
// Copy the koi assets into your app's served directory.
//   npx wooj-koi-assets public/koi
import { cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '..', 'koi');
const dest = process.argv[2] || 'public/koi';
cpSync(src, dest, { recursive: true });
console.log(`wooj-koi: copied assets → ${dest}`);
