// Sets Millennium conditions of the theme and reloads Steam's UI (Steam must run with -dev).
//   node tools/setcond.mjs Style "Glass Gallery" [Language English ...]
import { connect } from './cdp.mjs';

const pairs = process.argv.slice(2);
if (!pairs.length || pairs.length % 2) { console.log('usage: node tools/setcond.mjs <Condition> <Value> [...]'); process.exit(1); }
const sj = await connect(/^SharedJSContext$/);
try {
  for (let i = 0; i < pairs.length; i += 2) {
    const r = await sj.evaluate(`window.MILLENNIUM_API.ffi('core','Core_ChangeCondition')('rf-shelf', ${JSON.stringify(pairs[i + 1])}, ${JSON.stringify(pairs[i])})`);
    console.log(pairs[i], '→', pairs[i + 1], JSON.stringify(r));
  }
  await sj.evaluate('SteamClient.Browser.RestartJSContext(), true');
} catch (e) { /* the context dies while restarting */ }
sj.close();
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 1000));
  try {
    const list = await (await fetch('http://127.0.0.1:8080/json')).json();
    if (list.some(t => t.title === 'Steam')) { await new Promise(r => setTimeout(r, 3500)); console.log('Steam UI reloaded'); break; }
  } catch (e) { /* not up yet */ }
}
