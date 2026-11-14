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

/**
 * Show or hide a whole panel.
 *
 * Collapsing a UIKit root with `display: none` empties the panel but
 * leaves its scene node exactly where it was, and the XR ray intersector
 * filters candidates with `isObjectTreeVisible` (see @iwsdk/xr-input's
 * ray-pointer.js) — so a "hidden" panel went on swallowing every ray
 * that crossed it. The welcome card sits dead ahead at eye height, which
 * made the actor registry behind it unreachable once the card was
 * dismissed: no authority inspection and no staging from the cradle.
 * Visibility and interactivity have to move together, so every gating
 * site goes through here.
 */
export function setPanelVisible(
  panel: UIKitMLAsset | undefined,
  rootId: string,
  visible: boolean,
): void {
  if (!panel) return;
  panel.getElementById(rootId)?.setProperties({ display: visible ? 'flex' : 'none' });
  const node = panel as unknown as { visible: boolean };
  node.visible = visible;
}

