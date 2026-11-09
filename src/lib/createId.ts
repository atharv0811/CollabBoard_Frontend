/**
 * Returns a random RFC 4122 v4 UUID.
 *
 * `crypto.randomUUID()` only exists in secure contexts (HTTPS or localhost).
 * When the dev server is opened from a phone via a LAN address such as
 * http://192.168.x.x:5173, it is `undefined` and calling it throws.
 * `crypto.getRandomValues()` is available in every context, so it is used
 * as the fallback.
 */
export function createId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
