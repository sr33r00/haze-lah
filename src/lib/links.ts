const alerts = process.env.NEXT_PUBLIC_ALERTS_URL;

/** Telegram alerts channel; undefined unless configured with a t.me link. */
export const ALERTS_URL = alerts?.startsWith("https://t.me/") ? alerts : undefined;

/** Canonical public origin (www; the apex redirects to it). */
export const SITE_URL = process.env.SITE_URL || "https://hazelah.app";

/** OpenStreetMap page centred on a point, with a pin. */
export const mapLink = (lat: number, lon: number) => `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=16/${lat.toFixed(5)}/${lon.toFixed(5)}`;

export const OPEN_DATA_LICENCE = "https://data.gov.sg/open-data-licence";

/** The height of the wind the site shows (the 850 hPa level), as a phrase. */
export const WIND_HEIGHT = "about 1.5 km up";

/** What the wind lines on the Smoke and fires map and the globe show. */
export const WIND_NOTE = `Lines show the wind at ${WIND_HEIGHT}.`;

/** NEA, Computation of the Pollutant Standards Index (PSI): the PSI breakpoints for every pollutant. */
export const NEA_PSI_URL = "https://www.haze.gov.sg/docs/default-source/faq/computation-of-the-pollutant-standards-index-(psi).pdf";

/** NASA Earth Observatory, "Aerosols: Small Particles with Big Impacts": what aerosol optical depth is. */
export const NASA_AOD_URL = "https://earthobservatory.nasa.gov/features/Aerosols";

/** NEA / Meteorological Service Singapore, Heat Stress: what WBGT is and NEA's heat stress bands. */
export const HEAT_STRESS_URL = "https://www.weather.gov.sg/heat-stress/";

/** WHO, Global Solar UV Index: A Practical Guide (the UV categories). */
export const WHO_UV_URL = "https://www.who.int/publications/i/item/9241590076";

/** AQICN, the World Air Quality Index Project: the station data on the Now map's US AQI view needs this credit. */
export const WAQI_URL = "https://waqi.info";
export const WAQI_NAME = "World Air Quality Index Project";

/** The Guide answer on why AQICN shows a bigger number than NEA. */
export const GUIDE_AQICN_URL = "/guide#other-apps";

/** Said under the US AQI view of the Now map. */
export const US_AQI_NOTE = "US AQI reads higher than Singapore's PSI for the same air. NEA's PSI is the official measure.";

/** URA Master Plan 2019 Region Boundary (No Sea) on data.gov.sg: the source of Singapore's outline on the maps. */
export const SG_OUTLINE_URL = "https://data.gov.sg/datasets/d_bf4d24df9129d5a8ff8cf82e20959ee0/view";
export const SG_OUTLINE_NAME = "URA Master Plan 2019";

/** The id of the footer's feedback form, and the link that opens it from anywhere on the page. */
export const FEEDBACK_ID = "feedback";
export const FEEDBACK_URL = `#${FEEDBACK_ID}`;
