/**
 * ENGRAM Memory Observatory — discreet audio cues.
 *
 * Code-generated WebAudio only (no external assets): short, quiet,
 * instrument-panel sounds that confirm an interaction happened. Strictly
 * presentation: a cue plays AFTER the event it reports, is never a channel
 * of evidence meaning, and carries no information that is not already on
 * screen in text. Staging and committing sound deliberately different, so
 * the two can never be confused by ear.
 *
 * The AudioContext is created lazily on the first cue (every cue follows a
 * user interaction, which satisfies the browser autoplay gate) and the
 * module degrades silently if WebAudio is unavailable.
 */
type Cue = 'select' | 'open' | 'trace' | 'stage' | 'commit' | 'chamber' | 'verify' | 'failure';

// freq (Hz), duration (s), type, gain — kept low; a cue must never dominate.
const CUES: Record<Cue, { f: number[]; d: number; type: OscillatorType; g: number }> = {
  select: { f: [880], d: 0.05, type: 'sine', g: 0.05 },
  open: { f: [520, 780], d: 0.08, type: 'sine', g: 0.05 },
  trace: { f: [440, 660, 880], d: 0.07, type: 'triangle', g: 0.045 },
  stage: { f: [330, 440], d: 0.1, type: 'square', g: 0.03 },
  commit: { f: [220, 330, 440], d: 0.14, type: 'sine', g: 0.06 },
  chamber: { f: [587, 784], d: 0.12, type: 'sine', g: 0.04 },
  verify: { f: [659, 880, 1047], d: 0.1, type: 'sine', g: 0.05 },
  failure: { f: [196, 165], d: 0.16, type: 'sawtooth', g: 0.035 },
};

let ctx: AudioContext | null = null;
let enabled = true;

function context(): AudioContext | null {
  if (!enabled) return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) { enabled = false; return null; }
    ctx = new Ctor();
    return ctx;
  } catch {
    enabled = false;
    return null;
  }
}

export const AudioCues = {
  play(cue: Cue): void {
    const ac = context();
    if (!ac) return;
    if (ac.state === 'suspended') void ac.resume();
    const spec = CUES[cue];
    spec.f.forEach((freq, i) => {
      const t0 = ac.currentTime + i * spec.d * 0.6;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = spec.type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(spec.g, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.d);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + spec.d + 0.02);
    });
  },
  /** Opt-out hook for a headset session where any sound is unwanted. */
  setEnabled(value: boolean): void { enabled = value; },
};
