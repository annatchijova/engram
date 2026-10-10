/**
 * ENGRAM — wires the plain-DOM login overlay (index.html) to EngramApi and
 * SessionStore. Plain DOM, not UIKitML: Nivel 1 only confirmed div/span/
 * button as verified-working UIKitML tags, and a username/password form is
 * safer built as ordinary HTML than guessed into an unverified input widget.
 */
import { EngramApi } from './engram-api.js';
import { SessionStore } from './session.js';

export function initLoginOverlay(): void {
  const user = document.getElementById('engram-login-user') as HTMLInputElement | null;
  const pass = document.getElementById('engram-login-pass') as HTMLInputElement | null;
  const submit = document.getElementById('engram-login-submit');
  const status = document.getElementById('engram-login-status');
  if (!user || !pass || !submit || !status) return;

  const setStatus = (text: string, isError: boolean) => {
    status.textContent = text;
    status.classList.toggle('error', isError);
  };

  submit.addEventListener('click', () => {
    void (async () => {
      setStatus('logging in...', false);
      try {
        const result = await EngramApi.login(user.value, pass.value);
        SessionStore.set({
          sessionToken: result.session_token,
          actorId: result.actor_id,
          displayName: result.display_name,
          effectiveCapabilities: result.effective_capabilities,
        });
        setStatus(`logged in as ${result.display_name}`, false);
        pass.value = '';
      } catch (err) {
        SessionStore.set(null);
        setStatus(String((err as Error).message ?? err), true);
      }
    })();
  });
}
