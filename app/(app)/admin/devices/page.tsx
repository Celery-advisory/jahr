import { redirect } from "next/navigation";
import { DevicesOverview } from "@/components/devices/devices-overview";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import {
  getAssignableEmployees,
  getDeviceFormOptions,
  getDevices,
} from "@/lib/devices/get-devices";
import { isOrgAdmin } from "@/lib/types/database";

export default async function DevicesAdminPage() {
  const profile = await getCurrentProfile();

  if (!profile || !isOrgAdmin(profile)) {
    redirect("/dashboard");
  }

  const [devices, employees] = await Promise.all([
    getDevices(),
    getAssignableEmployees(),
  ]);
  const options = await getDeviceFormOptions(devices);

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="space-y-1">
        <h1 className="text-xl font-medium tracking-tight">Devices</h1>
        <p className="text-sm text-muted-foreground">
          Track company hardware from purchase to retirement: who has it,
          where it is, and what it cost.
        </p>
      </div>

      <DevicesOverview devices={devices} employees={employees} options={options} />
    </div>
  );
}
