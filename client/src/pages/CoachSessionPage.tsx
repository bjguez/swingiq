import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import {
  ArrowLeft, Send, Video, CheckCircle, Scissors, X,
  Mic, Square, RotateCcw, Play, Loader2, Check,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Video as VideoType } from "@shared/schema";

type RecordingState = "idle" | "recording" | "preview" | "uploading" | "done";

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CoachSessionPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const playerId = params.get("playerId") ?? "";
  const initialVideoId = params.get("videoId") ?? "";

  // Session state
  const [notes, setNotes] = useState("");
  const [playerVideoId, setPlayerVideoId] = useState<string>(initialVideoId);
  const [proVideoId, setProVideoId] = useState<string>("");
  const [playerVideoSrc, setPlayerVideoSrc] = useState<string>("");
  const [proVideoSrc, setProVideoSrc] = useState<string>("");
  const [shared, setShared] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);
  const [highlightStart, setHighlightStart] = useState(0);
  const [highlightEnd, setHighlightEnd] = useState(5);
  const [videoDuration, setVideoDuration] = useState(5);

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [voiceoverKey, setVoiceoverKey] = useState(""); // R2 key stored on session
  const [recordingError, setRecordingError] = useState("");

  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const proVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Load player videos
  const { data: playerVideos = [] } = useQuery<VideoType[]>({
    queryKey: ["/api/coaching/players", playerId, "videos"],
    queryFn: async () => {
      const res = await fetch(`/api/coaching/players/${playerId}/videos`);
      return res.json();
    },
    enabled: !!playerId,
  });

  useEffect(() => {
    if (initialVideoId && playerVideos.length > 0) {
      const v = playerVideos.find(v => v.id === initialVideoId);
      if (v?.sourceUrl) setPlayerVideoSrc(v.sourceUrl);
    }
  }, [initialVideoId, playerVideos]);

  // Canvas draw loop — composites both video frames side by side
  const startDrawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = 1280, H = 720;
    const headerH = 50, footerH = 30;
    const videoH = H - headerH - footerH;

    function draw() {
      ctx.fillStyle = "#0d0d0d";
      ctx.fillRect(0, 0, W, H);

      // Header
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, W, headerH);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px Arial, sans-serif";
      ctx.fillText("Swing Studio", 18, 32);
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 14px Arial, sans-serif";
      ctx.fillText("● REC", W - 72, 32);

      const playerVid = playerVideoRef.current;
      const proVid = proVideoRef.current;
      const hasProVideo = !!(proVid && proVideoSrc);

      if (playerVid && hasProVideo) {
        // Side by side
        ctx.drawImage(playerVid, 0, headerH, W / 2 - 1, videoH);
        ctx.drawImage(proVid, W / 2 + 1, headerH, W / 2 - 1, videoH);
        // Divider
        ctx.fillStyle = "#333";
        ctx.fillRect(W / 2 - 1, headerH, 2, videoH);
        // Labels
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, headerH, 140, 22);
        ctx.fillRect(W / 2 + 1, headerH, 160, 22);
        ctx.fillStyle = "#fff";
        ctx.font = "12px Arial, sans-serif";
        ctx.fillText("Player Swing", 8, headerH + 15);
        ctx.fillText("Pro Comparison", W / 2 + 9, headerH + 15);
      } else if (playerVid && playerVideoSrc) {
        // Full width player swing
        ctx.drawImage(playerVid, 0, headerH, W, videoH);
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, headerH, 140, 22);
        ctx.fillStyle = "#fff";
        ctx.font = "12px Arial, sans-serif";
        ctx.fillText("Player Swing", 8, headerH + 15);
      } else {
        ctx.fillStyle = "#333";
        ctx.fillRect(0, headerH, W, videoH);
        ctx.fillStyle = "#666";
        ctx.font = "16px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No video selected", W / 2, H / 2);
        ctx.textAlign = "left";
      }

      // Footer
      ctx.fillStyle = "#111";
      ctx.fillRect(0, H - footerH, W, footerH);
      ctx.fillStyle = "#666";
      ctx.font = "11px Arial, sans-serif";
      ctx.fillText(`Swing Studio coaching session · ${new Date().toLocaleDateString()}`, 16, H - 10);

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();
  }, [playerVideoSrc, proVideoSrc]);

  const stopDrawLoop = () => cancelAnimationFrame(rafRef.current);

  async function startRecording() {
    setRecordingError("");
    const canvas = canvasRef.current;
    if (!canvas) return;

    let micStream: MediaStream;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setRecordingError("Microphone access is required to record. Please allow microphone access and try again.");
      return;
    }

    chunksRef.current = [];
    startDrawLoop();

    const canvasStream = canvas.captureStream(30);
    const audioTrack = micStream.getAudioTracks()[0];
    canvasStream.addTrack(audioTrack);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const recorder = new MediaRecorder(canvasStream, {
      mimeType,
      videoBitsPerSecond: 2_000_000,
    });

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stopDrawLoop();
      micStream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setRecordingState("preview");
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setRecordingState("recording");
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
  }

  function discardRecording() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setRecordingTime(0);
    setRecordingState("idle");
  }

  async function uploadRecording() {
    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    setRecordingState("uploading");

    const form = new FormData();
    form.append("file", blob, "coaching-session.webm");

    try {
      const res = await fetch("/api/coaching/recordings/upload", { method: "POST", body: form });
      if (!res.ok) {
        const d = await res.json();
        setRecordingError(d.message || "Upload failed");
        setRecordingState("preview");
        return;
      }
      const { key } = await res.json();
      setVoiceoverKey(key);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
      setRecordingState("done");
    } catch {
      setRecordingError("Upload failed. Please try again.");
      setRecordingState("preview");
    }
  }

  const shareMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/coaching/sessions", {
        playerId,
        playerVideoId: playerVideoId || null,
        proVideoId: proVideoId || null,
        notes: notes.trim() || null,
        voiceoverUrl: voiceoverKey || null,
        highlightStart: showHighlight ? highlightStart : null,
        highlightEnd: showHighlight ? highlightEnd : null,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => setShared(true),
  });

  const previewHighlight = () => {
    const vid = playerVideoRef.current;
    if (!vid) return;
    vid.currentTime = highlightStart;
    vid.play();
    const stop = () => {
      if (vid.currentTime >= highlightEnd) { vid.pause(); vid.removeEventListener("timeupdate", stop); }
    };
    vid.addEventListener("timeupdate", stop);
  };

  if (shared) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto py-20 text-center space-y-4">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
          <h2 className="font-display text-2xl uppercase tracking-wider">Session Shared</h2>
          <p className="text-muted-foreground">The player has been notified via email and in-app notification.</p>
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => navigate("/coach")}>Back to My Players</Button>
            <Button onClick={() => {
              setShared(false); setNotes(""); setVoiceoverKey("");
              setRecordingState("idle"); setShowHighlight(false);
            }}>Share Another</Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hidden canvas for recording — 1280×720 */}
      <canvas ref={canvasRef} width={1280} height={720} className="hidden" />

      <div className="max-w-5xl mx-auto w-full py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/coach")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-2xl uppercase tracking-wider">New Coaching Session</h1>
        </div>

        {/* Video pickers */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Player swing */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Player's Swing</p>
            {playerVideoSrc ? (
              <div className="space-y-2">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-border">
                  <video
                    ref={playerVideoRef}
                    src={playerVideoSrc}
                    controls
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain"
                    onLoadedMetadata={e => {
                      const dur = (e.target as HTMLVideoElement).duration;
                      setVideoDuration(dur);
                      setHighlightEnd(dur);
                    }}
                  />
                  {recordingState === "idle" && (
                    <button
                      onClick={() => { setPlayerVideoSrc(""); setPlayerVideoId(""); setShowHighlight(false); }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                    ><X size={14} /></button>
                  )}
                  {recordingState === "recording" && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      REC {formatTime(recordingTime)}
                    </div>
                  )}
                </div>

                {/* Highlight moment (only when not recording) */}
                {recordingState === "idle" && !showHighlight && (
                  <button
                    onClick={() => setShowHighlight(true)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Scissors size={13} /> Mark a specific moment
                  </button>
                )}
                {recordingState === "idle" && showHighlight && (
                  <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Highlight Moment</p>
                      <button onClick={() => setShowHighlight(false)} className="text-muted-foreground hover:text-foreground">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Start (s)</label>
                        <input type="number" min={0} max={Math.max(0, highlightEnd - 0.1)} step={0.1}
                          value={highlightStart.toFixed(1)}
                          onChange={e => setHighlightStart(Math.min(parseFloat(e.target.value) || 0, highlightEnd - 0.1))}
                          className="w-full mt-1 rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-wider">End (s)</label>
                        <input type="number" min={Math.min(videoDuration, highlightStart + 0.1)} max={videoDuration} step={0.1}
                          value={highlightEnd.toFixed(1)}
                          onChange={e => setHighlightEnd(Math.max(parseFloat(e.target.value) || 0, highlightStart + 0.1))}
                          className="w-full mt-1 rounded border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={previewHighlight} className="w-full text-xs">Preview Highlight</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {playerVideos.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {playerVideos.map(v => (
                      <button key={v.id}
                        onClick={() => { setPlayerVideoId(v.id); setPlayerVideoSrc(v.sourceUrl ?? ""); }}
                        className="relative aspect-video rounded-md overflow-hidden border border-border hover:border-primary/50 transition-colors bg-secondary"
                      >
                        {v.thumbnailUrl
                          ? <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                          : <Video size={16} className="absolute inset-0 m-auto text-muted-foreground opacity-40" />
                        }
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 p-0.5">
                          <p className="text-white text-[10px] truncate">{v.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-video rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">Player has no swings uploaded yet</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pro video */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pro Comparison (optional)</p>
            {proVideoSrc ? (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-border">
                <video
                  ref={proVideoRef}
                  src={proVideoSrc}
                  controls
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain"
                />
                {recordingState === "idle" && (
                  <button
                    onClick={() => { setProVideoSrc(""); setProVideoId(""); }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                  ><X size={14} /></button>
                )}
              </div>
            ) : (
              <VideoLibraryModal
                mode="pro"
                trigger={
                  <div className="aspect-video rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-foreground transition-colors">
                    <Video size={28} className="opacity-40" />
                    <p className="text-sm">Choose a pro video</p>
                  </div>
                }
                onVideoSelected={(src, _label, id) => { setProVideoSrc(src); if (id) setProVideoId(id); }}
              />
            )}
          </div>
        </div>

        {/* ── Voiceover Recording ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Voiceover Recording</p>

          {recordingState === "idle" && !voiceoverKey && (
            <div className="rounded-lg border border-dashed border-border p-6 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <Mic size={22} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Record a coaching video</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">
                  Your screen will be captured as you talk through the swing. Scrub both videos freely while recording.
                </p>
              </div>
              <Button onClick={startRecording} disabled={!playerVideoSrc} size="sm">
                <Mic size={14} className="mr-2" /> Start Recording
              </Button>
              {!playerVideoSrc && (
                <p className="text-xs text-muted-foreground">Select a player swing above first</p>
              )}
            </div>
          )}

          {recordingState === "recording" && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <div>
                  <p className="font-semibold text-sm">Recording in progress</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(recordingTime)} · Scrub and play the videos above while you talk
                  </p>
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={stopRecording}>
                <Square size={12} className="mr-2 fill-current" /> Stop
              </Button>
            </div>
          )}

          {recordingState === "preview" && (
            <div className="space-y-3">
              <video src={previewUrl} controls className="w-full aspect-video rounded-lg bg-black border border-border object-contain" />
              {recordingError && <p className="text-xs text-destructive">{recordingError}</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={discardRecording}>
                  <RotateCcw size={13} className="mr-2" /> Re-record
                </Button>
                <Button size="sm" onClick={uploadRecording} className="flex-1">
                  <Play size={13} className="mr-2" /> Use This Recording
                </Button>
              </div>
            </div>
          )}

          {recordingState === "uploading" && (
            <div className="rounded-lg border border-border p-4 flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-primary shrink-0" />
              <div>
                <p className="font-medium text-sm">Uploading recording…</p>
                <p className="text-xs text-muted-foreground">This may take a moment depending on the length.</p>
              </div>
            </div>
          )}

          {recordingState === "done" && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Check size={18} className="text-green-500 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Recording ready</p>
                  <p className="text-xs text-muted-foreground">Saved · {formatTime(recordingTime)} coaching video</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setVoiceoverKey(""); setRecordingTime(0); setRecordingState("idle"); }}>
                <RotateCcw size={13} className="mr-2" /> Re-record
              </Button>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coach Notes (optional)</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add written feedback to accompany your recording…"
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        {/* Share */}
        {shareMutation.isError && (
          <p className="text-sm text-destructive">{(shareMutation.error as Error).message}</p>
        )}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/coach")}>Cancel</Button>
          <Button
            onClick={() => shareMutation.mutate()}
            disabled={
              shareMutation.isPending ||
              recordingState === "recording" ||
              recordingState === "uploading" ||
              (!playerVideoId && !notes.trim() && !voiceoverKey)
            }
            className="flex-1 sm:flex-none"
          >
            <Send size={15} className="mr-2" />
            {shareMutation.isPending ? "Sharing…" : "Share with Player"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
