import { supabase } from "@/lib/supabase";

export interface UploadProgressHandler {
  (percent: number): void;
}

/**
 * Uploads a file directly to Supabase Storage via XHR (instead of the
 * supabase-js client) so we can report real upload progress to the UI.
 * Auth is still enforced server-side by the storage RLS policies in
 * supabase/schema.sql — this is just a transport-level detail.
 */
export async function uploadFileWithProgress(
  bucket: "videos" | "thumbnails",
  path: string,
  file: File,
  onProgress?: UploadProgressHandler,
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error("You must be signed in to upload files.");
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anonKey);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "3600");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve();
      } else {
        let message = `Upload failed with status ${xhr.status}`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          message = parsed.message || parsed.error || message;
        } catch {
          // ignore parse errors, use default message
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

export function getPublicUrl(bucket: "videos" | "thumbnails", path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFile(bucket: "videos" | "thumbnails", path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw new Error(error.message);
}

export function buildStoragePath(userId: string, file: File): string {
  const ext = file.name.split(".").pop() || "bin";
  const random = crypto.randomUUID();
  return `${userId}/${random}.${ext}`;
}
