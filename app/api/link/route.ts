import { NextRequest, NextResponse } from "next/server";
import { generateString, Link, redis } from "@/lib/utils";

export async function POST(request: NextRequest) {
    const parse = Link.safeParse(await request.json());

    if (!parse.success) {
        return NextResponse.json(
            {error: parse.error},
            {status: 400}
        )
    }

    const data = parse.data;

    let shortUrl = "";
    let urlOkay = false;

    while (!urlOkay) {
        shortUrl = generateString(6);
        urlOkay = await redis.get<string>(shortUrl) === null;
    }

    await redis.set(shortUrl, data.url);

    return NextResponse.json(
        { url: `${process.env.DOMAIN}/${shortUrl}` },
        { status: 200 }
    )
}