export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export type FileType = "image" | "video";

export function getFileType(file: File): FileType | null {
  if (SUPPORTED_IMAGE_TYPES.some((type) => file.type === type)) {
    return "image";
  }
  if (SUPPORTED_VIDEO_TYPES.some((type) => file.type === type)) {
    return "video";
  }
  return null;
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  const fileType = getFileType(file);

  if (!fileType) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type || "unknown"}. Please use JPG, PNG, WebP, HEIC for images or MP4, MOV, WebM for video.`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large: ${formatFileSize(file.size)}. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}.`,
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
}
