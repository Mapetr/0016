import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { z } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FileData = z.object({
  name: z.string().max(256),
  type: z.string().max(256),
  size: z.number(),
  save: z.boolean()
});

export const Link = z.object({
  url: z.string().url().max(256)
});

export const EXIF_REMOVABLE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export async function removeExifData(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Failed to create blob"));
            return;
          }

          const cleanFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now(),
          });
          resolve(cleanFile);
        },
        file.type,
        0.95
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

export function formatBytes(
  bytes: number,
  decimals: number = 2
): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1000;
  const sizes = [
    'Bytes',
    'KB',
    'MB',
    'GB',
    'TB',
    'PB',
    'EB',
    'ZB',
    'YB'
  ];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = parseFloat(
    (bytes / Math.pow(k, i)).toFixed(decimals)
  );

  return `${value} ${sizes[i]}`;
}