import { useEffect, useRef, useState } from "react";
import CheckboxLabel from "./CheckboxLabel";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";
import { FileData, formatBytes, removeExifData, EXIF_REMOVABLE_TYPES } from "@/lib/utils";
import { ConvertToGif } from "@/lib/gifConvert";
import { toast } from "sonner";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
  "video/mpeg"
]);

export function FileUpload() {
  const { isAuthenticated } = useConvexAuth();
  const { getToken } = useAuth();
  const confirmUpload = useMutation(api.files.confirmUpload);
  const getMaxSize = useQuery(api.files.getMaxSize);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState("");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [messageProgress, setMessageProgress] = useState("");

  const [convertGif, setConvertGif] = useState(false);
  const [removeExif, setRemoveExif] = useState(false);
  const [saveToAccount, setSaveToAccount] = useState(false);
  const [addToSite, setAddToSite] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const pendingUploadRef = useRef(false);

  const [uploadSpeed, setUploadSpeed] = useState("");
  const [uploadEta, setUploadEta] = useState("");
  const uploadStartTimeRef = useRef<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const uploadingRef = useRef(false);

  const requestWakeLock = async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      // ignore — not supported or denied
    }
  };

  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  };

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
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `/ffmpeg-mt/ffmpeg-core.wasm`,
          "application/wasm"
        ),
        workerURL: await toBlobURL(
          `/ffmpeg-mt/ffmpeg-core.worker.js`,
          "text/javascript"
        )
      });
    } else {
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `/ffmpeg-st/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `/ffmpeg-st/ffmpeg-core.wasm`,
          "application/wasm"
        )
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

  const handleUpload = () => {
    if (!selectedFile) {
      return;
    }

    if (!turnstileToken) {
      // Show the widget and run the upload once verification succeeds
      pendingUploadRef.current = true;
      setShowTurnstile(true);
      return;
    }

    performUpload(turnstileToken);
  };

  const handleTurnstileSuccess = (token: string) => {
    setTurnstileToken(token);
    if (pendingUploadRef.current) {
      pendingUploadRef.current = false;
      performUpload(token);
    }
  };

  const performUpload = async (token: string) => {
    if (!selectedFile) {
      return;
    }

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
    uploadingRef.current = true;
    await requestWakeLock();

    // Publishing to the public site implies saving to the account so the
    // collage can attribute the upload.
    const publishToSite =
      addToSite && isAuthenticated && file.type.startsWith("image/");
    const fileData = FileData.parse({
      name: file.name,
      type: file.type,
      size: file.size,
      save: (saveToAccount || publishToSite) && isAuthenticated,
      public: publishToSite
    });

    // Presign goes through a Convex HTTP action (not a plain action) so the
    // server can rate-limit anonymous users by their real IP.
    const convexSiteUrl = process.env.NEXT_PUBLIC_CONVEX_URL!.replace(
      ".convex.cloud",
      ".convex.site"
    );
    const authToken = isAuthenticated
      ? await getToken({ template: "convex" }).catch(() => null)
      : null;

    const { url: uploadUrl, fileId } = (await fetch(
      `${convexSiteUrl}/getUploadUrl`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ ...fileData, turnstileToken: token })
      }
    )
      .then(async (res) => {
        if (!res.ok) {
          throw new Error((await res.json()).error ?? "Failed to get upload URL");
        }
        return res.json();
      })
      .catch((e) => {
        console.error(e);
        return { url: "", fileId: null };
      })) as { url: string; fileId: Id<"files"> | null };

    turnstileRef.current?.reset();
    setTurnstileToken(null);
    setShowTurnstile(false);

    if (uploadUrl === "") {
      setMessageProgress("Errored");
      setUploadProgress(0);
      uploadingRef.current = false;
      releaseWakeLock();
      return;
    }

    if (process.env.NEXT_PUBLIC_UPLOAD_FILE == "false") {
      uploadingRef.current = false;
      releaseWakeLock();
      return;
    }

    const req = new XMLHttpRequest();
    req.open("PUT", uploadUrl);
    req.setRequestHeader("Content-Type", fileData.type);
    uploadStartTimeRef.current = Date.now();

    req.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;

      setUploadProgress((event.loaded / event.total) * 100);

      const elapsed = (Date.now() - uploadStartTimeRef.current) / 1000;
      if (elapsed > 0) {
        const speed = event.loaded / elapsed;
        setUploadSpeed(`${formatBytes(speed)}/s`);

        const remaining = event.total - event.loaded;
        if (speed > 0) {
          const etaSeconds = Math.ceil(remaining / speed);
          if (etaSeconds >= 60) {
            const mins = Math.floor(etaSeconds / 60);
            const secs = etaSeconds % 60;
            setUploadEta(`${mins}m ${secs}s remaining`);
          } else {
            setUploadEta(`${etaSeconds}s remaining`);
          }
        }
      }
    };

    req.onload = () => {
      setUploadProgress(0);
      setUploadSpeed("");
      setUploadEta("");
      uploadingRef.current = false;
      releaseWakeLock();
      if (req.status !== 200) {
        setMessageProgress("Failed to upload");
        return;
      }
      setMessageProgress("");
      if (fileId) {
        // Flip the pending DB row to confirmed now that the file exists
        confirmUpload({ fileId }).catch(console.error);
      }
      const url = new URL(uploadUrl);
      setUploadedUrl(
        `${process.env.NEXT_PUBLIC_DESTINATION_URL}${url.pathname}`
      );
    };

    req.onerror = () => {
      setUploadProgress(0);
      setUploadSpeed("");
      setUploadEta("");
      uploadingRef.current = false;
      releaseWakeLock();
      setMessageProgress("Failed to upload");
    };

    req.send(file);
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

  // Re-acquire wake lock when tab becomes visible again (browser releases it on hide)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && uploadingRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      releaseWakeLock();
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
        <span className="text-base sm:text-sm">
          {messageProgress}
          {uploadSpeed && ` \u2022 ${uploadSpeed}`}
          {uploadEta && ` \u2022 ${uploadEta}`}
        </span>
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
                checked={saveToAccount || addToSite}
                setChecked={setSaveToAccount}
                disabled={!isAuthenticated || addToSite}
              />
              <CheckboxLabel
                id={"site"}
                text={"Add to Glypho (public gallery)"}
                checked={addToSite}
                setChecked={setAddToSite}
                disabled={
                  !isAuthenticated ||
                  !(
                    selectedFile?.type.startsWith("image/") ||
                    (convertGif &&
                      GIF_CONVERTIBLE_TYPES.has(selectedFile?.type ?? ""))
                  )
                }
              />
              <p className="text-xs text-muted-foreground">
                Public images appear on{" "}
                <a
                  href={
                    process.env.NEXT_PUBLIC_GALLERY_URL ?? "/site"
                  }
                  className="underline hover:text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Glypho
                </a>
                , our public image collage. Requires an account.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showTurnstile && (
        <div className="flex justify-center">
          <Turnstile
            ref={turnstileRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            onSuccess={handleTurnstileSuccess}
            onError={() => setTurnstileToken(null)}
            onExpire={() => setTurnstileToken(null)}
            options={{
              theme: "dark"
            }}
          />
        </div>
      )}

      <Button
        className="py-5 text-base sm:py-2 sm:text-sm"
        onClick={handleUpload}
        disabled={!selectedFile}
      >
        Upload
      </Button>
      <span className={"text-sm text-secondary-foreground"}>
        Max {formatBytes(getMaxSize ?? 250000000)} file size
      </span>
    </div>
  );
}
