import pkg from '../../package.json';

/**
 * Latest-release check for a private repo.
 *
 * The release workflow uploads version.json next to the APK. A public repo
 * would serve it at releases/latest/download/version.json. This repo is
 * private, so that URL returns 404 without a token. The fetch is allowed to
 * fail, and the game just starts. Tapping a successful prompt opens the
 * release page in the browser, where a signed-in GitHub session can download.
 */
export const RELEASE_PAGE = 'https://github.com/AmericanN3rd/NotAnotherZombieGame/releases/latest';
const VERSION_URL = 'https://github.com/AmericanN3rd/NotAnotherZombieGame/releases/latest/download/version.json';

export const APP_VERSION = pkg.version;

export function isNewer(latest: string, current: string): boolean {
  const parse = (value: string) =>
    value
      .trim()
      .replace(/^v/, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));
  const next = parse(latest);
  const now = parse(current);
  const length = Math.max(next.length, now.length, 3);
  for (let i = 0; i < length; i++) {
    const a = next[i] ?? 0;
    const b = now[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

export async function checkForUpdate(onUpdate: (url: string) => void): Promise<void> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(VERSION_URL, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) return;
    const body = (await response.json()) as { version?: string; url?: string };
    if (typeof body.version !== 'string') return;
    if (!isNewer(body.version, APP_VERSION)) return;
    onUpdate(typeof body.url === 'string' && body.url.length > 0 ? body.url : RELEASE_PAGE);
  } catch {
    // Offline, or the private release asset refused an anonymous request.
  } finally {
    window.clearTimeout(timer);
  }
}
