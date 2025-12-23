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