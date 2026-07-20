const LOOKS_LIKE_URL = /^([a-z][a-z0-9+.-]*:\/\/)|(^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$)/i;

export function resolveInputToUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return '';
  }
  if (LOOKS_LIKE_URL.test(trimmed)) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}
