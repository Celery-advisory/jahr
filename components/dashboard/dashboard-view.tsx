"use client";

import {
  useEffect,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import { parseISO } from "date-fns";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  Gift,
  Laptop,
  Megaphone,
  PartyPopper,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MessageContent } from "@/components/communications/message-content";
import {
  CountUp,
  parseCountableValue,
} from "@/components/dashboard/count-up";
import {
  DASHBOARD_COLORS,
  type DashboardAnnouncement,
  type DashboardBirthday,
  type DashboardHoliday,
  type DashboardKpi,
  type DashboardLeaveItem,
  type DashboardTeamMember,
} from "@/components/dashboard/shared";
import { usePostLoginEntrance } from "@/components/dashboard/use-post-login-entrance";
import {
  formatLeaveDateRange,
  workingHoursFromDays,
} from "@/lib/leave/working-days";
import { cn } from "@/lib/utils";

const LEAVE = DASHBOARD_COLORS.leave;
const PAYROLL = DASHBOARD_COLORS.payroll;
const DOCS = DASHBOARD_COLORS.docs;
const PEOPLE = DASHBOARD_COLORS.people;
const DEVICES = DASHBOARD_COLORS.devices;
const BLUE = DASHBOARD_COLORS.blue;
const COMMS = DOCS;

function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}

function KpiIcon({
  name,
  accent,
}: {
  name: DashboardKpi["icon"];
  accent: string;
}) {
  const icons: Record<DashboardKpi["icon"], ComponentType<{ className?: string }>> = {
    leave: CalendarDays,
    people: Users,
    docs: FileText,
    payroll: Wallet,
    devices: Laptop,
    approvals: CalendarDays,
  };
  const Icon = icons[name];
  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center rounded-md"
      style={{ background: tint(accent, 12), color: accent }}
    >
      <Icon className="size-4" />
    </div>
  );
}

function Enter({
  active,
  delayMs = 0,
  className,
  children,
}: {
  active: boolean;
  delayMs?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(active && "motion-safe:animate-dash-enter", className)}
      style={
        active
          ? ({
              animationDelay: `${delayMs}ms`,
            } satisfies CSSProperties)
          : undefined
      }
    >
      {children}
    </div>
  );
}

function Section({
  title,
  description,
  action,
  children,
  icon: Icon,
  accent,
  enter,
  delayMs = 0,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  accent?: string;
  enter?: boolean;
  delayMs?: number;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card",
        enter && "motion-safe:animate-dash-enter",
      )}
      style={
        enter
          ? ({ animationDelay: `${delayMs}ms` } satisfies CSSProperties)
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon && accent ? (
            <div
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md"
              style={{ background: tint(accent, 10), color: accent }}
            >
              <Icon className="size-4" />
            </div>
          ) : null}
          <div className="min-w-0 space-y-0.5">
            <h2 className="text-sm font-medium">{title}</h2>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function QuickLink({
  href,
  label,
  accent,
  icon: Icon,
}: {
  href: string;
  label: string;
  accent: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 transition-colors hover:bg-secondary/40"
    >
      <div
        className="flex size-9 items-center justify-center rounded-md transition-transform duration-150 group-hover:scale-[1.03]"
        style={{ background: tint(accent, 12), color: accent }}
      >
        <Icon className="size-4" />
      </div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

export function DashboardView({
  greeting,
  firstName,
  subtitle,
  kpis,
  leaveUsed,
  leavePending,
  upcomingLeave,
  announcements,
  team,
  birthdays,
  holidays,
  canApprove,
  isAdmin,
}: {
  greeting: string;
  firstName: string;
  subtitle: string;
  kpis: DashboardKpi[];
  leaveUsed: number;
  leavePending: number;
  upcomingLeave: DashboardLeaveItem[];
  announcements: DashboardAnnouncement[];
  team: DashboardTeamMember[];
  birthdays: DashboardBirthday[];
  holidays: DashboardHoliday[];
  canApprove: boolean;
  isAdmin: boolean;
}) {
  const enter = usePostLoginEntrance();
  // On the post-login entrance, meters start empty and fill a beat later.
  const [metersReady, setMetersReady] = useState(false);
  const metersOn = !enter || metersReady;

  useEffect(() => {
    if (!enter) return;
    const timer = window.setTimeout(() => setMetersReady(true), 40);
    return () => window.clearTimeout(timer);
  }, [enter]);

  return (
    <div className="flex w-full flex-col gap-5">
      <Enter active={enter} delayMs={0}>
        <div
          className="relative overflow-hidden rounded-xl border border-border px-5 py-5 sm:px-6"
          style={{
            background: `linear-gradient(135deg, ${tint(BLUE, 8)} 0%, #ffffff 55%, ${tint(LEAVE, 6)} 100%)`,
          }}
        >
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium tracking-wide text-[#0B4FBF] uppercase">
                Dashboard
              </p>
              <h1 className="text-xl font-medium tracking-tight sm:text-2xl">
                {greeting}, {firstName}
              </h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/leave"
                className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
              >
                <CalendarDays className="size-3.5" />
                Request leave
              </Link>
              {canApprove ? (
                <Link
                  href="/approvals"
                  className={cn(
                    buttonVariants({ size: "sm", variant: "outline" }),
                    "gap-1.5 border-transparent bg-white/80",
                  )}
                >
                  Review requests
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </Enter>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, index) => {
          const countable = parseCountableValue(kpi.value);
          const inner = (
            <div
              className={cn(
                "flex h-full flex-col gap-3 rounded-xl border border-border p-4 transition-[border-color,background-color] duration-150 hover:border-transparent",
                enter && "motion-safe:animate-dash-enter",
              )}
              style={
                {
                  background: `linear-gradient(165deg, ${tint(kpi.accent, 14)} 0%, #ffffff 58%)`,
                  ...(enter
                    ? { animationDelay: `${80 + index * 70}ms` }
                    : {}),
                } satisfies CSSProperties
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p
                    className={cn(
                      "font-medium tracking-tight",
                      countable !== null
                        ? "text-2xl tabular-nums"
                        : "text-lg leading-tight",
                    )}
                  >
                    {countable !== null ? (
                      <CountUp value={countable} enabled={enter} />
                    ) : (
                      kpi.value
                    )}
                  </p>
                </div>
                <KpiIcon name={kpi.icon} accent={kpi.accent} />
              </div>
              {kpi.progress !== undefined ? (
                <div className="space-y-1.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-[width] duration-700 ease-dash"
                      style={{
                        width: `${metersOn ? kpi.progress : 0}%`,
                        background: kpi.accent,
                        transitionDelay: enter ? `${120 + index * 70}ms` : "0ms",
                      }}
                    />
                  </div>
                  {kpi.hint ? (
                    <p className="text-[11px] text-muted-foreground">{kpi.hint}</p>
                  ) : null}
                </div>
              ) : kpi.hint ? (
                <p className="text-xs text-muted-foreground">{kpi.hint}</p>
              ) : null}
            </div>
          );

          if (kpi.href) {
            return (
              <Link key={kpi.label} href={kpi.href} className="block h-full">
                {inner}
              </Link>
            );
          }

          return (
            <div key={kpi.label} className="h-full">
              {inner}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Section
            title="Announcements"
            description="Latest announcement."
            icon={Megaphone}
            accent={COMMS}
            enter={enter}
            delayMs={300}
            action={
              <Link
                href="/announcements"
                className="text-xs font-medium text-[#0B4FBF] hover:underline"
              >
                View all
              </Link>
            }
          >
            {announcements.length === 0 ? (
              <EmptyState
                size="compact"
                kind="announcements"
                title="No announcements yet"
                className="px-0 py-2"
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {announcements.slice(0, 1).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/announcements/${item.id}`}
                      className="block rounded-md border border-border px-3 py-3 transition-colors hover:bg-white/70"
                      style={{ background: tint(COMMS, 7) }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium tracking-[0.08em] text-[#174EA6] uppercase">
                            {item.typeLabel}
                          </p>
                          <p className="mt-0.5 text-sm font-medium">
                            {item.title}
                          </p>
                        </div>
                        <p className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                          {item.publishedAtLabel}
                        </p>
                      </div>
                      <div className="mt-1.5">
                        <MessageContent
                          content={item.bodyJson}
                          fallbackPlainText={item.body}
                          clamp
                          staticLinks
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Your leave"
            description="Annual leave taken this year."
            icon={CalendarDays}
            accent={LEAVE}
            enter={enter}
            delayMs={320}
            action={
              <Link
                href="/leave"
                className="text-xs font-medium text-[#0B4FBF] hover:underline"
              >
                Open leave
              </Link>
            }
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="mx-auto flex size-28 shrink-0 flex-col items-center justify-center rounded-full border border-border sm:mx-0">
                <span className="text-2xl font-medium tracking-tight tabular-nums">
                  <CountUp value={leaveUsed} enabled={enter} />
                </span>
                <span className="text-[11px] text-muted-foreground">
                  days used
                </span>
              </div>
              <div className="grid flex-1 gap-3 sm:grid-cols-2">
                <div
                  className="rounded-md border border-border px-3 py-2.5"
                  style={{ background: tint(LEAVE, 8) }}
                >
                  <p className="text-xs text-muted-foreground">Approved</p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums">
                    <CountUp value={leaveUsed} enabled={enter} /> days
                  </p>
                </div>
                <div
                  className="rounded-md border border-border px-3 py-2.5"
                  style={{ background: tint(PEOPLE, 10) }}
                >
                  <p className="text-xs text-muted-foreground">Pending</p>
                  <p className="mt-0.5 text-sm font-medium tabular-nums">
                    <CountUp value={leavePending} enabled={enter} /> days
                  </p>
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Upcoming leave"
            description="Upcoming approved and pending leave."
            icon={PartyPopper}
            accent={LEAVE}
            enter={enter}
            delayMs={400}
          >
            {upcomingLeave.length === 0 ? (
              <EmptyState
                size="compact"
                kind="leave"
                title="Nothing booked ahead"
                className="px-0 py-2"
                action={
                  <Link
                    href="/leave"
                    className="text-sm font-medium text-[#0B4FBF] hover:underline"
                  >
                    Plan time off
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {upcomingLeave.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5"
                    style={{
                      background: tint(
                        item.status === "approved" ? LEAVE : PEOPLE,
                        7,
                      ),
                    }}
                  >
                    <UserAvatar
                      name={item.name}
                      src={item.avatarUrl}
                      gender={item.gender}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.isSelf ? "You" : item.name}
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {item.typeLabel}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatLeaveDateRange(
                          parseISO(item.startDate),
                          parseISO(item.endDate),
                        )}{" "}
                        · {item.workingDays}d /{" "}
                        {workingHoursFromDays(item.workingDays)}h
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md font-normal",
                        item.status === "approved"
                          ? "border-transparent bg-success/10 text-success"
                          : "border-transparent bg-amber-500/10 text-amber-700",
                      )}
                    >
                      {item.status === "approved" ? "Approved" : "Pending"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {team.length > 0 ? (
            <Section
              title="Team annual leave"
              description="Days taken this year on your team."
              icon={Users}
              accent={PEOPLE}
              enter={enter}
              delayMs={480}
              action={
                canApprove ? (
                  <Link
                    href="/approvals"
                    className="text-xs font-medium text-[#0B4FBF] hover:underline"
                  >
                    Approvals
                  </Link>
                ) : null
              }
            >
              <div className="grid gap-2 sm:grid-cols-2">
                {team.map((person) => (
                    <Link
                      key={person.id}
                      href={`/admin/employees/${person.id}`}
                      className="rounded-md border border-border px-3 py-3 transition-colors hover:border-transparent"
                      style={{ background: tint(PEOPLE, 7) }}
                    >
                      <div className="flex items-center gap-2.5">
                        <UserAvatar
                          name={person.name}
                          src={person.avatarUrl}
                          gender={person.gender}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {person.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {person.jobTitle ?? "Team member"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums">
                            <CountUp value={person.used} enabled={enter} />
                            <span className="text-xs font-normal text-muted-foreground">
                              {" "}
                              used
                            </span>
                          </p>
                          {person.pending > 0 ? (
                            <p className="text-[11px] text-muted-foreground tabular-nums">
                              {person.pending} pending
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                ))}
              </div>
            </Section>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <Section
            title="Quick links"
            icon={ArrowRight}
            accent={BLUE}
            enter={enter}
            delayMs={360}
          >
            <div className="grid gap-2">
              <QuickLink
                href="/leave"
                label="Leave"
                accent={LEAVE}
                icon={CalendarDays}
              />
              <QuickLink
                href="/documents"
                label="Documents"
                accent={DOCS}
                icon={FileText}
              />
              {canApprove ? (
                <QuickLink
                  href="/approvals"
                  label="Approve leave"
                  accent={PEOPLE}
                  icon={Users}
                />
              ) : null}
              {isAdmin ? (
                <>
                  <QuickLink
                    href="/admin/employees"
                    label="Employees"
                    accent={PEOPLE}
                    icon={Users}
                  />
                  <QuickLink
                    href="/admin/payroll"
                    label="Payroll"
                    accent={PAYROLL}
                    icon={Wallet}
                  />
                  <QuickLink
                    href="/admin/devices"
                    label="Devices"
                    accent={DEVICES}
                    icon={Laptop}
                  />
                </>
              ) : null}
              <QuickLink
                href="/settings"
                label="Settings"
                accent={BLUE}
                icon={Settings}
              />
            </div>
          </Section>

          <Section
            title="Coming up"
            description="Public holidays and birthdays this month."
            icon={Gift}
            accent={PAYROLL}
            enter={enter}
            delayMs={440}
          >
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Holidays
                </p>
                {holidays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No upcoming holidays on file.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {holidays.map((holiday) => (
                      <li
                        key={`${holiday.name}-${holiday.dateLabel}`}
                        className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                        style={{ background: tint(PAYROLL, 8) }}
                      >
                        <span className="font-medium">{holiday.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {holiday.dateLabel}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Birthdays this month
                </p>
                {birthdays.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    None in your circle this month.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {birthdays.map((person) => (
                      <li
                        key={person.id}
                        className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2"
                        style={{ background: tint(PEOPLE, 10) }}
                      >
                        <UserAvatar
                          name={person.name}
                          src={person.avatarUrl}
                          gender={person.gender}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {person.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {person.dateLabel}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
