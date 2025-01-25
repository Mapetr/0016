"use client";

import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import CheckboxLabel from "@/app/components/CheckboxLabel";
import { ConvertToGif } from "@/lib/gifConvert";
import { FileData } from "@/lib/utils";

const GIF_CONVERTIBLE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "video/webm", "video/mp4", "video/mpeg"]);

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [messageProgress, setMessageProgress] = useState("");
  const [convertGif, setConvertGif] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ffmpeg = new FFmpeg();

  const load = async () => {
    if (ffmpeg.loaded) return;
    setMessageProgress("Loading");
    ffmpeg.on("log", ({ message }) => {
      console.log(message);
    });
    ffmpeg.on("progress", ({ progress }) => {
      setUploadProgress(progress * 100);
    });

    if (crossOriginIsolated) {
      await ffmpeg.load({
        coreURL: await toBlobURL(`/ffmpeg-mt/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`/ffmpeg-mt/ffmpeg-core.wasm`, "application/wasm"),
        workerURL: await toBlobURL(`/ffmpeg-mt/ffmpeg-core.worker.js`, "text/javascript")
      });
    } else {
      await ffmpeg.load({
        coreURL: await toBlobURL(`/ffmpeg-st/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`/ffmpeg-st/ffmpeg-core.wasm`, "application/wasm")
      });
    }
    setMessageProgress("");
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add("border-blue-500");
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("border-blue-500");
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("border-blue-500");
    const file = e.dataTransfer.files[0];
    setSelectedFile(file);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (selectedFile) {
      setUploadedUrl("");

      let file: File;
      if (convertGif) {
        await load();
        setMessageProgress("Converting");
        file = await ConvertToGif(ffmpeg, selectedFile);
      } else {
        file = selectedFile;
      }

      setMessageProgress("Uploading");

      const fileData = FileData.parse({
        name: file.name,
        type: file.type,
        size: file.size
      });

      const uploadUrl = await fetch("/api/upload", {
        method: "POST",
        body: JSON.stringify(fileData)
      }).then(async res => {
        if (!res.ok) {
          console.error(await res.json());
          return "";
        }
        return (await res.json()).url as string;
      });

      if (uploadUrl === "") {
        setMessageProgress("Errored");
        setUploadProgress(0);
        return;
      }

      const req = new XMLHttpRequest();
      req.open("PUT", uploadUrl);
      req.setRequestHeader("Content-Type", fileData.type);
      req.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;

        setUploadProgress((event.loaded / event.total) * 100);
      };
      req.onreadystatechange = () => {
        if (req.readyState === XMLHttpRequest.DONE) {
          const data = JSON.parse(req.responseText);
          setUploadedUrl(data.url);
          setUploadProgress(0);
          setMessageProgress("");
        }
      };
      req.onload = () => {
        setUploadProgress(0);
        if (req.status !== 200) {
          setMessageProgress("Failed to upload");
          return;
        }
        setMessageProgress("");
        const url = new URL(uploadUrl);
        setUploadedUrl(`${process.env.NEXT_PUBLIC_DESTINATION_URL}${url.pathname}`);
      }
      req.send(file);
    }
  };

  return (
    <main>
      <div className={"flex justify-center items-center mx-8 min-h-screen"}>
        <div
          className={"flex flex-col gap-8 rounded-xl border bg-card text-card-foreground text-center shadow-sm w-[40em] p-8 md:mx-auto"}>
          <span className={"font-semibold leading-none tracking-tight"}>File uploader</span>
          <div
            className={"border-2 border-dashed border-gray-400 rounded-lg p-4 text-center cursor-pointer"}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileSelect}
          >
            <input
              type={"file"}
              ref={fileInputRef}
              className={"hidden"}
              onChange={handleFileChange} />
            {selectedFile ? (
              <p className={"text-gray-600"}>{selectedFile.name}</p>
            ) : (
              <p className={"text-gray-600"}>Drag and drop a file here or click to select a file</p>
            )}
          </div>
          {uploadedUrl && <span className={"select-all"}>{uploadedUrl}</span>}
          {uploadProgress !== 0 && <Progress className={"transition-all duration-150"} value={uploadProgress} />}
          {messageProgress !== "" && <span>{messageProgress}</span>}
          <CheckboxLabel text={"Convert to GIF"} setChecked={setConvertGif}
                         disabled={!GIF_CONVERTIBLE_TYPES.has(selectedFile?.type ?? "")} />
          <Button onClick={handleUpload}>
            Upload
          </Button>
          <span className={"text-secondary-foreground text-sm"}>Max 250MB file size</span>
        </div>
      </div>
    </main>
  );
}
