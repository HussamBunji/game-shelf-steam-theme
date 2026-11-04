// Saves a screenshot of the Steam main window:  node tools/screenshot.mjs out.png
import { writeFileSync } from 'node:fs';
import { connect } from './cdp.mjs';

const out = process.argv[2] || 'steam.png';
const steam = await connect(/^Steam$/);
try {
  const { data } = await steam.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('saved', out);
} finally {
  steam.close();
}
