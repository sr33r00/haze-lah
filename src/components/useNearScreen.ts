import { useEffect, useState, type RefObject } from "react";

/** Whether the element has come within `margin` px of the screen (true from then on): what a section waits for before it loads its pictures. Without IntersectionObserver it is true at once. */
export function useNearScreen(ref: RefObject<Element | null>, margin = 300) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return setNear(true);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setNear(true);
        io.disconnect();
      },
      { rootMargin: `${margin}px` },
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, margin]);
  return near;
}
