import Link from "next/link";
import SupportLinks from "./SupportLinks";

export default function Footer({ errors }: { errors: string[] }) {
  return (
    <footer className="mt-12 space-y-3 px-6 text-center text-[13px] leading-relaxed text-muted">
      <SupportLinks />
      <p>
        Readings from NEA via data.gov.sg and Malaysia&apos;s Department of Environment. Fires from NASA FIRMS. Forecast from Copernicus CAMS and ECMWF via
        Open-Meteo. News from NEA and the Meteorological Service Singapore.
      </p>
      <p>
        An independent tool, not an official NEA service. For official advisories visit{" "}
        <a className="font-semibold text-accent underline" href="https://www.haze.gov.sg" target="_blank" rel="noreferrer">
          haze.gov.sg
        </a>
        , and NEA&apos;s daily{" "}
        <a className="font-semibold text-accent underline" href="https://www.nea.gov.sg/media/news/advisories" target="_blank" rel="noreferrer">
          haze updates
        </a>{" "}
        for the official 24-hour PSI outlook.
      </p>
      <p>
        <Link className="font-semibold text-accent underline" href="/about">
          How the forecast works
        </Link>
      </p>
      {errors.length > 0 && <p style={{ color: "var(--lv3)" }}>Not loading right now: {errors.join(", ")}.</p>}
    </footer>
  );
}
