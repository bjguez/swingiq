/**
 * Backfill thumbnails for all videos that have an R2 sourceUrl but no thumbnailUrl.
 * Runs against the live database — safe to re-run (skips videos that already have thumbnails).
 *
 * Usage:
 *   npx tsx script/backfill-thumbnails.ts
 */

import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import { isNull, or, eq } from "drizzle-orm";
import { videos } from "../shared/schema.js";

// ── DB ────────────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(pool);

// ── R2 ────────────────────────────────────────────────────────────────────────
const accountId = process.env.R2_ACCOUNT_ID!;
const bucket    = process.env.R2_BUCKET_NAME!;
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function isR2Key(url: string) {
  return url.startsWith("videos/") || url.startsWith("recordings/");
}

async function downloadFromR2(key: string): Promise<Buffer> {
  const presigned = await getSignedUrl(r2, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
  const res = await fetch(presigned);
  if (!res.ok) throw new Error(`Failed to download ${key}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadThumbnail(buffer: Buffer): Promise<string> {
  const key = `thumbnails/${randomUUID()}.jpg`;
  await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: "image/jpeg" }));
  return key;
}

async function extractThumbnail(videoBuffer: Buffer): Promise<Buffer | null> {
  const tmpIn  = path.join(os.tmpdir(), `bt-in-${Date.now()}.mp4`);
  const tmpOut = path.join(os.tmpdir(), `bt-out-${Date.now()}.jpg`);
  try {
    fs.writeFileSync(tmpIn, videoBuffer);
    await new Promise<void>((resolve, reject) => {
      execFile("ffmpeg", [
        "-i", tmpIn, "-ss", "0.5", "-vframes", "1", "-q:v", "3", "-y", tmpOut,
      ], { maxBuffer: 10 * 1024 * 1024 }, (err) => { if (err) reject(err); else resolve(); });
    });
    return fs.readFileSync(tmpOut);
  } catch (err) {
    console.warn(`  ffmpeg failed:`, (err as Error).message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpIn); } catch {}
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const rows = await db
  .select({ id: videos.id, title: videos.title, sourceUrl: videos.sourceUrl })
  .from(videos)
  .where(or(isNull(videos.thumbnailUrl), eq(videos.thumbnailUrl, "")));

const candidates = rows.filter(v => v.sourceUrl && isR2Key(v.sourceUrl));
console.log(`Found ${candidates.length} videos without thumbnails.\n`);

let ok = 0, skipped = 0, failed = 0;

for (const [i, video] of candidates.entries()) {
  process.stdout.write(`[${i + 1}/${candidates.length}] ${video.title} ... `);
  try {
    const videoBuffer = await downloadFromR2(video.sourceUrl!);
    const thumbBuffer = await extractThumbnail(videoBuffer);
    if (!thumbBuffer) { console.log("skipped (ffmpeg failed)"); skipped++; continue; }
    const thumbKey = await uploadThumbnail(thumbBuffer);
    await db.update(videos).set({ thumbnailUrl: thumbKey }).where(eq(videos.id, video.id));
    console.log(`done → ${thumbKey}`);
    ok++;
  } catch (err) {
    console.log(`FAILED: ${(err as Error).message}`);
    failed++;
  }
}

console.log(`\nDone. ${ok} thumbnails generated, ${skipped} skipped, ${failed} failed.`);
await pool.end();
