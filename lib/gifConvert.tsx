import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import posthog from "posthog-js";

export async function ConvertToGif(ffmpeg: FFmpeg, file: File): Promise<File> {
  const outputFileName = `${file.name.replace(/\.[^/.]+$/, "")}.gif`;

  const start = Date.now();

  await ffmpeg.writeFile(file.name, await fetchFile(file));
  await ffmpeg.exec(['-i', file.name, "-vf", "fps=30,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5", "-loop", "0", outputFileName]);
  const raw = await ffmpeg.readFile(outputFileName) as unknown;
  // Ensure BlobPart compatibility: copy into a fresh Uint8Array backed by ArrayBuffer
  const data = new Uint8Array(raw as Uint8Array);

  const timeTaken = Date.now() - start;

  posthog.capture("gifConvert", {
    fileSize: file.size,
    fileType: file.type,
    timeTaken: timeTaken
  });

  return new File([data], outputFileName, { type: "image/gif" });
}