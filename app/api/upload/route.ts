import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file)
      return NextResponse.json(
        { error: "No file received." },
        { status: 400 }
      );

    if (file.size > MAX_SIZE) return NextResponse.json(
      { error: "File is over limit (250MB max)."},
      { status: 400 }
    );

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      console.error("No bucket name set");
      return NextResponse.json(
        { error: "Error uploading file." },
        { status: 500 }
      );
    }
    const key = `${generateString(8)}/${file.name}`;

    const uploadParams = {
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: file.type
    };

    const uploadCommand = new PutObjectCommand(uploadParams);
    await s3Client.send(uploadCommand);

    const finalUrl = `${process.env.DESTINATION_URL}${key}`;

    return NextResponse.json({ url: finalUrl }, { status: 200 });
  } catch (e) {
    console.error("Error uploading file: ", e);
    return NextResponse.json(
      { error: "Error uploading file." },
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
