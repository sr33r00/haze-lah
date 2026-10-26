"use client";

import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

/**
 * Keeps a Leaflet map in step with its container: whenever the container changes size, or is shown after being hidden, the map is
 * told (`invalidateSize`), so its tiles and layers fill the new size. `onSize` is then called with the map, and `blind` true the first
 * time a map that was made while hidden (size 0) has a size, because the view it was given then was not fitted to anything.
 */
export function useMapResize(onSize?: (map: LeafletMap, blind: boolean) => void) {
  const map = useMap();
  const callback = useRef(onSize);
  useEffect(() => {
    callback.current = onSize;
  });
  useEffect(() => {
    const el = map.getContainer();
    const { x, y } = map.getSize();
    let sized = x > 0 && y > 0;
    const watch = new ResizeObserver(() => {
      if (!el.clientWidth || !el.clientHeight) return; // hidden: nothing to fit yet
      map.invalidateSize({ animate: false });
      const blind = !sized;
      sized = true;
      callback.current?.(map, blind);
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [map]);
}
