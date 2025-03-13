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
            url: url
        });
        if (!data.success) return;

        const shortUrl = await fetch("/api/link", {
            method: "POST",
            body: JSON.stringify(data.data)
          }).then(async res => {
            if (!res.ok) {
              console.error(await res.json());
              return "";
            }
            return (await res.json()).url as string;
          });

        setShortenedUrl(shortUrl);
    }

    return (
        <div className={"flex flex-col gap-8 rounded-xl border bg-card text-card-foreground text-center shadow-sm min-w-[40em] max-w-4xl p-8 md:mx-auto"}>
            <span className={"font-semibold leading-none tracking-tight"}>Link shortener</span>
            {shortenedUrl && <span className={"select-all"} onClick={async () => {
                await navigator.clipboard.writeText(shortenedUrl);
                toast.success("Copied link to clipboard");
            }}>{shortenedUrl}</span>}
            <Input placeholder={"Enter your long URL"} onChange={(e) => {setUrl(e.target.value)}} />
            <Button onClick={handleShorten}>Shorten</Button>
        </div>
    )
}