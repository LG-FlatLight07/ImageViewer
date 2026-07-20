import { SEARCH_ENGINES, type SearchEngineKey } from '../store/settingsStore';

const LOOKS_LIKE_URL = /^([a-z][a-z0-9+.-]*:\/\/)|(^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$)/i;

export function resolveInputToUrl(
  rawInput: string,
  searchEngine: SearchEngineKey = 'google',
): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return '';
  }
  if (LOOKS_LIKE_URL.test(trimmed)) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
  const engine = SEARCH_ENGINES.find((e) => e.key === searchEngine) ?? SEARCH_ENGINES[0];
  return engine.searchUrl(encodeURIComponent(trimmed));
}
