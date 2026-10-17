import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OverviewMetric {
  label: string;
  value: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  accent: string;
  /** Money and counts use the large figure. Dates and words stay smaller. */
  figure: boolean;
  progress?: number;
}

function wash(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}

export function OverviewMetrics({ items }: { items: OverviewMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.label} href={item.href} className="block h-full">
            <div
              className="flex h-full flex-col gap-3 rounded-xl border border-border p-4 transition-[border-color,background-color] duration-150 hover:border-transparent"
              style={{
                background: `linear-gradient(165deg, ${wash(item.accent, 14)} 0%, #ffffff 58%)`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p
                    className={cn(
                      "font-medium tracking-tight break-words",
                      item.figure
                        ? "text-xl tabular-nums sm:text-2xl"
                        : "text-lg leading-tight",
                    )}
                  >
                    {item.value}
                  </p>
                </div>
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-md"
                  style={{ background: wash(item.accent, 12), color: item.accent }}
                >
                  <Icon className="size-4" />
                </div>
              </div>
              {item.progress !== undefined ? (
                <div className="space-y-1.5">
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress)}
                    aria-label={item.hint}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${item.progress}%`,
                        background: item.accent,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{item.hint}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
