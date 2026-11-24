/** Only allow http(s) links from feed data (blocks e.g. "javascript:" URLs). */
export function safeUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}
