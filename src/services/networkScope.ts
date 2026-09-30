/** Preserve reader pagination, but never merge separate content IDs or the homepage. */
export function networkScope(pageUrl: string): string {
  const url = new URL(pageUrl);
  const route = /^#!?\//.test(url.hash)
    ? new URL(url.hash.replace(/^#!/, '').replace(/^#/, ''), url.origin)
    : url;
  let path = route.pathname;
  if (url.hostname === 'komiflo.com') {
    const reader = path.match(/^\/comics\/(\d+)\/read(?:\/page\/\d+)?\/?$/);
    if (reader) path = `/comics/${reader[1]}/read`;
  } else {
    path = path.replace(/\/page\/\d+\/?$/, '');
  }
  const query = new URLSearchParams(route.search);
  query.delete('page');
  return `${url.origin}${path}?${query.toString()}`;
}

// Literal source is required in Hermes; Function.toString() is not portable.
export const NETWORK_SCOPE_FUNCTION = String.raw`function (pageUrl) {
  var url = new URL(pageUrl);
  var route = /^#!?\//.test(url.hash) ? new URL(url.hash.replace(/^#!/, '').replace(/^#/, ''), url.origin) : url;
  var path = route.pathname;
  if (url.hostname === 'komiflo.com') {
    var reader = path.match(/^\/comics\/(\d+)\/read(?:\/page\/\d+)?\/?$/);
    if (reader) path = '/comics/' + reader[1] + '/read';
  } else path = path.replace(/\/page\/\d+\/?$/, '');
  var query = new URLSearchParams(route.search);
  query.delete('page');
  return url.origin + path + '?' + query.toString();
}`;
