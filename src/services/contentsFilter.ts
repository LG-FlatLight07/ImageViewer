/** Match only the URL portion before /contents/, never image names or signed queries. */
export function matchesContentsFilter(src: string, filter: string): boolean {
  if (!filter.trim()) return true;
  try {
    const url = new URL(src);
    const path = decodeURIComponent(url.pathname);
    const marker = path.toLowerCase().indexOf('/contents/');
    if (marker < 0) return false;
    const prefix = `${url.origin}${path.slice(0, marker)}`.toLowerCase();
    // Pasting the complete /contents/ directory URL is also supported.
    const condition = filter
      .trim()
      .split(/[?#]/)[0]
      .replace(/\/contents\/.*$/i, '')
      .replace(/\/$/, '')
      .toLowerCase();
    return condition.length > 0 && prefix.includes(condition);
  } catch {
    return false;
  }
}
