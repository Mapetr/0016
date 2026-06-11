import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest, {params}: {params: Promise<{ id: string }>}) {
    const url = await fetchQuery(api.links.getUrl, { slug: (await params).id });

    if (url === null) {
        redirect("/");
    } else {
        redirect(url);
    }
}
