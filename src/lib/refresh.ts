/** True when NEA's newest hour is later than the site's newest reading, or the site has none. */
export function isNewer(nea: string | null, site: string | null): boolean {
  if (!nea) return false;
  return !site || Date.parse(nea) > Date.parse(site);
}
