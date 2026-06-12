import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { internal } from "@/convex/_generated/api";
import { getCurrentUser, getCurrentUserOrThrow } from "@/convex/users";
import { Id } from "./_generated/dataModel";
import { uploadRatelimit, verifyTurnstileToken } from "@/convex/ratelimit";
import { generateString } from "@/convex/helpers";

const DEFAULT_MAX_SIZE = 250000000;

// Server-side guard — client-side zod can be bypassed by calling the API
// directly. Strips path separators and control characters so the name can
// never escape its `<random>/` prefix in the bucket.
function sanitizeFileName(name: string): string {
  const sanitized = Array.from(name)
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return ch === "/" || ch === "\\" || code < 32 || code === 127 ? "_" : ch;
    })
    .join("")
    .trim();
  if (
    sanitized.length === 0 ||
    sanitized.length > 256 ||
    sanitized === "." ||
    sanitized === ".."
  ) {
    throw new Error("Invalid file name");
  }
  return sanitized;
}

function getMaxUploadSize() {
  const fromEnv = Number(process.env.MAX_SIZE);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_MAX_SIZE;
}

export const getMaxSize = query({
  args: {},
  handler: () => {
    return getMaxUploadSize();
  }
});

export const getFiles = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    return ctx.db
      .query("files")
      .withIndex("byUserId", q => q.eq("userId", user._id))
      .filter(row => row.neq(row.field("pending"), true))
      .order("desc")
      .paginate(args.paginationOpts);
  }
});

// Only callable from the /getUploadUrl HTTP action, which derives
// `identifier` (user id or client IP) server-side so it can't be spoofed.
export const getUploadUrl = internalAction({
  args: {
    name: v.string(),
    type: v.string(),
    size: v.number(),
    save: v.boolean(),
    turnstileToken: v.string(),
    identifier: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ url: string; fileId: Id<"files"> | null }> => {
    const fileName = sanitizeFileName(args.name);
    if (args.type.length > 256) {
      throw new Error("Invalid file type");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity && args.save) {
      throw new Error("Saving a file to account without an account");
    }

    const isValidToken = await verifyTurnstileToken(args.turnstileToken);
    if (!isValidToken) {
      throw new Error("Bot verification failed. Please try again.");
    }

    const { success } = await uploadRatelimit.limit(args.identifier);
    if (!success) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    if (!Number.isInteger(args.size) || args.size <= 0) {
      throw new Error("Invalid file size");
    }

    if (args.size > getMaxUploadSize()) {
      throw new Error("File is too big");
    }

      const s3Client = new S3Client({
        region: process.env.S3_REGION,
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY ?? "",
          secretAccessKey: process.env.S3_SECRET_KEY ?? ""
        }
      });

      const uploadPath = `${generateString(8)}/${fileName}`;

      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: uploadPath,
        ContentLength: args.size,
        ContentType: args.type
      });

      const shortUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

      let fileId: Id<"files"> | null = null;
      if (args.save) {
        // Insert a pending row now; the client confirms it after the PUT
        // succeeds. If it never does, the scheduled cleanup removes the row
        // once the presigned URL has expired.
        // Reuse the percent-encoded pathname from the signed URL so the
        // stored link matches the one shown right after upload (raw names
        // with '#', '?', etc. would otherwise break the URL).
        fileId = await ctx.runMutation(internal.files.saveFile, {
          url: `${process.env.DESTINATION_URL}${new URL(shortUrl).pathname}`,
          type: args.type,
          size: args.size,
        });
        await ctx.scheduler.runAfter(1200 * 1000, internal.files.deleteIfPending, {
          fileId
        });
      }

      return { url: shortUrl, fileId };
  },
});

export const saveFile = internalMutation({
  args: {
    url: v.string(),
    type: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    return ctx.db.insert("files", {
      url: args.url,
      type: args.type,
      size: args.size,
      userId: user._id,
      pending: true
    });
  }
})

export const confirmUpload = mutation({
  args: {
    fileId: v.id("files")
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUserOrThrow(ctx);
    const file = await ctx.db.get(args.fileId);
    if (!file || file.userId !== user._id) {
      throw new Error("File not found");
    }
    await ctx.db.patch(args.fileId, { pending: false });
  }
});

export const deleteIfPending = internalMutation({
  args: {
    fileId: v.id("files")
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (file?.pending) {
      await ctx.db.delete(args.fileId);
    }
  }
});
