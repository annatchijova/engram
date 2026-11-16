/**
 * ENGRAM Memory Observatory — typefaces for code-rendered labels.
 *
 * Two families, bundled (OFL) so a headset renders the same glyphs as a
 * desktop: Inter for words (the same family the UIKit panels use, so labels
 * and panels read as one system) and IBM Plex Mono for anything that is an
 * identifier or a hash, so machine values are recognisable by shape before
 * they are read.
 *
 * Canvas text silently falls back to a system face if the font is not ready
 * at draw time, so the room waits for these (bounded) before it is built.
 * A failure degrades to the fallback stack; it never blocks the scene.
 */
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';

export const FONT_SANS = 'Inter, "Segoe UI", Helvetica, Arial, sans-serif';
export const FONT_MONO = '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace';

const FACES = [
  '400 20px Inter', '500 20px Inter', '600 20px Inter', '700 20px Inter',
  '400 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"',
];

export async function loadTypography(timeoutMs = 2500): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const all = Promise.all(FACES.map((f) => document.fonts.load(f).catch(() => [])));
  await Promise.race([all, new Promise((resolve) => setTimeout(resolve, timeoutMs))]);
}
