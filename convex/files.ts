import { action, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { internal } from "@/convex/_generated/api";
import { getCurrentUser, getCurrentUserOrThrow } from "@/convex/users";
import { uploadRatelimit, verifyTurnstileToken } from "@/convex/ratelimit";

const MAX_SIZE = 250000000;

function generateString(length: number) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(
      Math.floor(Math.random() * charactersLength)
    );
    counter += 1;
  }
  return result;
}

export const getMaxSize = query({
  args: {},
  handler: () => {
    return Number(process.env.MAX_SIZE) ?? MAX_SIZE;
  }
});

export const getFiles = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) {
      return [];
    }

    return ctx.db.query("files").filter(row => row.eq(row.field("userId"), user._id)).collect();
  }
});

export const getUploadUrl = action({
  args: {
    name: v.string(),
    type: v.string(),
    size: v.number(),
    save: v.boolean(),
    turnstileToken: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity && args.save) {
      throw new Error("Saving a file to account without an account");
    }

    const isValidToken = await verifyTurnstileToken(args.turnstileToken);
    if (!isValidToken) {
      throw new Error("Bot verification failed. Please try again.");
    }

    const identifier = identity?.subject ?? "anonymous";
    const { success } = await uploadRatelimit.limit(identifier);
    if (!success) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    if (args.size > (Number(process.env.MAX_SIZE) ?? MAX_SIZE)) {
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

      const uploadPath = `${generateString(8)}/${args.name}`;

      const command = new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: uploadPath,
        ContentLength: args.size,
        ContentType: args.type
      });

      const shortUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

      if (args.save) {
        await ctx.runMutation(internal.files.saveFile, {
          url: `${process.env.DESTINATION_URL}/${uploadPath}`,
          type: args.type,
          size: args.size,
        })
      }

      return { url: shortUrl };
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
    await ctx.db.insert("files", {
      url: args.url,
      type: args.type,
      size: args.size,
      userId: user._id
    });
  }
})