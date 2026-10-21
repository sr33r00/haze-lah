const alerts = process.env.NEXT_PUBLIC_ALERTS_URL;

/** Telegram alerts channel; undefined unless configured with a t.me link. */
export const ALERTS_URL = alerts?.startsWith("https://t.me/") ? alerts : undefined;

/** Canonical public origin (www; the apex redirects to it). */
export const SITE_URL = process.env.SITE_URL || "https://www.hazelah.app";

/** Tip jar, shown in the title bar and footer. */
export const BMC_URL = "https://buymeacoffee.com/hazelah";
export const BMC_LABEL = "Buy me a coffee";
/** Name of the icon-only link in the title bar. */
export const BMC_ICON_LABEL = `Support Haze Lah: ${BMC_LABEL.toLowerCase()}`;

/** OpenStreetMap page centred on a point, with a pin. */
export const mapLink = (lat: number, lon: number) => `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=16/${lat.toFixed(5)}/${lon.toFixed(5)}`;

export const OPEN_DATA_LICENCE = "https://data.gov.sg/open-data-licence";
