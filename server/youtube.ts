/**
 * YouTube Data API v3 upload utility.
 *
 * Required env vars:
 *   YOUTUBE_CLIENT_ID       — OAuth2 client ID from Google Cloud Console
 *   YOUTUBE_CLIENT_SECRET   — OAuth2 client secret
 *   YOUTUBE_REFRESH_TOKEN   — Long-lived refresh token (obtained via one-time OAuth flow)
 *
 * To obtain a refresh token run: npx tsx script/get-youtube-token.ts
 */

import { google } from "googleapis";
import { Readable } from "stream";

export type YouTubePrivacy = "public" | "unlisted" | "private";

export interface YouTubeUploadOptions {
  title: string;
  description: string;
  tags: string[];
  privacyStatus: YouTubePrivacy;
  categoryId?: string; // 17 = Sports
  playlistId?: string;
  videoBuffer: Buffer;
  mimeType?: string;
}

export function youtubeConfigured(): boolean {
  return !!(
    process.env.YOUTUBE_CLIENT_ID &&
    process.env.YOUTUBE_CLIENT_SECRET &&
    process.env.YOUTUBE_REFRESH_TOKEN
  );
}

function getAuth() {
  const auth = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });
  return auth;
}

export async function uploadToYouTube(opts: YouTubeUploadOptions): Promise<string> {
  if (!youtubeConfigured()) throw new Error("YouTube credentials not configured");

  const auth = getAuth();
  const yt = google.youtube({ version: "v3", auth });

  const res = await yt.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: opts.title,
        description: opts.description,
        tags: opts.tags,
        categoryId: opts.categoryId ?? "17", // Sports
      },
      status: {
        privacyStatus: opts.privacyStatus,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      mimeType: opts.mimeType ?? "video/mp4",
      body: Readable.from(opts.videoBuffer),
    },
  });

  const videoId = res.data.id;
  if (!videoId) throw new Error("YouTube upload succeeded but returned no video ID");

  // Optionally add to a playlist
  if (opts.playlistId) {
    await yt.playlistItems.insert({
      part: ["snippet"],
      requestBody: {
        snippet: {
          playlistId: opts.playlistId,
          resourceId: { kind: "youtube#video", videoId },
        },
      },
    }).catch(() => {}); // non-fatal
  }

  return videoId;
}
