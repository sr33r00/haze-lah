"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type AirGlobe from "./AirGlobe";

// MapLibre needs the browser, so the globe is loaded there only.
const Globe = dynamic(() => import("./AirGlobe"), { ssr: false, loading: () => <div className="size-full bg-[#02030a]" /> });

/** The air globe, loaded in the browser. Same props as `AirGlobe`. */
export default function AirGlobeLoader(props: ComponentProps<typeof AirGlobe>) {
  return <Globe {...props} />;
}
