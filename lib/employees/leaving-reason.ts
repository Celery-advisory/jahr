/** Short label for why someone left, read from the free-text leaving reason. */
export function leavingReasonLabel(leavingReason?: string | null): string {
  const reason = leavingReason?.toLowerCase() ?? "";
  if (reason.includes("dismiss") || reason.includes("fir")) return "Fired";
  if (reason.includes("resign")) return "Resigned";
  if (reason.includes("contract")) return "Contract ended";
  return "Left";
}
