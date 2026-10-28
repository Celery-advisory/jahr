import { notFound, redirect } from "next/navigation";
import { DeviceDetail } from "@/components/devices/device-detail";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import {
  getAssignableEmployees,
  getDevice,
  getDeviceFormOptions,
  getDevices,
} from "@/lib/devices/get-devices";
import { isOrgAdmin } from "@/lib/types/database";

export default async function DeviceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getCurrentProfile();

  if (!profile || !isOrgAdmin(profile)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const [device, employees, devices] = await Promise.all([
    getDevice(id),
    getAssignableEmployees(),
    getDevices(),
  ]);

  if (!device) {
    notFound();
  }

  // Suggestions in the edit form come from the whole inventory.
  const options = await getDeviceFormOptions(devices);

  return <DeviceDetail device={device} employees={employees} options={options} />;
}
