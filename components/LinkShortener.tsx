import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Link } from "@/lib/utils";
import { toast } from "sonner";

export function LinkShortener() {
  const [url, setUrl] = useState("");
  const [shortenedUrl, setShortenedUrl] = useState("");

  const handleShorten = async () => {
    const data = Link.safeParse({
      url: url,
    });
    if (!data.success) return;

    const shortUrl = await fetch("/api/link", {
      method: "POST",
      body: JSON.stringify(data.data),
    }).then(async (res) => {
      if (!res.ok) {
        console.error(await res.json());
        return "";
      }
      return (await res.json()).url as string;
    });

    setShortenedUrl(shortUrl);
  };

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
        Link shortener
      </span>
      {shortenedUrl && (
        <span
          className={
            "cursor-pointer select-all break-all text-base hover:underline sm:text-sm"
          }
          onClick={async () => {
            await navigator.clipboard.writeText(shortenedUrl);
            toast.success("Copied link to clipboard");
          }}
        >
          {shortenedUrl}
        </span>
      )}
      <Input
        className="py-5 text-base sm:py-2 sm:text-sm"
        placeholder={"Enter your long URL"}
        onChange={(e) => {
          setUrl(e.target.value);
        }}
      />
      <Button
        className="py-5 text-base sm:py-2 sm:text-sm"
        onClick={handleShorten}
      >
        Shorten
      </Button>
    </div>
  );
}
