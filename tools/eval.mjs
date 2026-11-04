// Evaluate a JS file inside a Steam window:  node tools/eval.mjs file.js [windowTitleRegex]
import { readFileSync } from 'node:fs';
import { connect } from './cdp.mjs';

const [file, title = '^Steam$'] = process.argv.slice(2);
const steam = await connect(new RegExp(title));
try {
  const v = await steam.evaluate(readFileSync(file, 'utf8'));
  console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1));
} finally {
  steam.close();
}
