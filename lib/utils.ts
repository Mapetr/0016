import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { z } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FileData = z.object({
  name: z.string().max(256),
  type: z.string().max(256),
  size: z.number()
});

export const Link = z.object({
  url: z.string().url().max(256)
})
