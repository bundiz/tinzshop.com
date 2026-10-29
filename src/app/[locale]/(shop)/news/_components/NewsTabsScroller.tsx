"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Icon from "@/components/ui/Icon";
import { scrollEdges } from "./scroll-edges";

export type NewsTabsScrollerProps = {
  children: ReactNode;
  prevLabel: string;
  nextLabel: string;
};

const ARROW =
  "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg text-text shadow-md hover:border-primary hover:text-primary";

/** Wraps the server-rendered tab list in a sideways scroll strip with ‹ › buttons shown only when that way can scroll. */
export default function NewsTabsScroller({
  children,
  prevLabel,
  nextLabel,
}: NewsTabsScrollerProps) {
  const strip = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({
    canScrollLeft: false,
    canScrollRight: false,
  });

  const update = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    const next = scrollEdges(el.scrollLeft, el.clientWidth, el.scrollWidth);
    setEdges((prev) =>
      prev.canScrollLeft === next.canScrollLeft &&
      prev.canScrollRight === next.canScrollRight
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    el.querySelector('[aria-current="page"]')?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [update]);

  const scrollBy = (direction: -1 | 1) => {
    const el = strip.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollBy({
      left: direction * el.clientWidth * 0.8,
      behavior: reduced ? "instant" : "smooth",
    });
  };

  return (
    <div className="relative">
      <div
        ref={strip}
        onScroll={update}
        className="overflow-x-auto pb-1 [scrollbar-width:none]"
      >
        {children}
      </div>
      {edges.canScrollLeft && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-bg to-transparent"
          />
          <button
            type="button"
            aria-label={prevLabel}
            onClick={() => scrollBy(-1)}
            className={`${ARROW} left-0`}
          >
            <Icon name="chevLeft" />
          </button>
        </>
      )}
      {edges.canScrollRight && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-bg to-transparent"
          />
          <button
            type="button"
            aria-label={nextLabel}
            onClick={() => scrollBy(1)}
            className={`${ARROW} right-0`}
          >
            <Icon name="chevRight" />
          </button>
        </>
      )}
    </div>
  );
}
