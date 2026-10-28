import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { DEVICES_BUCKET } from "@/lib/devices/storage";
import { isOrgAdmin } from "@/lib/types/database";
import { createClient } from "@/utils/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await getCurrentProfile();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!isOrgAdmin(viewer)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: record, error } = await supabase
    .from("device_files")
    .select("file_name, file_type, storage_key")
    .eq("id", id)
    .maybeSingle();

  if (error || !record) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(DEVICES_BUCKET)
    .download(record.storage_key);

  if (downloadError || !file) {
    return NextResponse.json({ error: "Could not open this file." }, { status: 502 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = String(record.file_name).replaceAll('"', "");

  return new NextResponse(file, {
    headers: {
      "Content-Type": record.file_type || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
