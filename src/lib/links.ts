const alerts = process.env.NEXT_PUBLIC_ALERTS_URL;

/** Telegram alerts channel; undefined unless configured with a t.me link. */
export const ALERTS_URL = alerts?.startsWith("https://t.me/") ? alerts : undefined;

/** Canonical public origin (www; the apex redirects to it). */
export const SITE_URL = process.env.SITE_URL || "https://www.hazelah.app";

/** Tip jar (Ko-fi: no platform fee on one-off tips), shown in the title bar and footer. */
const KOFI_USER = "sr33r00";
export const SUPPORT_URL = `https://ko-fi.com/${KOFI_USER}`;
/** Ko-fi's donation panel, for the support dialog's iframe. */
export const SUPPORT_EMBED_URL = `https://ko-fi.com/${KOFI_USER}/?hidefeed=true&widget=true&embed=true&preview=true`;
export const SUPPORT_LABEL = "Support on Ko-fi";
/** Name of the icon-only link in the title bar. */
export const SUPPORT_ICON_LABEL = "Support Haze Lah on Ko-fi";

/** OpenStreetMap page centred on a point, with a pin. */
export const mapLink = (lat: number, lon: number) => `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=16/${lat.toFixed(5)}/${lon.toFixed(5)}`;

export const OPEN_DATA_LICENCE = "https://data.gov.sg/open-data-licence";

/** The height of the wind the site shows (the 850 hPa level), as a phrase. */
export const WIND_HEIGHT = "about 1.5 km up";

/** What the wind lines on the Smoke and fires map and the globe show. */
export const WIND_NOTE = `Lines show the wind at ${WIND_HEIGHT}.`;

/** NEA, Computation of the Pollutant Standards Index (PSI): the PSI breakpoints for every pollutant. */
export const NEA_PSI_URL = "https://www.haze.gov.sg/docs/default-source/faq/computation-of-the-pollutant-standards-index-(psi).pdf";
