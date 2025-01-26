import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { FileData } from "@/lib/utils";

const s3Client = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? ""
  }
});

const MAX_SIZE = 250000000;

export async function POST(request: NextRequest) {
  const data = FileData.parse(await request.json());
  const uploadPath = `${generateString(8)}/${data.name}`;

  if (data.size > MAX_SIZE) return NextResponse.json(
    { error: "File is too big" },
    { status: 400 }
  );

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: uploadPath,
    ContentLength: data.size,
    ContentType: data.type
  });

  try {
    return NextResponse.json(
      { url: await getSignedUrl(s3Client, command, { expiresIn: 900 }) },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to get presigned url" },
      { status: 500 }
    );
  }
}

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
