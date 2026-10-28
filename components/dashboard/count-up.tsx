"use client";

import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function CountUp({
  value,
  enabled,
  durationMs = 700,
  className,
}: {
  value: number;
  enabled: boolean;
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(enabled ? 0 : value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Reduced motion jumps straight to the final value on the first frame.
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const duration = prefersReducedMotion ? 0 : durationMs;

    const start = performance.now();
    const from = 0;
    const to = value;

    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const next = from + (to - from) * easeOutCubic(t);
      setDisplay(Math.round(next));
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, enabled, durationMs]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {enabled ? display : value}
    </span>
  );
}

/** Returns a finite number when the KPI string is purely numeric. */
export function parseCountableValue(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}
