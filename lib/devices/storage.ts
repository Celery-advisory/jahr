import type { SupabaseClient } from "@supabase/supabase-js";

export const DEVICES_BUCKET = "devices";

export const MAX_DEVICE_FILE_BYTES = 10 * 1024 * 1024;

export const DEVICE_FILE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop()?.trim() || "file";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export async function uploadDeviceFileObject(
  supabase: SupabaseClient,
  input: { deviceId: string; file: File },
): Promise<{ storageKey: string }> {
  const storageKey = `${input.deviceId}/${crypto.randomUUID()}-${sanitizeFileName(input.file.name)}`;
  const { error } = await supabase.storage
    .from(DEVICES_BUCKET)
    .upload(storageKey, input.file, {
      contentType: input.file.type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return { storageKey };
}
