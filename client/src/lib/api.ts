import type { MlbPlayer, Video, Drill } from "@shared/schema";

export async function fetchPlayers(): Promise<MlbPlayer[]> {
  const res = await fetch("/api/players");
  if (!res.ok) throw new Error("Failed to fetch players");
  return res.json();
}

export async function fetchPlayersPage(opts: {
  search?: string;
  bats?: string;
  limit?: number;
  offset?: number;
  seed?: number;
}): Promise<{ players: MlbPlayer[]; total: number }> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.bats) params.set("bats", opts.bats);
  params.set("limit", String(opts.limit ?? 9));
  params.set("offset", String(opts.offset ?? 0));
  params.set("seed", String(opts.seed ?? 0));
  const res = await fetch(`/api/players?${params}`);
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

export async function deleteVideo(videoId: string): Promise<void> {
  const res = await fetch(`/api/videos/${videoId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete video");
}

export async function renameVideo(videoId: string, title: string): Promise<void> {
  const res = await fetch(`/api/videos/${videoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to rename video");
}