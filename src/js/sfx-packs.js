/* Game Shelf — per-theme sound packs (desktop only; Big Picture keeps Steam's own interface sounds).
   Everything is synthesised with WebAudio: no audio files. A style picks its pack with `--rf-sfx: <pack>;` in its
   :root block; shelf.js reads it and calls pack[kind](ctx, out, h):
     tick  — moving / hovering between games      swish — a quick sweep (row scroll, page turn)
     open  — a game panel opens                   snap  — (optional) the CD case lid / a second open beat
     close — the panel closes / back               play  — a game launches      error — something failed
     ambience(ctx, out, h) — optional, long-running; returns { stop(at) }. shelf.js fades `out` in and out.
   `h` = window.__rfsSfxHelpers(ctx): tone / noise / reverb helpers bound to that context (works with an
   OfflineAudioContext too, so a pack can be rendered to a file). Rules: low levels, ≤ 250 ms, no harsh highs,
   a little random variation, only a few voices per sound. */
(function () {
  'use strict';
  const cache = new WeakMap();
  const curves = {};

  function helpers(ctx) {
    if (cache.has(ctx)) return cache.get(ctx);
    const sr = ctx.sampleRate;
    const white = ctx.createBuffer(1, Math.floor(sr * 2), sr);
    { const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const r = (a, b) => a + Math.random() * (b - a);
    const j = (v, amt = 0.04) => v * (1 + (Math.random() * 2 - 1) * amt);
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const now = () => ctx.currentTime + 0.004;

    /** exponential attack → (hold) → decay on an AudioParam */
    function env(p, t, peak, attack, dur, hold = 0) {
      peak = Math.max(0.0002, peak);
      p.setValueAtTime(0.0001, t);
      p.exponentialRampToValueAtTime(peak, t + attack);
      if (hold) p.setValueAtTime(peak, t + attack + hold);
      p.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + hold + 0.005));
    }
    function filt(o, t, dur) {
      const f = ctx.createBiquadFilter();
      f.type = o.type || 'lowpass';
      f.Q.value = o.q == null ? 0.7 : o.q;
      f.frequency.setValueAtTime(o.f, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + (o.time || dur));
      return f;
    }
    /** a quantising wave-shaper: a touch of bit-crush grit */
    function crusher(steps) {
      const ws = ctx.createWaveShaper();
      if (!curves[steps]) {
        const c = new Float32Array(1024);
        for (let i = 0; i < c.length; i++) { const x = i / 511.5 - 1; c[i] = Math.round(x * steps) / steps; }
        curves[steps] = c;
      }
      ws.curve = curves[steps];
      return ws;
    }
    /** shared short room reverb, one per output node */
    const verbs = new Map();
    function verb(dest) {
      if (verbs.has(dest)) return verbs.get(dest);
      const len = Math.floor(sr * 0.7), ir = ctx.createBuffer(2, len, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch); let lp = 0;
        for (let i = 0; i < len; i++) { lp += 0.35 * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.pow(1 - i / len, 3.2); }
      }
      const cv = ctx.createConvolver(); cv.buffer = ir;
      const input = ctx.createGain(); input.gain.value = 0.55;
      input.connect(cv).connect(dest);
      verbs.set(dest, input);
      return input;
    }
    /** a node that plays dry into `dest` plus `wet` of it into the shared reverb */
    const sends = new Map();
    function send(dest, wet) {
      const k = Math.round(wet * 100);
      let m = sends.get(dest); if (!m) sends.set(dest, m = {});
      if (m[k]) return m[k];
      const g = ctx.createGain(); g.connect(dest);
      if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w).connect(verb(dest)); }
      return (m[k] = g);
    }
    /** one oscillator voice: { dest, at, type, f, f1, glide, dur, gain, attack, hold, detune, filter, crush } */
    function tone(o) {
      const t = o.at == null ? now() : o.at, dur = o.dur || 0.1, a = o.attack == null ? 0.004 : o.attack;
      const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || dur));
      if (o.detune) osc.detune.value = o.detune;
      let head = osc;
      if (o.crush) { const c = crusher(o.crush); head.connect(c); head = c; }
      if (o.filter) { const f = filt(o.filter, t, dur); head.connect(f); head = f; }
      const g = ctx.createGain(); env(g.gain, t, o.gain || 0.05, a, dur, o.hold || 0);
      head.connect(g).connect(o.dest);
      osc.start(t); osc.stop(t + dur + 0.05);
      return t + dur;
    }
    /** one filtered-noise voice: { dest, at, dur, gain, attack, hold, type, f, f1, q, time, filter2 } */
    function noise(o) {
      const t = o.at == null ? now() : o.at, dur = o.dur || 0.05, a = o.attack == null ? 0.002 : o.attack;
      const s = ctx.createBufferSource(); s.buffer = white;
      const f = filt({ type: o.type || 'bandpass', f: o.f || 1500, f1: o.f1, q: o.q, time: o.time }, t, dur);
      let head = s; head.connect(f); head = f;
      if (o.filter2) { const f2 = filt(o.filter2, t, dur); head.connect(f2); head = f2; }
      const g = ctx.createGain(); env(g.gain, t, o.gain || 0.05, a, dur, o.hold || 0);
      head.connect(g).connect(o.dest);
      s.start(t, Math.random() * 1.4, dur + 0.06);
      return t + dur;
    }
    /** a looping buffer built by fill(data, sampleRate) — for ambience beds */
    function loopBuf(seconds, fill, channels = 1) {
      const b = ctx.createBuffer(channels, Math.floor(sr * seconds), sr);
      for (let ch = 0; ch < channels; ch++) fill(b.getChannelData(ch), sr, ch);
      return b;
    }
    /** sources/oscillators started now, all stopped by the returned handle */
    function holder() {
      const nodes = [];
      return {
        add(n) { nodes.push(n); return n; },
        stop(at) { for (const n of nodes) { try { n.stop(at || 0); } catch (e) { /* already stopped */ } } },
      };
    }
    const H = { ctx, white, r, j, pick, now, env, filt, crusher, verb, send, tone, noise, loopBuf, holder };
    cache.set(ctx, H);
    return H;
  }

  /* little shared gestures */
  const knock = (h, out, t, f, g) => { // a short pitched body thump
    h.tone({ dest: out, at: t, f: h.j(f, 0.06), f1: f * 0.62, dur: 0.05, gain: g, attack: 0.002 });
  };
  const clink = (h, out, t, f, g) => { // inharmonic metal partials
    [[1, 1], [2.76, 0.5], [5.4, 0.22]].forEach(([m, k]) =>
      h.tone({ dest: out, at: t, f: f * m, dur: 0.1 + 0.08 / m, gain: g * k, attack: 0.001 }));
  };
  const crackle = (h, out, t, span, count, g) => { // a few vinyl pops
    for (let i = 0; i < count; i++) {
      h.noise({ dest: out, at: t + Math.random() * span, dur: h.r(0.004, 0.009), gain: g * h.r(0.4, 1), type: 'highpass', f: h.r(900, 2600), q: 0.5, attack: 0.0006 });
    }
  };
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);

  const packs = {
    /* ── Cyberpunk: digital glitch blips, data chirps, a bassy synth thunk ── */
    cyberpunk: {
      tick(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.08);
        const f = h.pick([1175, 1319, 1480, 1568]) * h.j(1, 0.02);
        h.tone({ dest: o, at: t, type: 'square', f, dur: 0.032, gain: 0.022, crush: 6, filter: { f: 4200 } });
        h.noise({ dest: o, at: t + 0.006, dur: 0.03, gain: 0.018, f: 2400, f1: 4600, q: 5 });
        if (Math.random() < 0.45) h.tone({ dest: o, at: t + 0.026, type: 'square', f: f * 1.5, dur: 0.018, gain: 0.012, crush: 5, filter: { f: 4200 } });
      },
      swish(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.12);
        h.noise({ dest: o, at: t, dur: 0.14, gain: 0.03, f: 600, f1: 3400, q: 2 });
        h.tone({ dest: o, at: t, type: 'square', f: 380, f1: 920, dur: 0.1, gain: 0.012, crush: 4, filter: { f: 3000 } });
      },
      open(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.2);
        h.tone({ dest: o, at: t, f: 120, f1: 42, dur: 0.22, gain: 0.2, attack: 0.003 });
        h.tone({ dest: o, at: t, type: 'sawtooth', f: 55, dur: 0.18, gain: 0.05, filter: { f: 900, f1: 120 } });
        for (let i = 0; i < 3; i++) h.tone({ dest: o, at: t + 0.02 + i * 0.032, type: 'square', f: h.j(1760 + i * 220, 0.03), dur: 0.02, gain: 0.012, crush: 5, filter: { f: 4000 } });
      },
      close(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.12);
        h.tone({ dest: o, at: t, type: 'square', f: 880, f1: 300, dur: 0.08, gain: 0.018, crush: 5, filter: { f: 3200 } });
        h.tone({ dest: o, at: t + 0.02, f: 95, f1: 48, dur: 0.12, gain: 0.12 });
      },
      play(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.12);
        h.tone({ dest: o, at: t, type: 'sawtooth', f: 110, f1: 440, dur: 0.24, gain: 0.04, attack: 0.03, filter: { f: 300, f1: 2600 } });
        h.tone({ dest: o, at: t, type: 'sawtooth', f: 111.5, f1: 446, dur: 0.24, gain: 0.03, attack: 0.03, filter: { f: 300, f1: 2600 } });
        h.tone({ dest: o, at: t + 0.1, f: 130, f1: 45, dur: 0.14, gain: 0.16 });
      },
      error(ctx, out, h) {
        const t = h.now();
        [0, 0.1].forEach(d => h.tone({ dest: out, at: t + d, type: 'square', f: 140, dur: 0.07, gain: 0.025, crush: 4, filter: { f: 1200 } }));
      },
      /* distant city: a low detuned drone through a slowly pulsing filter, plus far-off traffic noise */
      ambience(ctx, out, h) {
        const H = h.holder(), t = h.now();
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 3;
        const g = ctx.createGain(); g.gain.value = 0.022; lp.connect(g).connect(out);
        [41.2, 41.45, 82.4].forEach((f, i) => { const o = H.add(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = f; const k = ctx.createGain(); k.gain.value = i === 2 ? 0.4 : 1; o.connect(k).connect(lp); o.start(t); });
        const lfo = H.add(ctx.createOscillator()); lfo.frequency.value = 0.11; const d = ctx.createGain(); d.gain.value = 90; lfo.connect(d).connect(lp.frequency); lfo.start(t);
        const pul = H.add(ctx.createOscillator()); pul.frequency.value = 0.42; const pd = ctx.createGain(); pd.gain.value = 0.008; pul.connect(pd).connect(g.gain); pul.start(t);
        const n = H.add(ctx.createBufferSource()); n.buffer = h.white; n.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 320; bp.Q.value = 0.5;
        const ng = ctx.createGain(); ng.gain.value = 0.012; n.connect(bp).connect(ng).connect(out); n.start(t);
        return H;
      },
    },

    /* ── Shelter OS: Geiger clicks, relay clacks, a mechanical switch and a CRT hum ── */
    shelter: {
      tick(ctx, out, h) {
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.004, gain: 0.07, type: 'highpass', f: 1400, q: 0.6, attack: 0.0005 });
        const extra = Math.random() < 0.5 ? 1 : Math.random() < 0.5 ? 2 : 0;
        for (let i = 0; i < extra; i++) h.noise({ dest: out, at: t + h.r(0.01, 0.045), dur: 0.004, gain: 0.04, type: 'highpass', f: 1400, q: 0.6, attack: 0.0005 });
        h.noise({ dest: out, at: t + 0.008, dur: 0.018, gain: 0.025, f: h.j(1150, 0.08), q: 2.5 });
        knock(h, out, t + 0.008, 170, 0.035);
      },
      swish(ctx, out, h) {
        const t = h.now();
        for (let i = 0; i < 5; i++) h.noise({ dest: out, at: t + h.r(0, 0.13), dur: 0.004, gain: h.r(0.025, 0.05), type: 'highpass', f: 1400, q: 0.6, attack: 0.0005 });
        h.noise({ dest: out, at: t, dur: 0.12, gain: 0.012, f: 700, f1: 1600, q: 0.8 });
      },
      open(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.1);
        h.noise({ dest: o, at: t, dur: 0.05, gain: 0.12, f: 900, f1: 480, q: 1.6 });
        h.tone({ dest: o, at: t, f: 100, f1: 55, dur: 0.11, gain: 0.16 });
        h.tone({ dest: o, at: t + 0.04, type: 'sawtooth', f: 60, dur: 0.2, gain: 0.03, attack: 0.02, filter: { f: 420 } });
        h.tone({ dest: o, at: t + 0.05, f: 120, dur: 0.18, gain: 0.02, attack: 0.02 });
        h.tone({ dest: o, at: t + 0.05, f: 2600, f1: 3100, dur: 0.12, gain: 0.004, attack: 0.02 });
      },
      close(ctx, out, h) {
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.04, gain: 0.09, f: 1000, f1: 520, q: 1.6 });
        h.tone({ dest: out, at: t + 0.01, f: 700, f1: 90, dur: 0.14, gain: 0.025 });
        knock(h, out, t, 110, 0.1);
      },
      play(ctx, out, h) {
        const t = h.now();
        for (let i = 0; i < 3; i++) { h.noise({ dest: out, at: t + i * 0.05, dur: 0.016, gain: 0.05, f: 1100 + i * 150, q: 2.5 }); knock(h, out, t + i * 0.05, 150 + i * 20, 0.04); }
        h.tone({ dest: out, at: t + 0.1, type: 'sawtooth', f: 60, f1: 120, dur: 0.15, gain: 0.03, attack: 0.02, filter: { f: 500 } });
      },
      error(ctx, out, h) {
        const t = h.now();
        h.tone({ dest: out, at: t, type: 'square', f: 110, dur: 0.16, gain: 0.03, hold: 0.08, filter: { f: 800 } });
      },
      /* a far radio between stations: soft static with the odd click, under a very quiet mains hum */
      ambience(ctx, out, h) {
        const H = h.holder(), t = h.now();
        const buf = h.loopBuf(7, (d, sr) => {
          let lp = 0, amp = 0.5, ampT = 0.5;
          for (let i = 0; i < d.length; i++) {
            if (i % 2048 === 0) ampT = 0.25 + Math.random() * 0.75;
            amp += (ampT - amp) * 0.0004;
            lp += 0.5 * ((Math.random() * 2 - 1) - lp);
            d[i] = lp * amp * 0.5;
            if (Math.random() < 1.2 / sr) { for (let k = 0; k < 40 && i + k < d.length; k++) d[i + k] += (k % 2 ? -1 : 1) * 0.9 * Math.exp(-k / 6); }
          }
        });
        const s = H.add(ctx.createBufferSource()); s.buffer = buf; s.loop = true;
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 0.45;
        const g = ctx.createGain(); g.gain.value = 0.05; s.connect(bp).connect(g).connect(out); s.start(t);
        [[60, 0.006], [180, 0.002]].forEach(([f, v]) => { const o = H.add(ctx.createOscillator()); o.frequency.value = f; const k = ctx.createGain(); k.gain.value = v; o.connect(k).connect(out); o.start(t); });
        return H;
      },
    },

    /* ── Retro Arcade: 8-bit square-wave blips ── */
    arcade: {
      tick(ctx, out, h) {
        const t = h.now();
        h.tone({ dest: out, at: t, type: 'square', f: 988 * h.j(1, 0.01), dur: 0.04, gain: 0.022, hold: 0.025, attack: 0.001, filter: { f: 4500 } });
      },
      swish(ctx, out, h) {
        const t = h.now();
        [784, 1175].forEach((f, i) => h.tone({ dest: out, at: t + i * 0.035, type: 'square', f, dur: 0.035, gain: 0.018, hold: 0.02, attack: 0.001, filter: { f: 4500 } }));
      },
      open(ctx, out, h) { // the coin
        const t = h.now();
        h.tone({ dest: out, at: t, type: 'square', f: 988, dur: 0.06, gain: 0.024, hold: 0.05, attack: 0.001, filter: { f: 5000 } });
        h.tone({ dest: out, at: t + 0.06, type: 'square', f: 1319, dur: 0.2, gain: 0.024, hold: 0.06, attack: 0.001, filter: { f: 5000 } });
      },
      close(ctx, out, h) {
        const t = h.now();
        [784, 659, 523].forEach((f, i) => h.tone({ dest: out, at: t + i * 0.045, type: 'square', f, dur: 0.045, gain: 0.02, hold: 0.03, attack: 0.001, filter: { f: 4500 } }));
      },
      play(ctx, out, h) { // power-up
        const t = h.now();
        [60, 64, 67, 72, 76].forEach((n, i) => h.tone({ dest: out, at: t + i * 0.04, type: 'square', f: NOTE(n), dur: 0.05, gain: 0.02, hold: 0.03, attack: 0.001, filter: { f: 5000 } }));
        h.tone({ dest: out, at: t, type: 'triangle', f: NOTE(36), f1: NOTE(48), dur: 0.22, gain: 0.05, hold: 0.1 });
      },
      error(ctx, out, h) {
        const t = h.now();
        [196, 147].forEach((f, i) => h.tone({ dest: out, at: t + i * 0.09, type: 'square', f, dur: 0.09, gain: 0.025, hold: 0.06, attack: 0.001, filter: { f: 2500 } }));
      },
    },

    /* ── Terminal: mechanical keyboard and a terminal bell ── */
    terminal: {
      tick(ctx, out, h) {
        const t = h.now(), heavy = Math.random() < 0.12;
        h.noise({ dest: out, at: t, dur: 0.01, gain: h.j(0.06, 0.2), f: h.j(3200, 0.12), q: 1.4, attack: 0.0006 });
        h.noise({ dest: out, at: t + 0.004, dur: 0.035, gain: 0.035, type: 'lowpass', f: heavy ? 450 : 700, q: 0.8 });
        knock(h, out, t + 0.003, heavy ? 120 : 165, heavy ? 0.06 : 0.04);
        h.noise({ dest: out, at: t + h.r(0.045, 0.06), dur: 0.008, gain: 0.018, f: 2600, q: 1.2, attack: 0.0006 }); // key release
      },
      swish(ctx, out, h) {
        const t = h.now();
        for (let i = 0; i < 2; i++) { const d = i * h.r(0.05, 0.07); h.noise({ dest: out, at: t + d, dur: 0.01, gain: 0.05, f: h.j(3000, 0.1), q: 1.4, attack: 0.0006 }); knock(h, out, t + d, 160, 0.035); }
      },
      open(ctx, out, h) {
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.012, gain: 0.07, f: 2600, q: 1.4, attack: 0.0006 });
        knock(h, out, t, 110, 0.07);
        h.tone({ dest: out, at: t + 0.04, type: 'square', f: 880, dur: 0.06, gain: 0.014, hold: 0.04, filter: { f: 2800 } });
        h.tone({ dest: out, at: t + 0.1, type: 'square', f: 1320, dur: 0.09, gain: 0.014, hold: 0.05, filter: { f: 2800 } });
      },
      close(ctx, out, h) {
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.01, gain: 0.05, f: 3000, q: 1.4, attack: 0.0006 });
        knock(h, out, t, 140, 0.04);
        h.tone({ dest: out, at: t + 0.03, type: 'square', f: 660, dur: 0.05, gain: 0.012, hold: 0.03, filter: { f: 2600 } });
        h.tone({ dest: out, at: t + 0.08, type: 'square', f: 440, dur: 0.07, gain: 0.012, hold: 0.04, filter: { f: 2600 } });
      },
      play(ctx, out, h) {
        const t = h.now();
        for (let i = 0; i < 3; i++) { const d = i * 0.055; h.noise({ dest: out, at: t + d, dur: 0.01, gain: 0.05, f: h.j(3100, 0.1), q: 1.4, attack: 0.0006 }); knock(h, out, t + d, 150, 0.035); }
        h.tone({ dest: out, at: t + 0.17, type: 'square', f: 1320, dur: 0.08, gain: 0.014, hold: 0.04, filter: { f: 2800 } });
      },
      error(ctx, out, h) {
        const t = h.now();
        h.tone({ dest: out, at: t, type: 'square', f: 440, dur: 0.08, gain: 0.016, hold: 0.05, filter: { f: 2200 } });
        h.tone({ dest: out, at: t + 0.1, type: 'square', f: 330, dur: 0.12, gain: 0.016, hold: 0.06, filter: { f: 2200 } });
      },
    },

    /* ── Vinyl Records: needle ticks, crackle, a warm needle drop ── */
    vinyl: {
      tick(ctx, out, h) {
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.008, gain: 0.04, type: 'highpass', f: 1100, q: 0.6, attack: 0.0006 });
        knock(h, out, t, 130, 0.025);
        crackle(h, out, t + 0.01, 0.05, Math.floor(h.r(1, 3.5)), 0.02);
      },
      swish(ctx, out, h) { // a sleeve sliding out
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.2, gain: 0.03, f: 700, f1: 1500, q: 0.6, attack: 0.05, filter2: { f: 2600 } });
      },
      open(ctx, out, h) { // drop the needle
        const t = h.now(), o = h.send(out, 0.1);
        h.tone({ dest: o, at: t, f: 72, f1: 44, dur: 0.2, gain: 0.18, attack: 0.003 });
        h.noise({ dest: o, at: t, dur: 0.07, gain: 0.04, type: 'lowpass', f: 450, q: 0.7 });
        crackle(h, out, t + 0.02, 0.22, 9, 0.03);
        h.noise({ dest: out, at: t + 0.02, dur: 0.22, gain: 0.006, type: 'highpass', f: 2000, q: 0.5, attack: 0.03 });
      },
      snap(ctx, out, h) {
        const t = h.now();
        knock(h, out, t, 90, 0.08);
        crackle(h, out, t + 0.01, 0.12, 4, 0.025);
      },
      close(ctx, out, h) { // lift the arm
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.02, gain: 0.03, f: 1500, q: 1.2 });
        h.tone({ dest: out, at: t, f: 210, f1: 120, dur: 0.07, gain: 0.04 });
        crackle(h, out, t, 0.04, 2, 0.02);
      },
      play(ctx, out, h) { // the platter spins up
        const t = h.now(), o = h.send(out, 0.15);
        h.tone({ dest: o, at: t, type: 'triangle', f: 55, f1: 110, dur: 0.24, gain: 0.08, attack: 0.04 });
        h.tone({ dest: o, at: t, f: 220, f1: 330, dur: 0.24, gain: 0.02, attack: 0.08 });
        crackle(h, out, t, 0.24, 8, 0.025);
      },
      error(ctx, out, h) {
        const t = h.now();
        h.tone({ dest: out, at: t, f: 330, f1: 180, dur: 0.18, gain: 0.04 }); // a slowing record
        crackle(h, out, t, 0.12, 3, 0.02);
      },
      /* a record playing silence: soft crackle and hiss, a low rumble */
      ambience(ctx, out, h) {
        const H = h.holder(), t = h.now();
        const buf = h.loopBuf(9, (d, sr) => {
          let lp = 0;
          for (let i = 0; i < d.length; i++) {
            lp += 0.18 * ((Math.random() * 2 - 1) - lp);
            d[i] = lp * 0.05 + Math.sin(i / sr * 2 * Math.PI * 30) * 0.02; // hiss + rumble
          }
          const pops = Math.floor(d.length / sr * 14);
          for (let p = 0; p < pops; p++) {
            const at = Math.floor(Math.random() * (d.length - 200)), a = (Math.random() < 0.1 ? 0.9 : 0.35) * (0.4 + Math.random() * 0.6);
            const sgn = Math.random() < 0.5 ? -1 : 1, w = 2 + Math.random() * 10;
            for (let k = 0; k < 120; k++) d[at + k] += sgn * a * Math.exp(-k / w) * (k % 2 ? -0.6 : 1);
          }
        });
        const s = H.add(ctx.createBufferSource()); s.buffer = buf; s.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; lp.Q.value = 0.5;
        const g = ctx.createGain(); g.gain.value = 0.3; s.connect(lp).connect(g).connect(out); s.start(t);
        return H;
      },
    },

    /* ── RPG Vault: coin clinks, a chest lock and a sparkle ── */
    vault: {
      tick(ctx, out, h) {
        const t = h.now();
        clink(h, h.send(out, 0.15), t, h.j(2100, 0.06), 0.014);
      },
      swish(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.15);
        for (let i = 0; i < 3; i++) clink(h, o, t + i * h.r(0.025, 0.05), h.j(1900 + i * 180, 0.08), 0.01);
      },
      open(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.3);
        h.noise({ dest: o, at: t, dur: 0.06, gain: 0.1, f: 700, f1: 420, q: 1.5 });
        h.tone({ dest: o, at: t, f: 115, f1: 58, dur: 0.14, gain: 0.15 });
        h.tone({ dest: o, at: t + 0.02, type: 'square', f: 420, dur: 0.04, gain: 0.01, filter: { f: 1200 } });
        [72, 76, 79, 84, 88].forEach((n, i) => h.tone({ dest: o, at: t + 0.07 + i * 0.03, f: NOTE(n) * h.j(1, 0.005), dur: 0.14, gain: 0.012, attack: 0.002 }));
      },
      close(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.15);
        h.tone({ dest: o, at: t, f: 95, f1: 50, dur: 0.12, gain: 0.14 });
        h.noise({ dest: o, at: t, dur: 0.05, gain: 0.05, type: 'lowpass', f: 600, q: 0.7 });
        clink(h, o, t + 0.03, 1600, 0.008);
      },
      play(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.3);
        [67, 72, 76, 79].forEach((n, i) => h.tone({ dest: o, at: t + i * 0.05, type: 'triangle', f: NOTE(n), dur: 0.12, gain: 0.03 }));
        [84, 88, 91].forEach((n, i) => h.tone({ dest: o, at: t + 0.15 + i * 0.025, f: NOTE(n), dur: 0.1, gain: 0.01 }));
      },
      error(ctx, out, h) {
        const t = h.now();
        h.tone({ dest: out, at: t, f: 140, f1: 90, dur: 0.12, gain: 0.1 });
        h.noise({ dest: out, at: t, dur: 0.05, gain: 0.05, f: 500, q: 1.2 });
      },
    },

    /* ── Neon Coverflow: synthwave pulses and swells ── */
    neon: {
      tick(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.2);
        const f = h.pick([220, 261.6, 329.6, 392]) * h.j(1, 0.004);
        [-10, 10].forEach(dt => h.tone({ dest: o, at: t, type: 'sawtooth', f, detune: dt, dur: 0.09, gain: 0.014, attack: 0.003, filter: { f: 2400, f1: 380, q: 4, time: 0.08 } }));
      },
      swish(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.25);
        [-12, 12].forEach(dt => h.tone({ dest: o, at: t, type: 'sawtooth', f: 165, f1: 330, detune: dt, dur: 0.14, gain: 0.014, attack: 0.01, filter: { f: 500, f1: 2600, q: 3 } }));
      },
      open(ctx, out, h) { // rising swell
        const t = h.now(), o = h.send(out, 0.35);
        [220, 261.6, 329.6].forEach(f => [-9, 9].forEach(dt => h.tone({ dest: o, at: t, type: 'sawtooth', f, detune: dt, dur: 0.25, gain: 0.01, attack: 0.13, filter: { f: 300, f1: 3000, q: 2.5 } })));
        h.tone({ dest: o, at: t, f: 55, dur: 0.25, gain: 0.05, attack: 0.1 });
      },
      close(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.3);
        [329.6, 220].forEach(f => [-9, 9].forEach(dt => h.tone({ dest: o, at: t, type: 'sawtooth', f, detune: dt, dur: 0.16, gain: 0.011, attack: 0.005, filter: { f: 2600, f1: 220, q: 3 } })));
      },
      play(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.4);
        [220, 277.2, 329.6, 440].forEach((f, i) => [-9, 9].forEach(dt => h.tone({ dest: o, at: t + i * 0.03, type: 'sawtooth', f, detune: dt, dur: 0.22, gain: 0.009, attack: 0.04, filter: { f: 500, f1: 3400, q: 2 } })));
        h.tone({ dest: o, at: t, f: 55, f1: 110, dur: 0.24, gain: 0.06, attack: 0.05 });
      },
      error(ctx, out, h) {
        const t = h.now();
        [-15, 15].forEach(dt => h.tone({ dest: out, at: t, type: 'sawtooth', f: 110, detune: dt, dur: 0.18, gain: 0.02, filter: { f: 700, f1: 200 } }));
      },
    },

    /* ── Cupertino: barely-there taps ── */
    cupertino: {
      tick(ctx, out, h) {
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.014, gain: 0.034, f: h.j(2100, 0.05), q: 3, attack: 0.0008 });
        h.tone({ dest: out, at: t, f: h.j(1150, 0.02), dur: 0.018, gain: 0.01, attack: 0.001 });
      },
      swish(ctx, out, h) {
        h.noise({ dest: out, dur: 0.08, gain: 0.018, type: 'lowpass', f: 1800, q: 0.5, attack: 0.02 });
      },
      open(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.08);
        h.tone({ dest: o, at: t, f: 620, f1: 900, dur: 0.06, gain: 0.02, attack: 0.004 });
        h.noise({ dest: o, at: t, dur: 0.01, gain: 0.012, f: 2200, q: 3, attack: 0.0008 });
      },
      close(ctx, out, h) {
        h.tone({ dest: h.send(out, 0.08), f: 820, f1: 560, dur: 0.06, gain: 0.016, attack: 0.004 });
      },
      play(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.12);
        h.tone({ dest: o, at: t, f: 880, dur: 0.1, gain: 0.016 });
        h.tone({ dest: o, at: t + 0.07, f: 1319, dur: 0.12, gain: 0.014 });
      },
      error(ctx, out, h) {
        const t = h.now();
        [0, 0.09].forEach(d => h.tone({ dest: out, at: t + d, f: 300, dur: 0.07, gain: 0.02 }));
      },
    },

    /* ── Glass Gallery: soft glassy ticks and chimes ── */
    glass: {
      tick(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.2), f = h.j(3000, 0.04);
        h.tone({ dest: o, at: t, f, dur: 0.06, gain: 0.016, attack: 0.001 });
        h.tone({ dest: o, at: t, f: f * 2.32, dur: 0.035, gain: 0.005, attack: 0.001 });
      },
      swish(ctx, out, h) {
        h.noise({ dest: h.send(out, 0.3), dur: 0.15, gain: 0.026, f: 1800, f1: 3600, q: 0.7, attack: 0.04 });
      },
      open(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.4);
        h.tone({ dest: o, at: t, f: 1760, dur: 0.22, gain: 0.014, attack: 0.002 });
        h.tone({ dest: o, at: t + 0.05, f: 2637, dur: 0.2, gain: 0.011, attack: 0.002 });
        h.noise({ dest: o, at: t, dur: 0.12, gain: 0.008, f: 2400, f1: 4200, q: 0.8, attack: 0.03 });
      },
      snap(ctx, out, h) {
        h.tone({ dest: h.send(out, 0.3), f: 2349, dur: 0.12, gain: 0.01, attack: 0.002 });
      },
      close(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.35);
        h.tone({ dest: o, at: t, f: 2637, dur: 0.1, gain: 0.011, attack: 0.002 });
        h.tone({ dest: o, at: t + 0.05, f: 1760, dur: 0.14, gain: 0.01, attack: 0.002 });
      },
      play(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.45);
        [1319, 1760, 2217, 2637].forEach((f, i) => h.tone({ dest: o, at: t + i * 0.035, f, dur: 0.18, gain: 0.01 }));
      },
      error(ctx, out, h) {
        const t = h.now(), o = h.send(out, 0.2);
        h.tone({ dest: o, at: t, f: 440, dur: 0.14, gain: 0.014 });
        h.tone({ dest: o, at: t, f: 466, dur: 0.14, gain: 0.01 });
      },
    },

    /* ── Classic Shelf: wooden knocks and the CD case (refined from the original sounds) ── */
    classic: {
      tick(ctx, out, h) {
        const t = h.now();
        knock(h, out, t, h.j(380, 0.05), 0.035);
        h.noise({ dest: out, at: t, dur: 0.018, gain: 0.025, f: h.j(1500, 0.08), q: 2.2, attack: 0.0008 });
      },
      swish(ctx, out, h) {
        h.noise({ dest: out, dur: 0.12, gain: 0.045, f: 900, f1: 2400, q: 0.8 });
      },
      open(ctx, out, h) { // the case slides out
        h.noise({ dest: out, dur: 0.24, gain: 0.05, f: 600, f1: 2100, q: 0.7, attack: 0.03 });
      },
      snap(ctx, out, h) { // the lid clacks open
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.05, gain: 0.24, f: 2500, f1: 1700, q: 1.3 });
        h.tone({ dest: out, at: t, f: 170, f1: 70, dur: 0.08, gain: 0.14 });
      },
      close(ctx, out, h) {
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.04, gain: 0.22, f: 1900, f1: 1300, q: 1.3 });
        h.tone({ dest: out, at: t, f: 130, f1: 60, dur: 0.07, gain: 0.15 });
      },
      error(ctx, out, h) {
        const t = h.now();
        knock(h, out, t, 220, 0.06); knock(h, out, t + 0.1, 180, 0.06);
      },
    },

    /* ── Corkboard: pin taps and paper ── */
    cork: {
      tick(ctx, out, h) {
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.012, gain: 0.03, f: h.j(2600, 0.08), q: 3, attack: 0.0006 });
        h.tone({ dest: out, at: t, f: h.j(1900, 0.04), dur: 0.012, gain: 0.006, attack: 0.0008 });
        knock(h, out, t + 0.002, 230, 0.02);
      },
      swish(ctx, out, h) { // paper rustle
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.18, gain: 0.012, f: 1800, q: 0.4, attack: 0.03 });
        for (let i = 0; i < 4; i++) h.noise({ dest: out, at: t + h.r(0, 0.16), dur: h.r(0.01, 0.025), gain: h.r(0.022, 0.04), f: h.r(1500, 3200), q: 0.8 });
      },
      open(ctx, out, h) { // a pin pulled, the note lifted
        const t = h.now();
        h.tone({ dest: out, at: t, f: 2300, f1: 1700, dur: 0.03, gain: 0.008 });
        h.noise({ dest: out, at: t, dur: 0.015, gain: 0.03, f: 2800, q: 2.5 });
        for (let i = 0; i < 5; i++) h.noise({ dest: out, at: t + 0.03 + h.r(0, 0.17), dur: h.r(0.012, 0.03), gain: h.r(0.025, 0.045), f: h.r(1300, 3000), q: 0.8 });
      },
      close(ctx, out, h) { // pinned back
        const t = h.now();
        knock(h, out, t, 200, 0.05);
        h.noise({ dest: out, at: t, dur: 0.014, gain: 0.03, f: 2400, q: 2.5 });
        h.noise({ dest: out, at: t + 0.02, dur: 0.08, gain: 0.01, f: 1800, q: 0.5 });
      },
      error(ctx, out, h) {
        const t = h.now();
        knock(h, out, t, 160, 0.05); knock(h, out, t + 0.09, 140, 0.05);
      },
    },

    /* ── Magazine: paper ticks and page flips ── */
    magazine: {
      tick(ctx, out, h) {
        h.noise({ dest: out, dur: 0.016, gain: 0.032, type: 'highpass', f: h.j(2000, 0.1), q: 0.6, attack: 0.0008 });
      },
      swish(ctx, out, h) { // a page turns
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.2, gain: 0.03, f: 1100, f1: 3400, q: 0.6, attack: 0.07, filter2: { f: 4500 } });
        h.noise({ dest: out, at: t + 0.15, dur: 0.05, gain: 0.02, type: 'lowpass', f: 900, q: 0.7 });
      },
      open(ctx, out, h) { // the cover opens: a bigger flip and a soft landing
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.23, gain: 0.04, f: 900, f1: 3000, q: 0.6, attack: 0.08, filter2: { f: 4200 } });
        h.tone({ dest: out, at: t + 0.17, f: 120, f1: 70, dur: 0.07, gain: 0.05 });
      },
      close(ctx, out, h) {
        const t = h.now();
        h.noise({ dest: out, at: t, dur: 0.16, gain: 0.03, f: 3200, f1: 1000, q: 0.6, attack: 0.03, filter2: { f: 4200 } });
        h.tone({ dest: out, at: t + 0.12, f: 110, f1: 65, dur: 0.07, gain: 0.05 });
      },
      error(ctx, out, h) {
        h.tone({ dest: out, f: 200, f1: 130, dur: 0.12, gain: 0.04 });
      },
    },
  };

  window.__rfsSfxHelpers = helpers;
  window.__rfsSfxPacks = packs;
})();
