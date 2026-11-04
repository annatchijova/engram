/**
 * ENGRAM — operator login, in-scene UIKitML (not DOM).
 *
 * Replaces the earlier DOM `#engram-login` overlay: that box sat outside the
 * WebXR composited scene, and `iwsdk.config.json` declares `xr.mode: "vr"`
 * with no `domOverlay` feature — `dom-overlay` is primarily AR-spec'd, so a
 * jury member wearing the headset could never see or operate a flat DOM
 * login box. UIKitML's `<input type="password">` is a genuinely supported
 * element (resolved from @drawcall/uikitml's html component set, included by
 * default alongside the horizon kit) — the premise that only div/span/button
 * were verified no longer holds.
 */
import { createSystem, UIKitMLAsset } from '@iwsdk/core';
import { EngramApi } from './engram-api.js';
import { SessionStore } from './session.js';

export class LoginSystem extends createSystem({}) {
  private username = '';
  private password = '';

  init(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('login-panel');
    if (!panel) return;

    const userField = panel.getElementById('login-user');
    const passField = panel.getElementById('login-pass');
    const submitBtn = panel.getElementById('login-submit');
    const status = panel.getElementById('login-status');

    userField?.setProperties({
      onValueChange: (value: string) => { this.username = value; },
    });
    passField?.setProperties({
      onValueChange: (value: string) => { this.password = value; },
    });

    const setStatus = (text: string, isError: boolean) => {
      status?.setProperties({ text, color: isError ? '#e07070' : '#9fb79f' });
    };

    const onSubmit = () => {
      void (async () => {
        setStatus('logging in...', false);
        try {
          const result = await EngramApi.login(this.username, this.password);
          const expiresAt = Date.now() + result.expires_in_seconds * 1000;
          SessionStore.set({
            sessionToken: result.session_token,
            actorId: result.actor_id,
            displayName: result.display_name,
            effectiveCapabilities: result.effective_capabilities,
            expiresAt,
          });
          setStatus(
            `logged in as ${result.display_name} - ` +
            `session until ${new Date(expiresAt).toLocaleTimeString()}`,
            false,
          );
          this.password = '';
          passField?.setProperties({ value: '' });
        } catch (err) {
          SessionStore.set(null);
          setStatus(String((err as Error).message ?? err), true);
        }
      })();
    };

    submitBtn?.addEventListener('click', onSubmit);
    this.cleanupFuncs.push(() => submitBtn?.removeEventListener('click', onSubmit));
  }
}
