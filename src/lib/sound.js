/** A short two-tone "ping" made with the Web Audio API (no sound files needed).
 *  Browsers only allow audio after a user gesture, so call unlockAudio() from a click handler. */
let ctx = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
}

export function ping(mag = 5) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  // Lower pitch for stronger quakes, so you can "hear" the size.
  const base = Math.max(220, 880 - (mag - 4) * 140);
  [0, 0.18].forEach((delay, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = base * (i ? 1.5 : 1);
    gain.gain.setValueAtTime(0.0001, t0 + delay);
    gain.gain.exponentialRampToValueAtTime(0.25, t0 + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + delay);
    osc.stop(t0 + delay + 0.65);
  });
}
