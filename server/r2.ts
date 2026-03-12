import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import path from "path";

const accountId = process.env.R2_ACCOUNT_ID!;
const bucket = process.env.R2_BUCKET_NAME!;

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export function r2Configured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET_NAME &&
            process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
}

export async function uploadToR2(
  buffer: Buffer,
  originalName: string,
  contentType: string
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  const key = `videos/${randomUUID()}${ext}`;
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Returns true if a sourceUrl value is an R2 key (not a legacy /uploads/ path) */
export function isR2Key(sourceUrl: string): boolean {
  return sourceUrl.startsWith("videos/");
}
