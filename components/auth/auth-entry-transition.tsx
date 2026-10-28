"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

const MIN_VISIBLE_MS = 450;
const SUCCESS_SETTLE_MS = 200;
const MAX_WAIT_MS = 8000;

type AuthEntryTransitionProps = {
  /** Auth finished successfully: finish the sequence and call onComplete. */
  ready: boolean;
  onComplete: () => void;
};

/**
 * Full-screen post-auth entrance. Stays fully opaque until handoff so the
 * login form never flashes underneath. Navigation unmounts this cover.
 */
export function AuthEntryTransition({
  ready,
  onComplete,
}: AuthEntryTransitionProps) {
  const mountedAt = useRef<number | null>(null);
  const completed = useRef(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!ready || completed.current) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const minVisible = prefersReducedMotion ? 200 : MIN_VISIBLE_MS;
    const settle = prefersReducedMotion ? 0 : SUCCESS_SETTLE_MS;

    const elapsed = Date.now() - (mountedAt.current ?? Date.now());
    const wait = Math.max(settle, minVisible - elapsed);

    const settleTimer = window.setTimeout(() => {
      setSettled(true);
    }, wait);

    const doneTimer = window.setTimeout(() => {
      completed.current = true;
      onComplete();
    }, wait + (prefersReducedMotion ? 0 : 120));

    const safetyTimer = window.setTimeout(() => {
      if (completed.current) return;
      completed.current = true;
      onComplete();
    }, MAX_WAIT_MS);

    return () => {
      window.clearTimeout(settleTimer);
      window.clearTimeout(doneTimer);
      window.clearTimeout(safetyTimer);
    };
  }, [ready, onComplete]);

  const showReady = settled || ready;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#F5F7FB]"
      role="status"
      aria-live="polite"
      aria-busy={!showReady}
    >
      <span className="sr-only">
        {ready ? "Opening your workspace" : "Signing you in"}
      </span>

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 42%, rgba(0,112,243,0.08) 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 50% 80%, rgba(31,35,83,0.04) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-8 px-6 motion-safe:animate-auth-entry-rise">
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden
            className={cn(
              "absolute size-28 rounded-full bg-[#0070F3]/10 blur-2xl",
              "motion-safe:animate-auth-entry-glow",
              showReady && "opacity-40 transition-opacity duration-200",
            )}
          />
          <BrandLogo
            tone="navy"
            align="center"
            priority
            className="relative h-8 w-[180px]"
          />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-lg font-medium tracking-tight text-[#171717]">
            Welcome back
          </p>
          <p className="text-sm text-[#667085]">
            {showReady ? "Ready" : null}
          </p>
        </div>

        <div
          className="relative h-0.5 w-40 overflow-hidden rounded-full bg-[#E3E8EF]"
          aria-hidden
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full bg-[#0070F3]",
              showReady
                ? "w-full transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]"
                : "w-1/3 motion-safe:animate-auth-entry-indeterminate",
            )}
          />
        </div>
      </div>
    </div>
  );
}
