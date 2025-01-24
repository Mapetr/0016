import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

export async function ConvertToGif(ffmpeg: FFmpeg, file: File): Promise<File> {
  const outputFileName = `${file.name.replace(/\.[^/.]+$/, "")}.gif`;

  await ffmpeg.writeFile(file.name, await fetchFile(file));
  await ffmpeg.exec(['-i', file.name, "-vf", "fps=30,scale=320:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5", "-loop", "0", outputFileName]);
  const data = (await ffmpeg.readFile(outputFileName));

  return new File([data], outputFileName, {type: "image/gif"});
}