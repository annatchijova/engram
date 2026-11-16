/**
 * ENGRAM Memory Observatory — code-generated caption plates.
 *
 * A label is a canvas-rendered texture on a Sprite, so every in-world name,
 * status and hash prefix is readable without any external art. Text content
 * always comes from MNEME responses; this module only typesets it.
 *
 * One typographic system for the whole room:
 *  - Inter for words, IBM Plex Mono for identifiers and hashes
 *    (`font: 'mono'`), so a machine value is recognisable by shape;
 *  - an all-caps bold line is tracked out and reads as a heading;
 *  - the plate is an ink scrim with one hairline rule in the accent colour
 *    along its top edge. No rounded boxes, no outlines: the rule is the
 *    only ornament and it says which instrument the caption belongs to;
 *  - no line is ever set smaller than MIN_PX, and a line that does not fit
 *    wraps instead of being cut, because a truncated gloss is not a gloss.
 */
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
} from '@iwsdk/core';
import { OBS } from './palette.js';
import { FONT_MONO, FONT_SANS } from './typography.js';

export type LabelLine = {
  text: string;
  color?: string;
  size?: number;
  weight?: string;
  /** 'mono' for identifiers, hashes and versions. */
  font?: 'sans' | 'mono';
};

export type LabelOptions = {
  /** World width in meters of the sprite; height follows the canvas aspect. */
  width?: number;
  /** Any value enables the ink scrim; its alpha suffix (if 8-digit hex) is kept. */
  background?: string;
  /** Accent colour of the hairline rule along the top edge. */
  border?: string;
  align?: 'left' | 'center';
  padding?: number;
  /** Render the sprite on top of depth-tested geometry (hovering badges). */
  depthTest?: boolean;
};

/** Texture density. 1600 px/m is ~1.7x what a Quest 3 resolves at 1.5 m,
 * which leaves headroom for leaning in without paying for it at rest. */
export const PX_PER_M = 1600;
/** Smallest em height ever set: 24 px = 1.5 cm, 0.57 deg at 1.5 m. */
export const MIN_PX = 24;
const MAX_ROWS = 3;
const LINE_HEIGHT = 1.3;
const RULE_PX = 3;

type Row = { text: string; font: string; size: number; color: string; tracking: string; gapBefore: number };

export function makeLabel(lines: LabelLine[], opts: LabelOptions = {}): Sprite {
  const width = opts.width ?? 0.26;
  const padding = opts.padding ?? 18;
  const canvasW = Math.round(width * PX_PER_M);
  const maxTextW = canvasW - padding * 2;
  const measure = document.createElement('canvas').getContext('2d')!;

  const rows: Row[] = [];
  lines.forEach((l, index) => {
    if (!l.text) return;
    const size = Math.max(MIN_PX, Math.round((l.size ?? 26) * (PX_PER_M / 1400)));
    const weight = l.weight ?? '500';
    const family = l.font === 'mono' ? FONT_MONO : FONT_SANS;
    const font = `${weight} ${size}px ${family}`;
    const heading = l.font !== 'mono' && Number(weight) >= 700 && isAllCaps(l.text);
    const tracking = heading ? `${(size * 0.07).toFixed(1)}px` : '0px';
    measure.font = font;
    setTracking(measure, tracking);
    const wrapped = wrap(measure, l.text, maxTextW);
    wrapped.forEach((text, i) => rows.push({
      text, font, size, color: l.color ?? OBS.ivory, tracking,
      gapBefore: i === 0 && index > 0 ? size * 0.18 : 0,
    }));
  });

  let totalH = padding * 2 + (opts.border ? RULE_PX : 0);
  for (const r of rows) totalH += r.gapBefore + r.size * LINE_HEIGHT;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = Math.max(8, Math.round(totalH));
  const ctx = canvas.getContext('2d')!;
  if (opts.background) {
    const alpha = /^#[0-9a-f]{8}$/i.test(opts.background) ? opts.background.slice(7) : 'e6';
    ctx.fillStyle = `${OBS.ink}${alpha}`;
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 5);
    ctx.fill();
  }
  if (opts.border) {
    ctx.fillStyle = opts.border.slice(0, 7);
    ctx.fillRect(0, 0, canvas.width, RULE_PX);
  }
  ctx.textBaseline = 'top';
  const align = opts.align ?? 'center';
  ctx.textAlign = align;
  const x = align === 'center' ? canvas.width / 2 : padding;
  let y = padding + (opts.border ? RULE_PX : 0);
  for (const r of rows) {
    y += r.gapBefore;
    ctx.font = r.font;
    setTracking(ctx, r.tracking);
    ctx.fillStyle = r.color;
    // Optical centring: tracking adds trailing space after the last glyph.
    const nudge = align === 'center' ? parseFloat(r.tracking) / 2 : 0;
    ctx.fillText(r.text, x + nudge, y + r.size * 0.12);
    y += r.size * LINE_HEIGHT;
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  // Mipmaps + anisotropy: a caption read at a grazing angle or from across
  // the room must not shimmer when the head moves.
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = 4;
  const material = new SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: opts.depthTest ?? true,
    depthWrite: false,
  });
  const sprite = new Sprite(material);
  // Labels are never interaction targets. three's Sprite.raycast requires
  // raycaster.camera and otherwise throws mid-traversal, which aborted the
  // whole pointer intersection pass with partial results (every hover
  // resolved to the first core). A no-op raycast keeps labels purely visual.
  sprite.raycast = () => {};
  sprite.scale.set(width, width * (canvas.height / canvas.width), 1);
  return sprite;
}

export function disposeLabel(sprite: Sprite): void {
  const material = sprite.material as SpriteMaterial;
  material.map?.dispose();
  material.dispose();
}

/** World height in meters of a label built with makeLabel. */
export function labelHeight(sprite: Sprite): number {
  return sprite.scale.y;
}

function isAllCaps(text: string): boolean {
  return /[A-Z]/.test(text) && text === text.toUpperCase();
}

function setTracking(ctx: CanvasRenderingContext2D, value: string): void {
  // letterSpacing is Chromium 99+ (Quest Browser included); elsewhere the
  // heading simply sets untracked.
  (ctx as unknown as { letterSpacing?: string }).letterSpacing = value;
}

/** Greedy word wrap to at most MAX_ROWS rows; only the last row may elide. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(/\s+/);
  const rows: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      rows.push(current);
      current = word;
    }
  }
  if (current) rows.push(current);
  const kept = rows.slice(0, MAX_ROWS);
  if (rows.length > MAX_ROWS) kept[MAX_ROWS - 1] = `${kept[MAX_ROWS - 1]} ${rows.slice(MAX_ROWS).join(' ')}`;
  return kept.map((row) => elide(ctx, row, maxWidth));
}

function elide(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
