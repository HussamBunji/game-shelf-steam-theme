// Minimal Chrome DevTools Protocol client for the Steam client (Steam must run with -dev → port 8080)
export async function connect(titleRe = /^Steam$/) {
  let list;
  try { list = await (await fetch('http://127.0.0.1:8080/json')).json(); }
  catch { throw new Error('Steam debug port 8080 is closed. Start Steam with -dev (tools/steam-dev.cmd).'); }
  const t = list.find(x => titleRe.test(x.title) && x.webSocketDebuggerUrl);
  if (!t) throw new Error(`No Steam window matching ${titleRe}. Open windows: ${list.map(x => x.title).join(' | ')}`);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id; pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  return { send, evaluate, close: () => ws.close() };
}
