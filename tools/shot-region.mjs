// node tools/shot-region.mjs out.png x y w h ["css to apply first"]
import { writeFileSync } from 'node:fs';
import { connect } from './cdp.mjs';

const [out, x, y, w, h, css] = process.argv.slice(2);
const steam = await connect(/^Steam$/);
try {
  await steam.evaluate(`(() => { let s = document.getElementById('rfs-probe-css'); if (!s) { s = document.createElement('style'); s.id = 'rfs-probe-css'; document.head.appendChild(s); } s.textContent = ${JSON.stringify(css || '')}; })()`);
  await new Promise(r => setTimeout(r, 700));
  const { data } = await steam.send('Page.captureScreenshot', { format: 'png', clip: { x: +x, y: +y, width: +w, height: +h, scale: 1 } });
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log('saved', out);
} finally {
  steam.close();
}
