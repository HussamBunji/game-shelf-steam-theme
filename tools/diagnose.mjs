// After a Steam update: start Steam with -dev, open Library > Home, then run
//   node tools/diagnose.mjs
// Every FAIL line points to the part of SteamAPI (top of shelf.js) that needs fixing.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { connect } from './cdp.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const steam = await connect(/^Steam$/);
try {
  console.log(await steam.evaluate(readFileSync(path.join(here, 'diagnose.js'), 'utf8')));
} finally {
  steam.close();
}
