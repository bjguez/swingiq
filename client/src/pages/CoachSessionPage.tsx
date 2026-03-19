import { useState, useEffect, useRef, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import DrawingCanvas from "@/components/DrawingCanvas";
import type { Tool, DrawAction } from "@/components/DrawingCanvas";
import {
  ArrowLeft, Send, Video, CheckCircle, X,
  Mic, Square, RotateCcw, Loader2, Check,
  Pen, Minus, Circle, RectangleHorizontal, Triangle,
  Undo2, Trash2, ChevronLeft, ChevronRight, Scissors,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Video as VideoType } from "@shared/schema";

type RecordingState = "idle" | "recording" | "preview" | "uploading" | "done";

const COLORS = ["#ef4444", "#eab308", "#22c55e", "#ffffff"];
const SPEEDS = [0.25, 0.5, 0.75, 1];

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const TOOLS: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: "pen", icon: <Pen size={14} />, label: "Draw" },
  { id: "line", icon: <Minus size={14} />, label: "Line" },
  { id: "angle", icon: <Triangle size={14} />, label: "Angle" },
  { id: "circle", icon: <Circle size={14} />, label: "Circle" },
  { id: "rect", icon: <RectangleHorizontal size={14} />, label: "Rect" },
];

export default function CoachSessionPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const playerId = params.get("playerId") ?? "";
  const initialVideoId = params.get("videoId") ?? "";

  // Session
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

  // Analysis tools
  const [activeTool, setActiveTool] = useState<Tool>("pen");
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [leftAnnotations, setLeftAnnotations] = useState<DrawAction[]>([]);
  const [rightAnnotations, setRightAnnotations] = useState<DrawAction[]>([]);
  const [activePanel, setActivePanel] = useState<"left" | "right">("left");
  const [speed, setSpeed] = useState(1);

  // Recording
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [voiceoverKey, setVoiceoverKey] = useState("");
  const [recordingError, setRecordingError] = useState("");

  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const proVideoRef = useRef<HTMLVideoElement>(null);
  const leftAnnotationRef = useRef<HTMLCanvasElement>(null);
  const rightAnnotationRef = useRef<HTMLCanvasElement>(null);
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

  // Sync playback speed
  useEffect(() => {
    if (playerVideoRef.current) playerVideoRef.current.playbackRate = speed;
    if (proVideoRef.current) proVideoRef.current.playbackRate = speed;
  }, [speed]);

  const stepFrame = (dir: 1 | -1) => {
    const vid = activePanel === "left" ? playerVideoRef.current : proVideoRef.current;
    if (!vid) return;
    vid.pause();
    vid.currentTime = Math.max(0, Math.min(vid.duration || 0, vid.currentTime + dir / 30));
  };

  const undoAnnotation = () => {
    if (activePanel === "left") setLeftAnnotations(a => a.slice(0, -1));
    else setRightAnnotations(a => a.slice(0, -1));
  };

  const clearAnnotations = () => {
    if (activePanel === "left") setLeftAnnotations([]);
    else setRightAnnotations([]);
  };

  // Canvas draw loop — composites videos + annotation layers
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
        // Composite left annotations
        if (leftAnnotationRef.current) {
          ctx.drawImage(leftAnnotationRef.current, 0, headerH, W / 2 - 1, videoH);
        }
        ctx.drawImage(proVid, W / 2 + 1, headerH, W / 2 - 1, videoH);
        // Composite right annotations
        if (rightAnnotationRef.current) {
          ctx.drawImage(rightAnnotationRef.current, W / 2 + 1, headerH, W / 2 - 1, videoH);
        }
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
        ctx.drawImage(playerVid, 0, headerH, W, videoH);
        if (leftAnnotationRef.current) {
          ctx.drawImage(leftAnnotationRef.current, 0, headerH, W, videoH);
        }
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, headerH, 140, 22);
        ctx.fillStyle = "#fff";
        ctx.font = "12px Arial, sans-serif";
        ctx.fillText("Player Swing", 8, headerH + 15);
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
      setRecordingError("Microphone access is required. Please allow microphone access and try again.");
      return;
    }

    chunksRef.current = [];
    startDrawLoop();

    const canvasStream = canvas.captureStream(30);
    canvasStream.addTrack(micStream.getAudioTracks()[0]);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 2_000_000 });
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      stopDrawLoop();
      micStream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setPreviewUrl(URL.createObjectURL(blob));
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
              setLeftAnnotations([]); setRightAnnotations([]);
            }}>Share Another</Button>
          </div>
        </div>
      </Layout>
    );
  }

  const isRecordingActive = recordingState === "recording";

  return (
    <Layout>
      {/* Hidden recording canvas */}
      <canvas ref={canvasRef} width={1280} height={720} className="hidden" />

      <div className="max-w-6xl mx-auto w-full py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/coach")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-2xl uppercase tracking-wider">New Coaching Session</h1>
        </div>

        {/* ── Video picker (no player video selected yet) ── */}
        {!playerVideoSrc && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Player's Swing</p>
            {playerVideos.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
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
              <div className="aspect-video max-w-sm rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Player has no swings uploaded yet</p>
              </div>
            )}
          </div>
        )}

        {/* ── Analysis UI (player video selected) ── */}
        {playerVideoSrc && (
          <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap rounded-lg border border-border bg-card px-3 py-2">
              {/* Drawing tools */}
              <div className="flex items-center gap-1">
                {TOOLS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTool(t.id)}
                    title={t.label}
                    className={`p-1.5 rounded transition-colors ${activeTool === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                  >
                    {t.icon}
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-border" />

              {/* Colors */}
              <div className="flex items-center gap-1">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setActiveColor(c)}
                    className={`w-4 h-4 rounded-full border-2 transition-transform ${activeColor === c ? "border-white scale-125" : "border-transparent"}`}
                    style={{ background: c }}
                  />
                ))}
              </div>

              <div className="w-px h-5 bg-border" />

              {/* Undo / Clear */}
              <button onClick={undoAnnotation} title="Undo" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Undo2 size={14} />
              </button>
              <button onClick={clearAnnotations} title="Clear all" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <Trash2 size={14} />
              </button>

              <div className="w-px h-5 bg-border" />

              {/* Speed */}
              <div className="flex items-center gap-1">
                {SPEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`text-[11px] font-semibold px-1.5 py-0.5 rounded transition-colors ${speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <div className="w-px h-5 bg-border" />

              {/* Frame step */}
              <button onClick={() => stepFrame(-1)} title="Previous frame" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => stepFrame(1)} title="Next frame" className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                <ChevronRight size={14} />
              </button>

              <div className="w-px h-5 bg-border" />

              {/* Active panel selector */}
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span>Active:</span>
                {(["left", "right"] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setActivePanel(p)}
                    className={`px-2 py-0.5 rounded font-semibold transition-colors ${activePanel === p ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                  >
                    {p === "left" ? "Player" : "Pro"}
                  </button>
                ))}
              </div>

              {/* Change player video */}
              <button
                onClick={() => { setPlayerVideoSrc(""); setPlayerVideoId(""); setLeftAnnotations([]); }}
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <X size={12} /> Change video
              </button>
            </div>

            {/* Video panels */}
            <div className="grid md:grid-cols-2 gap-4">
              {/* Player swing */}
              <div
                onClick={() => setActivePanel("left")}
                className={`relative aspect-video rounded-lg overflow-hidden bg-black border-2 transition-colors cursor-pointer ${activePanel === "left" ? "border-primary" : "border-border"}`}
              >
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
                <DrawingCanvas
                  ref={leftAnnotationRef}
                  tool={activePanel === "left" ? activeTool : "select"}
                  color={activeColor}
                  annotations={leftAnnotations}
                  onAnnotationsChange={setLeftAnnotations}
                />
                <div className="absolute top-2 left-2 text-[10px] font-bold text-white/60 bg-black/40 px-1.5 py-0.5 rounded pointer-events-none">Player</div>
                {isRecordingActive && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> REC {formatTime(recordingTime)}
                  </div>
                )}
              </div>

              {/* Pro video */}
              <div
                onClick={() => proVideoSrc && setActivePanel("right")}
                className={`relative aspect-video rounded-lg overflow-hidden bg-black border-2 transition-colors ${proVideoSrc ? (activePanel === "right" ? "border-primary cursor-pointer" : "border-border cursor-pointer") : "border-dashed border-border"}`}
              >
                {proVideoSrc ? (
                  <>
                    <video
                      ref={proVideoRef}
                      src={proVideoSrc}
                      controls
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                    />
                    <DrawingCanvas
                      ref={rightAnnotationRef}
                      tool={activePanel === "right" ? activeTool : "select"}
                      color={activeColor}
                      annotations={rightAnnotations}
                      onAnnotationsChange={setRightAnnotations}
                    />
                    <div className="absolute top-2 left-2 text-[10px] font-bold text-white/60 bg-black/40 px-1.5 py-0.5 rounded pointer-events-none">Pro</div>
                    {!isRecordingActive && (
                      <button
                        onClick={e => { e.stopPropagation(); setProVideoSrc(""); setProVideoId(""); setRightAnnotations([]); }}
                        className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                      ><X size={14} /></button>
                    )}
                  </>
                ) : (
                  <VideoLibraryModal
                    mode="pro"
                    trigger={
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                        <Video size={28} className="opacity-40" />
                        <p className="text-sm">Add pro comparison</p>
                      </div>
                    }
                    onVideoSelected={(src, _label, id) => { setProVideoSrc(src); if (id) setProVideoId(id); }}
                  />
                )}
              </div>
            </div>

            {/* Highlight moment */}
            {!isRecordingActive && (
              <div>
                {!showHighlight ? (
                  <button onClick={() => setShowHighlight(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Scissors size={13} /> Mark a specific moment for the player
                  </button>
                ) : (
                  <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Highlight Moment</p>
                      <button onClick={() => setShowHighlight(false)} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
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
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Voiceover recording ── */}
        {playerVideoSrc && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Voiceover Recording</p>

            {recordingState === "idle" && !voiceoverKey && (
              <div className="rounded-lg border border-dashed border-border p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">Record your coaching analysis</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Draw on the videos above while you talk. Only the video + annotations will be captured — not the rest of the page.
                  </p>
                </div>
                <Button onClick={startRecording} size="sm" className="shrink-0">
                  <Mic size={14} className="mr-2" /> Start Recording
                </Button>
              </div>
            )}

            {recordingState === "recording" && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <div>
                    <p className="font-semibold text-sm">Recording — {formatTime(recordingTime)}</p>
                    <p className="text-xs text-muted-foreground">Draw on the videos, scrub, and talk. Hit Stop when done.</p>
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
                    Use This Recording
                  </Button>
                </div>
              </div>
            )}

            {recordingState === "uploading" && (
              <div className="rounded-lg border border-border p-4 flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-primary shrink-0" />
                <p className="text-sm font-medium">Uploading recording…</p>
              </div>
            )}

            {recordingState === "done" && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Check size={18} className="text-green-500 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Recording ready — {formatTime(recordingTime)}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setVoiceoverKey(""); setRecordingTime(0); setRecordingState("idle"); }}>
                  <RotateCcw size={13} className="mr-2" /> Re-record
                </Button>
              </div>
            )}
          </div>
        )}

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
