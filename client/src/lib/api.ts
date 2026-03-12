import type { MlbPlayer, Video, Drill } from "@shared/schema";

export async function fetchPlayers(): Promise<MlbPlayer[]> {
  const res = await fetch("/api/players");
  if (!res.ok) throw new Error("Failed to fetch players");
  return res.json();
}

export async function fetchPlayer(id: string): Promise<MlbPlayer> {
  const res = await fetch(`/api/players/${id}`);
  if (!res.ok) throw new Error("Failed to fetch player");
  return res.json();
}

export async function fetchVideos(category?: string): Promise<Video[]> {
  const url = category ? `/api/videos?category=${encodeURIComponent(category)}` : "/api/videos";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch videos");
  return res.json();
}

export async function fetchDrills(phase?: string): Promise<Drill[]> {
  const url = phase ? `/api/drills?phase=${encodeURIComponent(phase)}` : "/api/drills";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch drills");
  return res.json();
}

export async function fetchVideoPresignedUrl(videoId: string): Promise<string> {
  const res = await fetch(`/api/videos/${videoId}/presigned-url`);
  if (!res.ok) throw new Error("Failed to get video URL");
  const data = await res.json();
  return data.url;
}