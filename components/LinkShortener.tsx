import { useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Link } from "@/lib/utils";
import { toast } from "sonner";
import { Turnstile, TurnstileInstance } from "@marsidev/react-turnstile";

export function LinkShortener() {
  const [url, setUrl] = useState("");
  const [shortenedUrl, setShortenedUrl] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const handleShorten = async () => {
    if (!turnstileToken) {
      toast.error("Please complete the verification");
      return;
    }

    const data = Link.safeParse({
      url: url,
    });
    if (!data.success) return;

    const shortUrl = await fetch("/api/link", {
      method: "POST",
      body: JSON.stringify({ ...data.data, turnstileToken }),
    }).then(async (res) => {
      if (!res.ok) {
        console.error(await res.json());
        return "";
      }
      return (await res.json()).url as string;
    });

    turnstileRef.current?.reset();
    setTurnstileToken(null);
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
        onClick={handleShorten}
        disabled={!turnstileToken}
      >
        Shorten
      </Button>
    </div>
  );
}
