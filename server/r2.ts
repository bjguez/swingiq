import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
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
  contentType: string,
  prefix = "videos"
): Promise<string> {
  const ext = path.extname(originalName).toLowerCase() || ".bin";
  const key = `${prefix}/${randomUUID()}${ext}`;
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return key;
}

export async function getPresignedUrl(key: string, expiresIn = 604800): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}

/** Generates a presigned PUT URL so browsers can upload directly to R2 (bypasses the server) */
export async function getPresignedPutUrl(key: string, contentType: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(r2, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn });
}

/** Streams a Node.js readable directly to R2 — no intermediate buffering */
export async function streamToR2(
  key: string,
  stream: NodeJS.ReadableStream,
  contentType: string,
  contentLength?: number,
): Promise<void> {
  await r2.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: stream as any,
    ContentType: contentType,
    ...(contentLength && contentLength > 0 ? { ContentLength: contentLength } : {}),
  }));
}

/** Returns a public URL for a key using the custom domain if configured, else falls back to presigned URL */
export async function getVideoUrl(key: string): Promise<string> {
  const publicBase = process.env.R2_PUBLIC_URL;
  if (publicBase) {
    return `${publicBase.replace(/\/$/, "")}/${key}`;
  }
  return getPresignedUrl(key);
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Returns true if a sourceUrl value is an R2 key (not a legacy /uploads/ path) */
export function isR2Key(sourceUrl: string): boolean {
  return sourceUrl.startsWith("videos/") || sourceUrl.startsWith("recordings/") || sourceUrl.startsWith("thumbnails/");
}

/** Configures CORS on the R2 bucket to allow browser video/canvas access from any origin */
export async function configureR2Cors(): Promise<void> {
  try {
    await r2.send(new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["GET", "HEAD", "PUT"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["Content-Length", "Content-Type", "ETag"],
            MaxAgeSeconds: 86400,
          },
        ],
      },
    }));
  } catch (err) {
    console.warn("[R2] Could not configure CORS (may not be supported on this endpoint):", err);
  }
}

/** Returns true if the file exists in R2, false if missing */
export async function checkR2Exists(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}
