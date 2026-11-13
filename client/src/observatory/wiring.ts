/**
 * ENGRAM — panel wiring diagnostics.
 *
 * A UIKitML element id that does not resolve fails silently: the listener
 * is never attached and the button simply does nothing forever. That class
 * of defect cost a full validation round, so every in-world control is now
 * resolved through here, and a missing one is reported loudly once at boot
 * instead of being discovered by a juror pressing a dead button.
 */
import type { UIKitMLAsset } from '@iwsdk/core';

type Element = ReturnType<UIKitMLAsset['getElementById']>;

const missing: string[] = [];

export function requireElement(
  panel: UIKitMLAsset | undefined,
  panelId: string,
  elementId: string,
): Element | undefined {
  if (!panel) {
    report(`${panelId}: panel asset not resolved`);
    return undefined;
  }
  const element = panel.getElementById(elementId);
  if (!element) report(`${panelId}#${elementId}: element not found`);
  return element;
}

function report(what: string): void {
  missing.push(what);
  // eslint-disable-next-line no-console
  console.error(`[ENGRAM wiring] MISSING ${what}`);
}

export function wiringReport(): string[] {
  return [...missing];
}
