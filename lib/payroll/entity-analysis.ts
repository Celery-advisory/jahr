import { normaliseCurrency, resolveFxConversion } from "@/lib/fx/convert";
import type { FxRateTable } from "@/lib/fx/types";
import { DEFAULT_PAY_CURRENCY } from "@/lib/payroll/currencies";
import { roundMoney, toMonthlyAmount } from "@/lib/payroll/totals";
import type { PayFrequency, PayrollEmployeeSummary } from "@/lib/payroll/types";

export const UNASSIGNED_ENTITY_KEY = "unassigned";
export const UNASSIGNED_ENTITY_LABEL = "Unassigned";

const MONTHS_PER_YEAR = 12;

/** Payroll in one currency, before any conversion. */
export interface PayrollMoneyBucket {
  currency: string;
  monthlyGross: number;
  monthlyNet: number;
  monthlyEmployerCost: number;
  headcount: number;
}

/** The same payroll expressed in the reporting currency. */
export interface PayrollConvertedTotals {
  currency: string;
  monthlyGross: number;
  monthlyNet: number;
  monthlyEmployerCost: number;
}

export interface PayrollEntityBreakdown {
  key: string;
  label: string;
  headcount: number;
  /** Share of converted employer cost. Sums to 100 across priced entities. */
  costSharePercent: number;
  native: PayrollMoneyBucket[];
  converted: PayrollConvertedTotals;
}

/**
 * People kept out of the entity breakdown because they have no paying entity
 * or no pay package. Counting them at zero would understate everyone's share.
 */
export interface PayrollNeedsSetup {
  count: number;
  missingEntity: number;
  missingPackage: number;
  /** Converted monthly cost these people carry but no entity is charged for. */
  unallocatedMonthlyCost: number;
}

export interface PayrollAnalysis {
  reportingCurrency: string;
  totalHeadcount: number;
  withPackage: number;
  entitiesPaying: number;
  needsSetup: PayrollNeedsSetup;
  native: PayrollMoneyBucket[];
  converted: PayrollConvertedTotals;
  byEntity: PayrollEntityBreakdown[];
  /** Currencies on payroll with no rate into the reporting currency. */
  unconvertedCurrencies: string[];
}

export interface PayrollAnalysisOptions {
  reportingCurrency: string;
  rates: FxRateTable;
}

interface MonthlyFigures {
  gross: number;
  net: number;
  employerCost: number;
}

interface MutableEntity {
  label: string;
  headcount: number;
  buckets: Map<string, PayrollMoneyBucket>;
}

function emptyBucket(currency: string): PayrollMoneyBucket {
  return {
    currency,
    monthlyGross: 0,
    monthlyNet: 0,
    monthlyEmployerCost: 0,
    headcount: 0,
  };
}

function bucketFor(
  buckets: Map<string, PayrollMoneyBucket>,
  currency: string,
): PayrollMoneyBucket {
  const existing = buckets.get(currency);
  if (existing) return existing;

  const created = emptyBucket(currency);
  buckets.set(currency, created);
  return created;
}

function addMoney(bucket: PayrollMoneyBucket, monthly: MonthlyFigures): void {
  bucket.monthlyGross = roundMoney(bucket.monthlyGross + monthly.gross);
  bucket.monthlyNet = roundMoney(bucket.monthlyNet + monthly.net);
  bucket.monthlyEmployerCost = roundMoney(
    bucket.monthlyEmployerCost + monthly.employerCost,
  );
  bucket.headcount += 1;
}

function sortBuckets(buckets: Iterable<PayrollMoneyBucket>) {
  return [...buckets].sort(
    (a, b) =>
      b.monthlyEmployerCost - a.monthlyEmployerCost ||
      a.currency.localeCompare(b.currency),
  );
}

function monthlyFigures(
  employee: PayrollEmployeeSummary,
): MonthlyFigures | null {
  const frequency: PayFrequency = employee.pay_frequency ?? "monthly";
  const grossSource = employee.gross_pay ?? employee.salary;

  if (grossSource === null || grossSource === undefined) {
    return null;
  }

  const deductions = employee.total_deductions ?? 0;
  const employer = employee.employer_contributions ?? 0;

  return {
    gross: toMonthlyAmount(grossSource, frequency),
    net: toMonthlyAmount(grossSource - deductions, frequency),
    employerCost: toMonthlyAmount(grossSource + employer, frequency),
  };
}

/**
 * Monthly gross converted to `currency`, for comparing people paid in
 * different currencies. Null when there is no pay or no rate for the pair.
 */
export function monthlyGrossIn(
  employee: PayrollEmployeeSummary,
  currency: string,
  rates: FxRateTable,
): number | null {
  const figures = monthlyFigures(employee);
  if (!figures) return null;
  const from = normaliseCurrency(employee.currency) || DEFAULT_PAY_CURRENCY;
  const conversion = resolveFxConversion(from, currency, rates);
  return conversion ? figures.gross * conversion.rate : null;
}

/**
 * Someone who cannot be charged to an entity yet. They are kept out of the
 * cost breakdown so they never read as an entity costing nothing.
 */
export function needsPayrollSetup(employee: PayrollEmployeeSummary): boolean {
  return !employee.legal_entity_paying?.trim() || !employee.has_package;
}

/**
 * Whole percentages that always add up to 100, using the largest remainder
 * method so rounding never leaves the table at 99% or 101%.
 */
function allocateShares(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return values.map(() => 0);

  const exact = values.map((value) => (value / total) * 100);
  const shares = exact.map(Math.floor);
  let remaining = 100 - shares.reduce((sum, value) => sum + value, 0);

  const byLargestRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (const entry of byLargestRemainder) {
    if (remaining <= 0) break;
    shares[entry.index] += 1;
    remaining -= 1;
  }

  return shares;
}

export function buildPayrollAnalysis(
  employees: PayrollEmployeeSummary[],
  { reportingCurrency, rates }: PayrollAnalysisOptions,
): PayrollAnalysis {
  const entities = new Map<string, MutableEntity>();
  const orgBuckets = new Map<string, PayrollMoneyBucket>();
  const unallocatedBuckets = new Map<string, PayrollMoneyBucket>();

  let missingEntity = 0;
  let missingPackage = 0;
  let withPackage = 0;
  let needsSetupCount = 0;

  for (const employee of employees) {
    const entityName = employee.legal_entity_paying?.trim() ?? "";
    const priced = !needsPayrollSetup(employee);

    if (entityName.length === 0) missingEntity += 1;
    if (employee.has_package) withPackage += 1;
    else missingPackage += 1;
    if (!priced) needsSetupCount += 1;

    const monthly = monthlyFigures(employee);
    if (!monthly) continue;

    const currency =
      normaliseCurrency(employee.currency) || DEFAULT_PAY_CURRENCY;
    addMoney(bucketFor(orgBuckets, currency), monthly);

    if (!priced) {
      addMoney(bucketFor(unallocatedBuckets, currency), monthly);
      continue;
    }

    const entity = entities.get(entityName) ?? {
      label: entityName,
      headcount: 0,
      buckets: new Map<string, PayrollMoneyBucket>(),
    };
    entity.headcount += 1;
    addMoney(bucketFor(entity.buckets, currency), monthly);
    entities.set(entityName, entity);
  }

  const unconverted = new Set<string>();

  const convertBuckets = (
    buckets: Iterable<PayrollMoneyBucket>,
  ): PayrollConvertedTotals => {
    let monthlyGross = 0;
    let monthlyNet = 0;
    let monthlyEmployerCost = 0;

    for (const bucket of buckets) {
      const conversion = resolveFxConversion(
        bucket.currency,
        reportingCurrency,
        rates,
      );

      if (!conversion) {
        unconverted.add(bucket.currency);
        continue;
      }

      monthlyGross += bucket.monthlyGross * conversion.rate;
      monthlyNet += bucket.monthlyNet * conversion.rate;
      monthlyEmployerCost += bucket.monthlyEmployerCost * conversion.rate;
    }

    return {
      currency: reportingCurrency,
      monthlyGross: roundMoney(monthlyGross),
      monthlyNet: roundMoney(monthlyNet),
      monthlyEmployerCost: roundMoney(monthlyEmployerCost),
    };
  };

  const ranked = [...entities.entries()]
    .map(([key, entity]) => ({
      key,
      label: entity.label,
      headcount: entity.headcount,
      native: sortBuckets(entity.buckets.values()),
      converted: convertBuckets(entity.buckets.values()),
    }))
    .sort(
      (a, b) =>
        b.converted.monthlyEmployerCost - a.converted.monthlyEmployerCost ||
        a.label.localeCompare(b.label),
    );

  const shares = allocateShares(
    ranked.map((entity) => entity.converted.monthlyEmployerCost),
  );

  return {
    reportingCurrency,
    totalHeadcount: employees.length,
    withPackage,
    entitiesPaying: ranked.length,
    needsSetup: {
      count: needsSetupCount,
      missingEntity,
      missingPackage,
      unallocatedMonthlyCost: convertBuckets(unallocatedBuckets.values())
        .monthlyEmployerCost,
    },
    native: sortBuckets(orgBuckets.values()),
    converted: convertBuckets(orgBuckets.values()),
    byEntity: ranked.map((entity, index) => ({
      ...entity,
      costSharePercent: shares[index],
    })),
    unconvertedCurrencies: [...unconverted].sort(),
  };
}

function formatAmount(
  value: number,
  currency: string,
  fractionDigits: number,
): string {
  const formatted = value.toLocaleString("en-GH", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return `${currency} ${formatted}`;
}

/** Rounded to whole units, for headline figures. */
export function formatPayrollMoney(value: number, currency: string): string {
  return formatAmount(value, currency, 0);
}

/** Full precision, for reconciling native amounts against the ledger. */
export function formatPayrollMoneyExact(
  value: number,
  currency: string,
): string {
  return formatAmount(value, currency, 2);
}

export function formatPayrollMoneyList(
  amounts: PayrollMoneyBucket[],
  field: keyof Omit<PayrollMoneyBucket, "currency" | "headcount">,
): string {
  if (amounts.length === 0) return "-";
  return amounts
    .map((bucket) => formatPayrollMoney(bucket[field], bucket.currency))
    .join(" · ");
}

export function annualize(value: number): number {
  return roundMoney(value * MONTHS_PER_YEAR);
}

export function annualizeAmounts(
  amounts: PayrollMoneyBucket[],
): PayrollMoneyBucket[] {
  return amounts.map((bucket) => ({
    ...bucket,
    monthlyGross: annualize(bucket.monthlyGross),
    monthlyNet: annualize(bucket.monthlyNet),
    monthlyEmployerCost: annualize(bucket.monthlyEmployerCost),
  }));
}

export function payFrequencyLabel(frequency: PayFrequency | null): string {
  if (frequency === "weekly") return "Weekly";
  if (frequency === "annually") return "Annually";
  return "Monthly";
}
