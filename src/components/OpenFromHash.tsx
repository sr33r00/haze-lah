"use client";

import { useEffect } from "react";

/** Opens the <details> named by the URL hash, so a deep link like /guide#n95 lands on an open answer. Renders nothing. */
export default function OpenFromHash() {
  useEffect(() => {
    const open = () => {
      const el = document.getElementById(location.hash.slice(1));
      if (!(el instanceof HTMLDetailsElement)) return;
      el.open = true;
      el.scrollIntoView({ block: "start" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  return null;
}
