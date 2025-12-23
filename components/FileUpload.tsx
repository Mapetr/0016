import { useEffect, useRef, useState } from "react";
import CheckboxLabel from "./CheckboxLabel";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { FileData, formatBytes } from "@/lib/utils";
import { ConvertToGif } from "@/lib/gifConvert";
import { toast } from "sonner";
import { useAuth } from "@clerk/nextjs";
import { useAction, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";

const GIF_CONVERTIBLE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "video/webm", "video/mp4", "video/mpeg"]);

export function FileUpload() {
  const { isAuthenticated } = useConvexAuth();
  const getUploadUrl = useAction(api.files.getUploadUrl);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [messageProgress, setMessageProgress] = useState("");

  const [convertGif, setConvertGif] = useState(false);
  const [saveToAccount, setSaveToAccount] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaveToAccount(isAuthenticated);
  }, [isAuthenticated]);

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
    e.currentTarget.classList.remove("border-gray-400");
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("border-blue-500");
    e.currentTarget.classList.add("border-gray-400");
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("border-blue-500");
    e.currentTarget.classList.add("border-gray-400");
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
        size: file.size,
        save: saveToAccount && isAuthenticated
      });

      const { url: uploadUrl } = await getUploadUrl(fileData).catch(e => {
        console.error(e);
        return { url: "" };
      });

      if (uploadUrl === "") {
        setMessageProgress("Errored");
        setUploadProgress(0);
        return;
      }

      if (process.env.NEXT_PUBLIC_UPLOAD_FILE != "false") {
        const req = new XMLHttpRequest();
        req.open("PUT", uploadUrl);
        req.setRequestHeader("Content-Type", fileData.type);
        req.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;

          setUploadProgress((event.loaded / event.total) * 100);
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
        };
        req.send(file);
      }
    }
  };

  // Listen for paste events to allow pasting files directly
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) {
            setSelectedFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, []);

  return (
    <div
      className={"flex flex-col gap-8 rounded-xl border bg-card text-card-foreground text-center shadow-sm min-w-[40em] max-w-4xl p-8 md:mx-auto"}>
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
          <p className={"text-gray-600"}>Paste or drag and drop a file here or click to select a file</p>
        )}
      </div>
      {uploadedUrl && <span className={"select-all"} onClick={async () => {
        await navigator.clipboard.writeText(uploadedUrl);
        toast.success("Copied link to clipboard");
      }}>{uploadedUrl}</span>}
      {uploadProgress !== 0 && <Progress className={"transition-all duration-150"} value={uploadProgress} />}
      {messageProgress !== "" && <span>{messageProgress}</span>}
      <CheckboxLabel text={"Convert to GIF"} checked={convertGif} setChecked={setConvertGif}
                     disabled={!GIF_CONVERTIBLE_TYPES.has(selectedFile?.type ?? "")} />
      <CheckboxLabel text={"Save to account"} checked={saveToAccount} setChecked={setSaveToAccount}
                     disabled={!isAuthenticated} />
      <Button onClick={handleUpload}>
        Upload
      </Button>
      <span
        className={"text-secondary-foreground text-sm"}>Max {formatBytes(Number(process.env.NEXT_PUBLIC_MAX_SIZE))} file size</span>
    </div>
  );
}