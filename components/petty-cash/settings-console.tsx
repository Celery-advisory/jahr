"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Pencil, Shield, Store, Tags, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DASHBOARD_COLORS } from "@/components/dashboard/shared";
import { SettingsCategories } from "@/components/petty-cash/settings-categories";
import { SettingsFunds } from "@/components/petty-cash/settings-funds";
import { SettingsPolicy } from "@/components/petty-cash/settings-policy";
import { SettingsVendors } from "@/components/petty-cash/settings-vendors";
import type { PettyCashBundle } from "@/lib/petty-cash/types";
import { cn } from "@/lib/utils";

function wash(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}

export type SettingsArea = "funds" | "policy" | "categories" | "vendors";

const AREAS: Array<{ id: SettingsArea; label: string }> = [
  { id: "funds", label: "Funds" },
  { id: "policy", label: "Policy" },
  { id: "categories", label: "Categories" },
  { id: "vendors", label: "Vendors" },
];

export function PettyCashSettingsConsole({
  bundle,
  viewerId,
  area: initialArea,
}: {
  bundle: PettyCashBundle;
  viewerId: string;
  area: SettingsArea;
}) {
  const router = useRouter();
  const [area, setArea] = useState(initialArea);
  const [policyEditing, setPolicyEditing] = useState(false);

  useEffect(() => {
    setArea(initialArea);
    if (initialArea !== "policy") setPolicyEditing(false);
  }, [initialArea]);

  function select(next: SettingsArea, editPolicy = false) {
    setArea(next);
    setPolicyEditing(editPolicy);
    const href =
      next === "funds"
        ? "/operations/petty-cash/settings"
        : `/operations/petty-cash/settings?area=${next}`;
    router.replace(href, { scroll: false });
  }

  const activeCategories = bundle.categories.filter(
    (category) => category.parentId && category.isActive,
  ).length;

  const cards: Array<{
    id: SettingsArea;
    label: string;
    value: string;
    action: "Manage" | "Edit";
    figure: boolean;
    editPolicy?: boolean;
    icon: LucideIcon;
    accent: string;
  }> = [
    {
      id: "funds",
      label: "Funds",
      value: String(bundle.funds.length),
      action: "Manage",
      figure: true,
      icon: Wallet,
      accent: DASHBOARD_COLORS.leave,
    },
    {
      id: "categories",
      label: "Categories",
      value: String(activeCategories),
      action: "Manage",
      figure: true,
      icon: Tags,
      accent: DASHBOARD_COLORS.docs,
    },
    {
      id: "vendors",
      label: "Vendors",
      value: String(bundle.vendors.length),
      action: "Manage",
      figure: true,
      icon: Store,
      accent: DASHBOARD_COLORS.people,
    },
    {
      id: "policy",
      label: "Policy",
      value: "Configured",
      action: "Edit",
      figure: false,
      editPolicy: true,
      icon: Shield,
      accent: DASHBOARD_COLORS.devices,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const selected = area === card.id;
          const Icon = card.icon;
          const edit = card.action === "Edit";
          return (
            <button
              key={card.id}
              type="button"
              aria-pressed={selected}
              onClick={() => select(card.id, card.editPolicy)}
              className={cn(
                "flex h-full flex-col gap-3 rounded-xl border p-4 text-left",
                selected ? "border-foreground" : "border-border",
              )}
              style={{
                background: `linear-gradient(165deg, ${wash(card.accent, 14)} 0%, #ffffff 58%)`,
              }}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 space-y-1">
                  <span className="block text-xs text-muted-foreground">{card.label}</span>
                  <span
                    className={cn(
                      "block font-medium tracking-tight",
                      card.figure ? "text-2xl tabular-nums" : "text-lg leading-tight",
                    )}
                  >
                    {card.value}
                  </span>
                </span>
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-md"
                  style={{ background: wash(card.accent, 12), color: card.accent }}
                >
                  <Icon className="size-4" />
                </span>
              </span>
              <span className="group/link inline-flex w-fit items-center gap-1 text-sm font-medium text-[#0B4FBF]">
                {edit ? <Pencil className="size-3.5" /> : null}
                <span className="underline-offset-2 group-hover/link:underline">{card.action}</span>
                {edit ? null : (
                  <ChevronRight className="size-3.5 transition-transform duration-150 group-hover/link:translate-x-0.5" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tablist"
        aria-label="Petty cash settings"
        className="-mx-4 -mb-2 flex gap-1 overflow-x-auto border-b border-border px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {AREAS.map((item) => {
          const selected = area === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => select(item.id)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center border-b-2 px-3 text-sm whitespace-nowrap transition-colors duration-150",
                selected
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {area === "funds" ? (
          <SettingsFunds bundle={bundle} viewerId={viewerId} />
        ) : null}
        {area === "policy" ? (
          <SettingsPolicy
            settings={bundle.settings}
            editing={policyEditing}
            onEditingChange={setPolicyEditing}
          />
        ) : null}
        {area === "categories" ? <SettingsCategories bundle={bundle} /> : null}
        {area === "vendors" ? <SettingsVendors bundle={bundle} /> : null}
      </div>
    </div>
  );
}
