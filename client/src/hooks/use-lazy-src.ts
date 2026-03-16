import { useEffect, useRef, useState } from "react";

/**
 * Returns a src value that is only populated once the element enters the viewport.
 * Pass the returned ref to the media element and use lazySrc as the src.
 */
export function useLazySrc(src: string | null | undefined) {
  const ref = useRef<HTMLVideoElement>(null);
  const [lazySrc, setLazySrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!src) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLazySrc(src);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [src]);

  // Reset when src changes
  useEffect(() => {
    setLazySrc(undefined);
  }, [src]);

  return { ref, lazySrc };
}
