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
import { AudioCues } from './observatory/audio-cues.js';
import { SessionStore } from './session.js';

/** Printed on the login panel and in the README: the account judges are
 * told to use. Not a secret, and deliberately the only one pre-filled. */
const JUROR_USERNAME = 'meta';
const JUROR_PASSWORD = 'metavr';

export class LoginSystem extends createSystem({}) {
  private username = '';
  private password = '';

  init(): void {
    const panel = this.world.getSceneObject<UIKitMLAsset>('login-panel');
    if (!panel) return;

    const userField = panel.getElementById('login-user');
    const passField = panel.getElementById('login-pass');
    const submitBtn = panel.getElementById('login-submit');
    const jurorBtn = panel.getElementById('login-juror');
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

    const submit = (username: string, password: string) => {
      void (async () => {
        setStatus('logging in...', false);
        try {
          const result = await EngramApi.login(username, password);
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
          AudioCues.play('open');
          this.password = '';
          passField?.setProperties({ value: '' });
        } catch (err) {
          SessionStore.set(null);
          AudioCues.play('failure');
          setStatus(String((err as Error).message ?? err), true);
        }
      })();
    };

    const onSubmit = () => submit(this.username, this.password);

    // Typing a username and a password on a floating keyboard, with your
    // hands, in the middle of an investigation, is the worst friction in the
    // walkthrough. The juror account is already printed on this panel and in
    // the README, so filling it in costs no secrecy and saves the demo. The
    // fields are filled visibly rather than bypassed, so what was submitted
    // stays inspectable, and typing an operator by hand still works -- that
    // is how you watch MNEME refuse Agent Ada.
    const onJuror = () => {
      this.username = JUROR_USERNAME;
      this.password = JUROR_PASSWORD;
      userField?.setProperties({ value: JUROR_USERNAME });
      passField?.setProperties({ value: JUROR_PASSWORD });
      submit(JUROR_USERNAME, JUROR_PASSWORD);
    };

    submitBtn?.addEventListener('click', onSubmit);
    jurorBtn?.addEventListener('click', onJuror);
    this.cleanupFuncs.push(
      () => submitBtn?.removeEventListener('click', onSubmit),
      () => jurorBtn?.removeEventListener('click', onJuror),
    );
  }
}
