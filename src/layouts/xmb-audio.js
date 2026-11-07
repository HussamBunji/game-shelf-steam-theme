/* ═══ Crossbar (الكونسول) — sound engine (loaded by src/layouts/xmb.js) ═══
   Everything is synthesised with WebAudio: no audio files, no network.
   • Background ambience: the owner's own track, src/layouts/xmb-ambience.mp3 (30 s, its fades baked in), decoded
     once and looped seamlessly — a new BufferSource every 27 s, the two overlapping with 3 s gain cross-fades; master
     0.35 with 1.5 s fades on toggle. If the file can't be fetched / decoded, a generated pad in A takes its place
     (detuned sines on A / E partials, D and B colour voices drifting in and out, slow LFOs, a generated reverb).
   • Menu sounds, synthesised and tuned to the track's key (A, E, D): move = a tiny glassy tick on A6, category = an
     airy whoosh + a soft E5, open / confirm = a bright chime A5 → E6, back / close = E6 → A5, edge = a muted D3 → A2 blip.
   Both are OFF by default (localStorage rfs.xmb.amb / rfs.xmb.sfx). The AudioContext is created only after a user
   gesture. The ambience pauses while Steam is hidden, while a game is running or off the Crossbar home page, and the
   whole engine is torn down when the theme is switched away (or this file is loaded again). */
(function () {
  'use strict';
  if (window.__xmbAudio && typeof window.__xmbAudio.destroy === 'function') { try { window.__xmbAudio.destroy(); } catch (e) { /* gone */ } }
  const api = window.__rfsLayoutApi;
  const me = document.currentScript;
  const TRACK = (me && me.src ? me.src : '').replace(/xmb-audio\.js(\?.*)?$/, 'xmb-ambience.mp3');
  const K_AMB = 'rfs.xmb.amb', K_SFX = 'rfs.xmb.sfx';
  const getFlag = k => { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } };
  const setFlag = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { /* private */ } };

  let ac = null, master = null, verbIn = null, sfxBus = null, noise = null;
  let pad = null, watchT = 0, gestured = false, dead = false;
  let track = null, trackBuf = null, trackState = '';   // '' | 'loading' | 'ok' | 'failed'
  const S = { amb: getFlag(K_AMB), sfx: getFlag(K_SFX) };

  // a user gesture unlocks audio (Chromium refuses to start a context before one)
  const onGesture = () => { gestured = true; check(); };
  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('keydown', onGesture, true);

  /* ---- the graph: master → speakers; a reverb send; a bus for the menu sounds */
  function ctx() {
    if (ac || dead) return ac;
    if (!gestured) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 1;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp).connect(ac.destination);
    // reverb: 2.8 s of stereo noise with an exponential tail (generated once)
    const len = Math.round(ac.sampleRate * 2.8), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const verb = ac.createConvolver(); verb.buffer = ir;
    const wet = ac.createGain(); wet.gain.value = .55;
    verbIn = ac.createGain(); verbIn.connect(verb).connect(wet).connect(master);
    sfxBus = ac.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    const sb = ac.createGain(); sb.gain.value = .35; sfxBus.connect(sb).connect(verbIn);
    // one second of white noise for the whoosh
    noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ac;
  }

  /* ---- the ambience track: decoded once, looped with overlapping sources */
  const LOOP = 27, XF = 3, LEVEL = .35;
  function loadTrack() {
    if (trackState || !TRACK || !ctx()) return;
    trackState = 'loading';
    fetch(TRACK).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
      .then(b => new Promise((ok, no) => ac.decodeAudioData(b, ok, no)))
      .then(buf => { trackBuf = buf; trackState = 'ok'; check(); })
      .catch(() => { trackState = 'failed'; check(); });
  }
  function startTrack() {
    if (track || !trackBuf || !ctx()) return;
    const t = ac.currentTime;
    const out = ac.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(LEVEL, t + 1.5);
    out.connect(master);
    track = { out, srcs: [], timer: 0 };
    queue(t, true);
  }
  // one pass of the track at `when`; the next one starts LOOP s later and the two cross-fade over XF s
  function queue(when, first) {
    if (!track) return;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = trackBuf; src.connect(g).connect(track.out);
    if (first) g.gain.setValueAtTime(1, when);
    else { g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1, when + XF); }
    g.gain.setValueAtTime(1, when + LOOP); g.gain.linearRampToValueAtTime(0, when + LOOP + XF);
    src.start(when); src.stop(when + LOOP + XF + .1);
    track.srcs.push(src);
    src.onended = () => { if (track) track.srcs = track.srcs.filter(x => x !== src); try { g.disconnect(); } catch (e) { /* done */ } };
    const next = when + LOOP;
    track.timer = setTimeout(() => queue(next, false), Math.max(0, (next - ac.currentTime - 1.5) * 1000));
  }
  function stopTrack() {
    if (!track || !ac) return;
    const p = track, t = ac.currentTime;
    track = null;
    clearTimeout(p.timer);
    p.out.gain.cancelScheduledValues(t); p.out.gain.setValueAtTime(p.out.gain.value, t); p.out.gain.linearRampToValueAtTime(0, t + 1.5);
    setTimeout(() => {
      for (const x of p.srcs) { try { x.stop(); x.disconnect(); } catch (e) { /* done */ } }
      try { p.out.disconnect(); } catch (e) { /* done */ }
      idle();
    }, 1600);
  }

  /* ---- the fallback pad (only if the track can't be decoded) */
  const BASE = [[55, .30, 'sine'], [110, .26, 'sine'], [165, .13, 'triangle'], [220, .14, 'sine'], [330, .08, 'triangle'], [440, .06, 'sine']];
  const AIR = [[880, .018], [1320, .008]];
  const COLOUR = { d: [[146.83, .12], [293.66, .07]], b: [[246.94, .09], [493.88, .04]] };
  function voice(f, g, type, dest, list) {
    const out = ac.createGain(); out.gain.value = g;
    for (const cents of [-4, 4]) {
      const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = cents + (Math.random() - .5) * 2;
      o.connect(out); o.start(); list.push(o);
    }
    out.connect(dest);
    return out;
  }
  function startPad() {
    if (pad || !ctx()) return;
    const t = ac.currentTime, oscs = [];
    const out = ac.createGain(); out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(.12, t + 1.5);
    const level = ac.createGain(); level.gain.value = 1;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = .4;
    lp.connect(level).connect(out);
    out.connect(master);
    const send = ac.createGain(); send.gain.value = .6; out.connect(send).connect(verbIn);
    // very slow LFOs: the cutoff breathes (±450 Hz, ~22 s), the level sways (±12 %, ~15 s)
    const lfo1 = ac.createOscillator(); lfo1.frequency.value = .045; const l1 = ac.createGain(); l1.gain.value = 450; lfo1.connect(l1).connect(lp.frequency); lfo1.start(); oscs.push(lfo1);
    const lfo2 = ac.createOscillator(); lfo2.frequency.value = .067; const l2 = ac.createGain(); l2.gain.value = .12; lfo2.connect(l2).connect(level.gain); lfo2.start(); oscs.push(lfo2);
    for (const [f, g, type] of BASE) voice(f, g, type, lp, oscs);
    for (const [f, g] of AIR) voice(f, g, 'sine', out, oscs);           // the air skips the low-pass
    const colour = {};
    for (const k in COLOUR) { colour[k] = ac.createGain(); colour[k].gain.value = 0; colour[k].connect(lp); for (const [f, g] of COLOUR[k]) voice(f, g, 'sine', colour[k], oscs); }
    pad = { out, oscs, colour, step: 0, timer: 0 };
    drift();
  }
  // A → Asus4 (D colour) → A → A(add9) → … with 6–8 s cross-fades, a new colour every 12–20 s
  const SEQ = ['', 'd', '', 'b', 'd', ''];
  function drift() {
    if (!pad) return;
    const want = SEQ[pad.step++ % SEQ.length], t = ac.currentTime, fade = 6 + Math.random() * 2;
    for (const k in pad.colour) {
      const g = pad.colour[k].gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(k === want ? 1 : 0, t + fade);
    }
    pad.timer = setTimeout(drift, (12 + Math.random() * 8) * 1000);
  }
  function stopPad() {
    if (!pad || !ac) return;
    const p = pad, t = ac.currentTime;
    pad = null;
    clearTimeout(p.timer);
    p.out.gain.cancelScheduledValues(t); p.out.gain.setValueAtTime(p.out.gain.value, t); p.out.gain.linearRampToValueAtTime(0, t + 1.5);
    setTimeout(() => {
      for (const o of p.oscs) { try { o.stop(); o.disconnect(); } catch (e) { /* done */ } }
      try { p.out.disconnect(); } catch (e) { /* done */ }
      idle();
    }, 1600);
  }
  // nothing to play: let the audio thread sleep
  function idle() { if (ac && !pad && !track && !S.sfx && ac.state === 'running') ac.suspend().catch(() => {}); }

  /* ---- when the ambience may play: Steam visible, the Crossbar home on screen, no game running */
  function onHome() {
    try { return !!api && api.layoutId === 'xmb' && api.root.classList.contains('on'); } catch (e) { return false; }
  }
  function check() {
    if (dead) return;
    let layout = 'xmb';
    try { layout = api ? api.layoutId : ''; } catch (e) { /* not ready */ }
    if (api && layout && layout !== 'xmb') { destroy(); return; }   // the user switched to another theme
    let busy = false;
    try { busy = api.running().size > 0; } catch (e) { /* fine */ }
    const play = S.amb && gestured && !document.hidden && onHome() && !busy;
    if (play) {
      if (ctx()) {
        if (ac.state !== 'running') ac.resume().catch(() => {});
        if (trackState === 'ok') startTrack();
        else if (trackState === 'failed') startPad();
        else loadTrack();
      }
    } else { stopTrack(); stopPad(); }
    clearTimeout(watchT);
    if (S.amb) watchT = setTimeout(check, 1000);                       // cheap: no DOM writes, one class check
  }
  document.addEventListener('visibilitychange', check);

  /* ---- menu sounds */
  function env(g, t, peak, a, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function tone(f, t, peak, dur, type = 'sine', dest = sfxBus) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.connect(g).connect(dest);
    env(g, t, peak, .004, dur); o.start(t); o.stop(t + dur + .05);
    return o;
  }
  function bell(f, t, peak) { tone(f, t, peak, .55); tone(f * 2.76, t, peak * .18, .22); tone(f * 5.4, t, peak * .05, .1); }
  const KIND = { tick: 'move', slide: 'open', close: 'back' };
  function play(kind) {
    kind = KIND[kind] || kind;
    if (!S.sfx || dead || !onHome() && kind !== 'confirm' && kind !== 'open' && kind !== 'back') return;
    if (!ctx()) return;
    if (ac.state !== 'running') ac.resume().catch(() => {});
    const t = ac.currentTime + .01;
    if (kind === 'move') {
      tone(1760, t, .045, .08); tone(2637.02, t, .01, .04);          // A6 with a faint E7
    } else if (kind === 'cat') {
      const n = ac.createBufferSource(); n.buffer = noise;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(500, t); bp.frequency.exponentialRampToValueAtTime(3200, t + .26);
      const g = ac.createGain(); env(g, t, .05, .06, .24);
      n.connect(bp).connect(g).connect(sfxBus); n.start(t); n.stop(t + .36);
      tone(659.25, t + .03, .025, .32, 'triangle');
    } else if (kind === 'open' || kind === 'confirm') {
      bell(880, t, .05); bell(1318.51, t + .075, .045);
    } else if (kind === 'back') {
      bell(1318.51, t, .035); bell(880, t + .075, .032);
    } else if (kind === 'edge') {
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(146.83, t); o.frequency.exponentialRampToValueAtTime(110, t + .12);
      lp.type = 'lowpass'; lp.frequency.value = 600;
      o.connect(lp).connect(g).connect(sfxBus); env(g, t, .07, .005, .13); o.start(t); o.stop(t + .2);
    }
  }

  function destroy() {
    dead = true;
    clearTimeout(watchT);
    if (pad) { clearTimeout(pad.timer); pad = null; }
    if (track) { clearTimeout(track.timer); track = null; }
    window.removeEventListener('pointerdown', onGesture, true);
    window.removeEventListener('keydown', onGesture, true);
    document.removeEventListener('visibilitychange', check);
    if (ac) { try { ac.close(); } catch (e) { /* closed */ } }
    ac = null;
    if (window.__xmbAudio === API) window.__xmbAudio = null;
  }

  const API = {
    get amb() { return S.amb; },
    get sfx() { return S.sfx; },
    /** toggling counts as the user gesture that unlocks audio */
    setAmb(on) { S.amb = !!on; setFlag(K_AMB, S.amb); gestured = true; check(); },
    setSfx(on) { S.sfx = !!on; setFlag(K_SFX, S.sfx); gestured = true; if (on) play('confirm'); else idle(); },
    play, destroy, check,
    /** for tests: the live state of the graph */
    debug() { return { ctx: ac ? ac.state : 'none', track: trackState, playing: !!track, sources: track ? track.srcs.length : 0, out: track ? track.out.gain.value : 0, pad: !!pad, voices: pad ? pad.oscs.length : 0, level: pad ? pad.out.gain.value : 0, amb: S.amb, sfx: S.sfx }; },
  };
  window.__xmbAudio = API;
  if (S.amb) check();
})();
