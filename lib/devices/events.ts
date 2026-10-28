import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEVICE_CONDITION_LABELS,
  type DeviceCondition,
  type DeviceEventKind,
} from "@/lib/devices/types";

/**
 * Server-only helpers shared by device actions and employee offboarding.
 * Kept out of the "use server" actions file so they are not exposed as
 * callable server actions.
 */

export async function logDeviceEvent(
  supabase: SupabaseClient,
  input: {
    deviceId: string;
    kind: DeviceEventKind;
    summary: string;
    details?: string | null;
    actorId: string;
  },
): Promise<void> {
  const { error } = await supabase.from("device_events").insert({
    device_id: input.deviceId,
    kind: input.kind,
    summary: input.summary,
    details: input.details?.trim() || null,
    actor_id: input.actorId,
  });
  // The timeline is supplementary; never fail the main action over it.
  if (error) console.error("[logDeviceEvent]", error.message);
}

export type OffboardingDeviceOutcome = "returned" | "lost" | "outstanding";

export interface OffboardingDeviceDecision {
  deviceId: string;
  outcome: OffboardingDeviceOutcome;
  condition?: DeviceCondition | null;
}

/**
 * Closes or flags an employee's open device assignments as part of
 * offboarding. Returned devices go back to stock; lost ones are retired;
 * outstanding ones stay assigned so they show as "with former staff".
 */
export async function settleDevicesForOffboarding(
  supabase: SupabaseClient,
  input: {
    employeeId: string;
    employeeName: string;
    actorId: string;
    decisions: OffboardingDeviceDecision[];
  },
): Promise<{ error?: string }> {
  const { data: open, error } = await supabase
    .from("device_assignments")
    .select("id, device_id")
    .eq("employee_id", input.employeeId)
    .is("returned_at", null);

  if (error) return { error: error.message };

  const decisions = new Map(
    input.decisions.map((decision) => [decision.deviceId, decision]),
  );

  for (const assignment of open ?? []) {
    const decision = decisions.get(assignment.device_id);
    if (!decision) {
      return { error: "Choose what happens to every device they hold." };
    }

    if (decision.outcome === "outstanding") {
      await logDeviceEvent(supabase, {
        deviceId: assignment.device_id,
        kind: "offboarding",
        summary: `${input.employeeName} left without returning this device`,
        actorId: input.actorId,
      });
      continue;
    }

    const condition = decision.outcome === "returned" ? decision.condition ?? null : null;
    const { error: returnError } = await supabase
      .from("device_assignments")
      .update({
        returned_at: new Date().toISOString(),
        condition_in: condition,
      })
      .eq("id", assignment.id);
    if (returnError) return { error: returnError.message };

    if (decision.outcome === "lost") {
      const { error: retireError } = await supabase
        .from("devices")
        .update({ status: "retired" })
        .eq("id", assignment.device_id);
      if (retireError) return { error: retireError.message };

      await logDeviceEvent(supabase, {
        deviceId: assignment.device_id,
        kind: "offboarding",
        summary: `Written off: not recovered from ${input.employeeName}`,
        actorId: input.actorId,
      });
      continue;
    }

    if (condition) {
      await supabase
        .from("devices")
        .update({ condition })
        .eq("id", assignment.device_id);
    }
    await logDeviceEvent(supabase, {
      deviceId: assignment.device_id,
      kind: "returned",
      summary: `Returned by ${input.employeeName} at offboarding`,
      details: condition ? `Condition: ${DEVICE_CONDITION_LABELS[condition]}` : null,
      actorId: input.actorId,
    });
  }

  return {};
}
