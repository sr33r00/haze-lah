"use client";

import { useEffect, useState } from "react";
import type { Camera } from "@/lib/types";

/** LTA traffic cameras, fetched once when the page loads: null until then, empty if the fetch fails. */
export function useCameras(): Camera[] | null {
  const [cameras, setCameras] = useState<Camera[] | null>(null);
  useEffect(() => {
    fetch("/api/cameras")
      .then((r) => (r.ok ? r.json() : []))
      .then(setCameras)
      .catch(() => setCameras([]));
  }, []);
  return cameras;
}
