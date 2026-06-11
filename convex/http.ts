import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { WebhookEvent } from "@clerk/backend";
import { Webhook } from "svix";

const http = httpRouter();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

http.route({
  path: "/getUploadUrl",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, { status: 204, headers: corsHeaders });
  }),
});

http.route({
  path: "/getUploadUrl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    // Rate-limit authenticated users by user id, anonymous users by
    // client IP — never by a shared bucket.
    const identity = await ctx.auth.getUserIdentity();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    const identifier = identity?.subject ?? `ip:${ip}`;

    try {
      const result = await ctx.runAction(internal.files.getUploadUrl, {
        name: String(body.name ?? ""),
        type: String(body.type ?? ""),
        size: Number(body.size ?? 0),
        save: body.save === true,
        turnstileToken: String(body.turnstileToken ?? ""),
        identifier,
      });
      return jsonResponse(result, 200);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Failed to get upload URL";
      return jsonResponse({ error: message }, 400);
    }
  }),
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const event = await validateRequest(request);
    if (!event) {
      return new Response("Error occured", { status: 400 });
    }
    switch (event.type) {
      case "user.created": // intentional fallthrough
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id!;
        await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
        break;
      }
      default:
        console.log("Ignored Clerk webhook event", event.type);
    }

    return new Response(null, { status: 200 });
  }),
});

async function validateRequest(req: Request): Promise<WebhookEvent | null> {
  const payloadString = await req.text();
  const svixHeaders = {
    "svix-id": req.headers.get("svix-id")!,
    "svix-timestamp": req.headers.get("svix-timestamp")!,
    "svix-signature": req.headers.get("svix-signature")!,
  };
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  try {
    return wh.verify(payloadString, svixHeaders) as unknown as WebhookEvent;
  } catch (error) {
    console.error("Error verifying webhook event", error);
    return null;
  }
}

export default http;