// Sound, off unless you turn it on: a rubber stamp for tickets and finished work, a diesel turning over at the
// end of an ordinary week, and two bright notes for a win. Made on the spot, so there are no files to load.

export type Sfx = 'stamp' | 'start' | 'win';

let AC: AudioContext | null = null;

export function sfx(kind: Sfx, on: boolean | undefined): void {
  if (!on) return;
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctx = W.AudioContext || W.webkitAudioContext;
    if (!Ctx) return;
    AC = AC || new Ctx();
    const t0 = AC.currentTime, g = AC.createGain();
    g.connect(AC.destination);
    if (kind === 'stamp') {
      // a short burst of noise that dies away fast
      const n = AC.createBufferSource(), b = AC.createBuffer(1, Math.floor(AC.sampleRate * 0.12), AC.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      n.buffer = b;
      g.gain.value = 0.5;
      n.connect(g);
      n.start(t0);
      return;
    }
    const o = AC.createOscillator(), win = kind === 'win';
    o.type = win ? 'triangle' : 'sawtooth';
    o.frequency.setValueAtTime(win ? 520 : 55, t0);
    if (win) o.frequency.setValueAtTime(780, t0 + 0.12);
    else o.frequency.linearRampToValueAtTime(42, t0 + 0.5);
    g.gain.setValueAtTime(win ? 0.18 : 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (win ? 0.35 : 0.55));
    o.connect(g);
    o.start(t0);
    o.stop(t0 + 0.6);
  } catch {
    // no sound on this device: the game carries on
  }
}
