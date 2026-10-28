"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { institutionTone, unitLabel } from "@/components/admin/organogram-tree";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { OrganogramNode } from "@/lib/employees/get-directory";
import {
  ORG_CARD_HEIGHT,
  ORG_CARD_WIDTH,
  organogramLayoutCandidates,
  pickBestFit,
  segmentsToPath,
  type PlacedCard,
  type Viewport,
} from "@/lib/employees/organogram-layout";
import { cn } from "@/lib/utils";

const FRAME_PADDING = 24;
const CONNECTOR_COLOR = "color-mix(in srgb, #0070F3 45%, white)";
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.25;

function clampZoom(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, rounded));
}

function BoardCard({ card }: { card: PlacedCard }) {
  const { node } = card;
  const unit = unitLabel(node.businessUnitName);
  const role = node.jobTitle?.trim() || "Team member";

  const className = cn(
    "absolute flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card px-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
    node.profileHref &&
      "outline-none transition-[border-color,background-color] duration-150 hover:border-[color-mix(in_srgb,var(--accent-blue)_32%,var(--border))] hover:bg-secondary/35 focus-visible:ring-2 focus-visible:ring-[#0070F3]/35",
  );
  const style = {
    left: card.x,
    top: card.y,
    width: ORG_CARD_WIDTH,
    height: ORG_CARD_HEIGHT,
  };
  const body = (
    <>
      <UserAvatar
        name={node.name}
        src={node.avatarUrl}
        gender={node.gender}
        className="size-9 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[13px] leading-5 font-medium tracking-tight"
          title={node.name}
        >
          {node.name}
        </p>
        <p
          className="line-clamp-2 text-xs leading-4 text-muted-foreground"
          title={role}
        >
          {role}
        </p>
        <span
          className={cn(
            "mt-1 block w-fit max-w-full truncate rounded-md px-1.5 text-[10px] leading-4 font-medium",
            institutionTone(unit),
          )}
          title={unit}
        >
          {unit}
        </span>
      </div>
    </>
  );

  if (node.profileHref) {
    return (
      <Link href={node.profileHref} className={className} style={style}>
        {body}
      </Link>
    );
  }

  return (
    <article className={className} style={style}>
      {body}
    </article>
  );
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Viewport | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, size] as const;
}

/** SVG organogram. Scaled to the frame, and scrollable when a line would otherwise sit outside it. */
export function OrganogramBoard({
  roots,
  emptyTitle = "Reporting lines will appear here",
  emptyDescription,
}: {
  roots: OrganogramNode[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [frameRef, frame] = useElementSize<HTMLDivElement>();
  const [zoom, setZoom] = useState(1);
  const anchorRef = useRef<{ x: number; y: number } | null>(null);
  const candidates = useMemo(() => organogramLayoutCandidates(roots), [roots]);

  const fit = frame
    ? pickBestFit(candidates, {
        width: Math.max(frame.width - FRAME_PADDING * 2, 1),
        height: Math.max(frame.height - FRAME_PADDING * 2, 1),
      })
    : null;
  const scale = fit ? fit.scale * zoom : 1;

  const rememberCenter = useCallback(() => {
    const scroller = frameRef.current;
    if (!scroller || scroller.scrollWidth === 0 || scroller.scrollHeight === 0) {
      return;
    }
    anchorRef.current = {
      x: (scroller.scrollLeft + scroller.clientWidth / 2) / scroller.scrollWidth,
      y: (scroller.scrollTop + scroller.clientHeight / 2) / scroller.scrollHeight,
    };
  }, [frameRef]);

  function setZoomTo(next: number) {
    rememberCenter();
    setZoom(clampZoom(next));
  }

  useLayoutEffect(() => {
    const scroller = frameRef.current;
    const anchor = anchorRef.current;
    if (!scroller || !anchor) return;
    anchorRef.current = null;
    scroller.scrollLeft =
      anchor.x * scroller.scrollWidth - scroller.clientWidth / 2;
    scroller.scrollTop =
      anchor.y * scroller.scrollHeight - scroller.clientHeight / 2;
  }, [frameRef, zoom]);

  useEffect(() => {
    const scroller = frameRef.current;
    if (!scroller) return;

    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      rememberCenter();
      setZoom((current) => clampZoom(current * factor));
    };

    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [frameRef, rememberCenter, roots.length]);

  if (roots.length === 0) {
    return (
      <EmptyState
        surface
        kind="org"
        title={emptyTitle}
        description={emptyDescription}
        className="m-4 min-h-0 flex-1 py-10"
      />
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={frameRef} className="absolute inset-0 flex overflow-auto">
      {fit ? (
        <div className="m-auto p-6">
          <div
            className="relative shrink-0 motion-safe:animate-dash-enter"
            style={{
              zoom: scale,
              width: fit.layout.width,
              height: fit.layout.height,
            }}
          >
            <svg
              className="absolute inset-0"
              width={fit.layout.width}
              height={fit.layout.height}
              aria-hidden
            >
              <path
                d={segmentsToPath(fit.layout.segments)}
                fill="none"
                strokeWidth={1.25}
                strokeLinecap="square"
                style={{ stroke: CONNECTOR_COLOR }}
              />
            </svg>
            {fit.layout.cards.map((card) => (
              <BoardCard key={card.node.id} card={card} />
            ))}
          </div>
        </div>
      ) : null}
      </div>
      <div className="absolute right-4 bottom-4 z-20 flex items-center gap-1 rounded-md border border-border bg-card p-1 shadow-[0_1px_2px_rgba(16,24,40,0.06)]">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoomTo(zoom / ZOOM_STEP)}
        >
          <Minus />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-14 px-0 tabular-nums"
          aria-label="Fit chart"
          onClick={() => setZoomTo(1)}
        >
          {Math.round(zoom * 100)}%
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoomTo(zoom * ZOOM_STEP)}
        >
          <Plus />
        </Button>
      </div>
    </div>
  );
}
