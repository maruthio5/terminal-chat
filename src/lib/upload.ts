import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";

export type MediaKind = "image" | "file" | "voice";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function kindForFile(file: File): MediaKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "voice";
  return "file";
}

/**
 * Local-first-friendly upload: reads the file locally (instant preview from the
 * caller), streams to Convex storage, then registers media metadata.
 */
export async function uploadMedia(
  generateUploadUrl: ReturnType<typeof useMutation<typeof api.media.generateUploadUrl>>,
  registerUpload: ReturnType<typeof useMutation<typeof api.media.registerUpload>>,
  file: File,
): Promise<string> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Files are limited to 10 MB");
  }
  const url = await generateUploadUrl();
  const result = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!result.ok) throw new Error("Upload failed — check your connection and retry");
  const { storageId } = (await result.json()) as { storageId: string };
  const mediaId = await registerUpload({
    kind: kindForFile(file),
    name: file.name || "attachment",
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    storageId: storageId as never,
  });
  return mediaId;
}

export async function imageDimensions(
  file: File,
): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith("image/")) return {};
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return {};
  }
}
