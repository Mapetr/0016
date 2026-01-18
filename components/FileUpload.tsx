import { useEffect, useRef, useState } from "react";
import CheckboxLabel from "./CheckboxLabel";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { FileData, formatBytes, removeExifData, EXIF_REMOVABLE_TYPES } from "@/lib/utils";
import { ConvertToGif } from "@/lib/gifConvert";
import { toast } from "sonner";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Turnstile, TurnstileInstance, TurnstileProps } from "@marsidev/react-turnstile";

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`h-5 w-5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

const GIF_CONVERTIBLE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/webm",
  "video/mp4",
  "video/mpeg",
]);

export function FileUpload() {
  const { isAuthenticated } = useConvexAuth();
  const getUploadUrl = useAction(api.files.getUploadUrl);
  const getMaxSize = useQuery(api.files.getMaxSize);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [messageProgress, setMessageProgress] = useState("");

  const [convertGif, setConvertGif] = useState(false);
  const [removeExif, setRemoveExif] = useState(false);
  const [saveToAccount, setSaveToAccount] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

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
        coreURL: await toBlobURL(
          `/ffmpeg-mt/ffmpeg-core.js`,
          "text/javascript",
        ),
        wasmURL: await toBlobURL(
          `/ffmpeg-mt/ffmpeg-core.wasm`,
          "application/wasm",
        ),
        workerURL: await toBlobURL(
          `/ffmpeg-mt/ffmpeg-core.worker.js`,
          "text/javascript",
        ),
      });
    } else {
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `/ffmpeg-st/ffmpeg-core.js`,
          "text/javascript",
        ),
        wasmURL: await toBlobURL(
          `/ffmpeg-st/ffmpeg-core.wasm`,
          "application/wasm",
        ),
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
    if (!turnstileToken) {
      toast.error("Please complete the verification");
      return;
    }

    if (selectedFile) {
      setUploadedUrl("");

      let file: File = selectedFile;

      if (removeExif && !convertGif) {
        setMessageProgress("Removing EXIF data");
        file = await removeExifData(file);
      }

      if (convertGif) {
        await load();
        setMessageProgress("Converting");
        file = await ConvertToGif(ffmpeg, file);
      }

      setMessageProgress("Uploading");

      const fileData = FileData.parse({
        name: file.name,
        type: file.type,
        size: file.size,
        save: saveToAccount && isAuthenticated,
      });

      const { url: uploadUrl } = await getUploadUrl({
        ...fileData,
        turnstileToken,
      }).catch((e) => {
        console.error(e);
        return { url: "" };
      });

      turnstileRef.current?.reset();
      setTurnstileToken(null);

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
          setUploadedUrl(
            `${process.env.NEXT_PUBLIC_DESTINATION_URL}${url.pathname}`,
          );
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
      className={
        "mx-auto flex w-full max-w-4xl flex-col gap-5 p-0 text-center sm:gap-8 sm:rounded-xl sm:border sm:bg-card sm:p-8 sm:text-card-foreground sm:shadow-sm"
      }
    >
      <span
        className={
          "text-lg font-semibold leading-none tracking-tight sm:text-base"
        }
      >
        File uploader
      </span>
      <div
        className={
          "cursor-pointer rounded-lg border-2 border-dashed border-gray-400 p-6 text-center sm:p-4"
        }
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleFileSelect}
      >
        <input
          type={"file"}
          ref={fileInputRef}
          className={"hidden"}
          onChange={handleFileChange}
        />
        {selectedFile ? (
          <p className={"break-all px-2 text-base text-gray-600 sm:text-sm"}>
            {selectedFile.name}
          </p>
        ) : (
          <p className={"text-base text-gray-600 sm:text-sm"}>
            <span className="hidden sm:inline">
              Paste or drag and drop a file here or click to select a file
            </span>
            <span className="sm:hidden">Tap to select a file or paste</span>
          </p>
        )}
      </div>
      {uploadedUrl && (
        <span
          className={
            "cursor-pointer select-all break-all text-base hover:underline sm:text-sm"
          }
          onClick={async () => {
            await navigator.clipboard.writeText(uploadedUrl);
            toast.success("Copied link to clipboard");
          }}
        >
          {uploadedUrl}
        </span>
      )}
      {uploadProgress !== 0 && (
        <Progress
          className={"transition-all duration-150"}
          value={uploadProgress}
        />
      )}
      {messageProgress !== "" && (
        <span className="text-base sm:text-sm">{messageProgress}</span>
      )}

      {/* Collapsible Options Menu */}
      <div className="w-full">
        <button
          type="button"
          onClick={() => setOptionsOpen(!optionsOpen)}
          className="flex w-full items-center justify-center gap-2 py-2 text-base text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
        >
          <span>Options</span>
          <ChevronIcon isOpen={optionsOpen} />
        </button>

        <div
          className={`grid transition-all duration-200 ease-in-out ${
            optionsOpen
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col gap-4 pb-1 pt-3">
              <CheckboxLabel
                id={"gif"}
                text={"Convert to GIF"}
                checked={convertGif}
                setChecked={setConvertGif}
                disabled={!GIF_CONVERTIBLE_TYPES.has(selectedFile?.type ?? "")}
              />
              <CheckboxLabel
                id={"exif"}
                text={"Remove EXIF data"}
                checked={removeExif}
                setChecked={setRemoveExif}
                disabled={!EXIF_REMOVABLE_TYPES.has(selectedFile?.type ?? "")}
              />
              <CheckboxLabel
                id={"account"}
                text={"Save to account"}
                checked={saveToAccount}
                setChecked={setSaveToAccount}
                disabled={!isAuthenticated}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onSuccess={setTurnstileToken}
          onError={() => setTurnstileToken(null)}
          onExpire={() => setTurnstileToken(null)}
          options={{
            theme: "dark",
          }}
        />
      </div>

      <Button
        className="py-5 text-base sm:py-2 sm:text-sm"
        onClick={handleUpload}
        disabled={!turnstileToken}
      >
        Upload
      </Button>
      <span className={"text-sm text-secondary-foreground"}>
        Max {formatBytes(getMaxSize ?? 250000000)} file size
      </span>
    </div>
  );
}
