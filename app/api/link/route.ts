import { NextRequest, NextResponse } from "next/server";
import { Link } from "@/lib/utils";
import { generateString, redis, verifyTurnstileToken } from "@/lib/server";

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { turnstileToken, ...linkData } = body;

    if (!turnstileToken) {
        return NextResponse.json(
            { error: "Turnstile token is required" },
            { status: 400 }
        );
    }

    const isValidToken = await verifyTurnstileToken(turnstileToken);
    if (!isValidToken) {
        return NextResponse.json(
            { error: "Bot verification failed" },
            { status: 403 }
        );
    }

    const parse = Link.safeParse(linkData);

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