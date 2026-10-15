const alerts = process.env.NEXT_PUBLIC_ALERTS_URL;

/** Telegram alerts channel; undefined unless configured with a t.me link. */
export const ALERTS_URL = alerts?.startsWith("https://t.me/") ? alerts : undefined;

/** Canonical public origin (www; the apex redirects to it). */
export const SITE_URL = process.env.SITE_URL || "https://www.hazelah.app";

/** Tip jar, shown in the title bar and footer. */
export const BMC_URL = "https://buymeacoffee.com/hazelah";
