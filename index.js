/**
 * dsh-locale-ru - host half.
 *
 * The pack is browser-only: this node half exists so the client-modules scanner
 * can find the package (dsh.client platform "web") and serve lib/client.js to
 * the browser, where the language and dictionaries register through the public
 * locale API. It deliberately does nothing on the host.
 */
export const name = 'dsh-locale-ru'

export function apply() {
  // Intentionally empty on the host side.
}
