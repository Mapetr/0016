import { redirect } from "next/navigation";
import { redis } from "../api/link/route";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest, {params}: {params: Promise<{ id: string }>}) {
    const url = await redis.get<string>((await params).id);

    if (url === null) {
        redirect("/");
    } else {
        redirect(url);
    }
}