import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { VideoLibraryModal } from "@/components/VideoLibraryModal";
import DrawingCanvas from "@/components/DrawingCanvas";
import type { Tool, DrawAction } from "@/components/DrawingCanvas";
import {
  ArrowLeft, Send, Video, CheckCircle, X,
  Mic, Square as StopIcon, RotateCcw, Loader2, Check,
  Circle, Undo, Trash2, Scissors, RotateCw, Link2,
  FlipHorizontal2, ZoomIn, ZoomOut,
  MousePointer2, PenTool, Type, Timer,
  Play, Pause, SkipBack, SkipForward, PersonStanding,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Video as VideoType } from "@shared/schema";
import { detectPose, SKELETON_CONNECTIONS, UPPER_BODY_INDICES } from "@/lib/poseDetector";
import type { PoseResult } from "@/lib/poseDetector";
import PoseOverlay from "@/components/PoseOverlay";

type RecordingState = "idle" | "recording" | "preview" | "uploading" | "done";

const COLORS = [
  { value: "#ef4444", label: "Red" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#ffffff", label: "White" },
];
const SPEEDS = [0.25, 0.5, 0.75, 1];

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
  const blueprintMode = params.get("mode") === "blueprint";

  // Session
  const [notes, setNotes] = useState("");
  const [playerVideoId, setPlayerVideoId] = useState<string>(initialVideoId);
  const [proVideoId, setProVideoId] = useState<string>("");
  const [playerVideoSrc, setPlayerVideoSrc] = useState<string>("");
  const [proVideoSrc, setProVideoSrc] = useState<string>("");
  const [shared, setShared] = useState(false);
  const [sharedSessionId, setSharedSessionId] = useState<string | null>(null);
  const [showHighlight, setShowHighlight] = useState(false);
  const [highlightStart, setHighlightStart] = useState(0);
  const [highlightEnd, setHighlightEnd] = useState(5);
  const [videoDuration, setVideoDuration] = useState(5);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState([0]);
  const [currentTime, setCurrentTime] = useState(0);

  // Analysis tools
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [activeColor, setActiveColor] = useState(COLORS[0].value);
  const [leftAnnotations, setLeftAnnotations] = useState<DrawAction[]>([]);
  const [rightAnnotations, setRightAnnotations] = useState<DrawAction[]>([]);
  const [activePanel, setActivePanel] = useState<"left" | "right">("left");
  const [speed, setSpeed] = useState(1);

  // Rotation
  const [leftRotation, setLeftRotation] = useState<0 | 90 | 180 | 270>(0);
  const [rightRotation, setRightRotation] = useState<0 | 90 | 180 | 270>(0);

  // Sync
  const [synced, setSynced] = useState(false);

  // Flip / Zoom / Pan
  const [leftFlipH, setLeftFlipH] = useState(false);
  const [rightFlipH, setRightFlipH] = useState(false);
  const [leftZoom, setLeftZoom] = useState(1);
  const [rightZoom, setRightZoom] = useState(1);
  const [leftPanX, setLeftPanX] = useState(0);
  const [leftPanY, setLeftPanY] = useState(0);
  const [rightPanX, setRightPanX] = useState(0);
  const [rightPanY, setRightPanY] = useState(0);
  const leftPanRef = useRef({ dragging: false, startX: 0, startY: 0, basePanX: 0, basePanY: 0 });
  const rightPanRef = useRef({ dragging: false, startX: 0, startY: 0, basePanX: 0, basePanY: 0 });

  // Recording
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [voiceoverKey, setVoiceoverKey] = useState("");
  const [recordingError, setRecordingError] = useState("");

  // Pose detection
  const [poseEnabled, setPoseEnabled] = useState(false);
  const [poseResult, setPoseResult] = useState<PoseResult | null>(null);

  // Blueprint mode
  const [blueprintTitle, setBlueprintTitle] = useState("");
  const [blueprintPhase, setBlueprintPhase] = useState("foundation");
  const [blueprintSaved, setBlueprintSaved] = useState(false);

  const playerVideoRef = useRef<HTMLVideoElement>(null);
  const proVideoRef = useRef<HTMLVideoElement>(null);
  const leftAnnotationRef = useRef<HTMLCanvasElement>(null);
  const rightAnnotationRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

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

  const affectsLeft = synced || activePanel === "left";
  const affectsRight = synced || activePanel === "right";

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      if (affectsLeft) playerVideoRef.current?.pause();
      if (affectsRight && proVideoSrc) proVideoRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (affectsLeft) playerVideoRef.current?.play();
      if (affectsRight && proVideoSrc) proVideoRef.current?.play();
      setIsPlaying(true);
    }
  }, [isPlaying, affectsLeft, affectsRight, proVideoSrc]);

  const handleSeek = useCallback((values: number[]) => {
    const pct = values[0];
    setProgress(values);
    if (affectsLeft && playerVideoRef.current && videoDuration > 0) {
      playerVideoRef.current.currentTime = (pct / 100) * videoDuration;
    }
    if (affectsRight && proVideoRef.current && proVideoRef.current.duration > 0) {
      proVideoRef.current.currentTime = (pct / 100) * proVideoRef.current.duration;
    }
  }, [affectsLeft, affectsRight, videoDuration]);

  const stepFrame = useCallback((dir: 1 | -1) => {
    if (affectsLeft && playerVideoRef.current) {
      playerVideoRef.current.pause();
      playerVideoRef.current.currentTime = Math.max(0, Math.min(playerVideoRef.current.duration || 0, playerVideoRef.current.currentTime + dir / 30));
    }
    if (affectsRight && proVideoRef.current && proVideoSrc) {
      proVideoRef.current.pause();
      proVideoRef.current.currentTime = Math.max(0, Math.min(proVideoRef.current.duration || 0, proVideoRef.current.currentTime + dir / 30));
    }
    setIsPlaying(false);
  }, [affectsLeft, affectsRight, proVideoSrc]);

  const undoAnnotation = () => {
    if (activePanel === "left") setLeftAnnotations(a => a.slice(0, -1));
    else setRightAnnotations(a => a.slice(0, -1));
  };

  const clearAnnotations = () => {
    if (activePanel === "left") setLeftAnnotations([]);
    else setRightAnnotations([]);
  };

  // Draw pose skeleton onto recording canvas panel
  function drawPoseSkeleton(ctx: CanvasRenderingContext2D, result: PoseResult, px: number, py: number, pw: number, ph: number) {
    const MIN_VIS = 0.5;
    const toC = (lm: { x: number; y: number }) => ({ x: px + lm.x * pw, y: py + lm.y * ph });
    ctx.lineWidth = 2;
    for (const [i, j] of SKELETON_CONNECTIONS) {
      const a = result.landmarks[i], b = result.landmarks[j];
      if ((a.visibility ?? 0) < MIN_VIS || (b.visibility ?? 0) < MIN_VIS) continue;
      const isUpper = UPPER_BODY_INDICES.has(i) && UPPER_BODY_INDICES.has(j);
      ctx.strokeStyle = isUpper ? "#22c55e" : "#60a5fa";
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 4;
      ctx.beginPath(); ctx.moveTo(...Object.values(toC(a)) as [number, number]); ctx.lineTo(...Object.values(toC(b)) as [number, number]); ctx.stroke();
    }
    ctx.shadowBlur = 0;
    for (let i = 11; i < 33; i++) {
      const p = result.landmarks[i];
      if ((p.visibility ?? 0) < MIN_VIS) continue;
      const cp = toC(p);
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath(); ctx.arc(cp.x, cp.y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Canvas draw loop — composites videos + annotation layers
  const startDrawLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    // 16:9 video panels so annotations align exactly with no letterboxing
    const W = 1280, headerH = 50, footerH = 30;
    const videoH = 360; // W/2 × 9/16 = 640 × 0.5625 = 360
    const H = headerH + videoH + footerH; // 440

    function drawVid(vid: HTMLVideoElement, dx: number, dy: number, dw: number, dh: number, flipH: boolean, zoom: number, panX: number, panY: number, rotation: 0 | 90 | 180 | 270 = 0) {
      const vw = vid.videoWidth || dw;
      const vh = vid.videoHeight || dh;
      // Match CSS object-contain: scale video to fit panel while preserving aspect ratio
      const containScale = Math.min(dw / vw, dh / vh);
      const containW = vw * containScale;
      const containH = vh * containScale;

      ctx.save();
      ctx.beginPath();
      ctx.rect(dx, dy, dw, dh);
      ctx.clip();
      ctx.translate(dx + dw / 2, dy + dh / 2);
      if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
      if (flipH) ctx.scale(-1, 1);
      // After rotation, swap dimensions if 90/270
      const drawW = rotation === 90 || rotation === 270 ? containH : containW;
      const drawH = rotation === 90 || rotation === 270 ? containW : containH;
      if (zoom !== 1 || panX !== 0 || panY !== 0) {
        const sw = vw / zoom;
        const sh = vh / zoom;
        const pxSrc = panX * (vw / containW) / zoom;
        const pySrc = panY * (vh / containH) / zoom;
        const sx = Math.max(0, (vw - sw) / 2 - pxSrc);
        const sy = Math.max(0, (vh - sh) / 2 - pySrc);
        ctx.drawImage(vid, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
      } else {
        ctx.drawImage(vid, -drawW / 2, -drawH / 2, drawW, drawH);
      }
      ctx.restore();
    }

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
        drawVid(playerVid, 0, headerH, W / 2 - 1, videoH, leftFlipH, leftZoom, leftPanX, leftPanY, leftRotation);
        if (leftAnnotationRef.current) {
          ctx.drawImage(leftAnnotationRef.current, 0, headerH, W / 2 - 1, videoH);
        }
        if (poseResult && poseEnabled) drawPoseSkeleton(ctx, poseResult, 0, headerH, W / 2 - 1, videoH);
        drawVid(proVid, W / 2 + 1, headerH, W / 2 - 1, videoH, rightFlipH, rightZoom, rightPanX, rightPanY, rightRotation);
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
        // Center single video at 16:9 (same aspect as browser panel) to avoid X/Y distortion
        const panelW = W / 2;
        const panelX = W / 4;
        drawVid(playerVid, panelX, headerH, panelW, videoH, leftFlipH, leftZoom, leftPanX, leftPanY, leftRotation);
        if (leftAnnotationRef.current) {
          ctx.drawImage(leftAnnotationRef.current, panelX, headerH, panelW, videoH);
        }
        if (poseResult && poseEnabled) drawPoseSkeleton(ctx, poseResult, panelX, headerH, panelW, videoH);
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(panelX, headerH, 160, 22);
        ctx.fillStyle = "#fff";
        ctx.font = "12px Arial, sans-serif";
        ctx.fillText(blueprintMode ? "Pro Analysis" : "Player Swing", panelX + 8, headerH + 15);
      }

      // Moving watermark — cycles through 4 corners every ~4s
      const wmPositions = [
        { x: 24,      y: headerH + 48 },
        { x: W - 130, y: headerH + 48 },
        { x: 24,      y: H - footerH - 18 },
        { x: W - 130, y: H - footerH - 18 },
      ];
      const wmIdx = Math.floor(Date.now() / 4000) % 4;
      const wm = wmPositions[wmIdx];
      ctx.font = "bold 13px Arial, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillText("swingstudio.ai", wm.x, wm.y);

      // Footer
      ctx.fillStyle = "#111";
      ctx.fillRect(0, H - footerH, W, footerH);
      ctx.fillStyle = "#666";
      ctx.font = "11px Arial, sans-serif";
      ctx.fillText(`Swing Studio coaching session · ${new Date().toLocaleDateString()}`, 16, H - 10);

      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
  }, [playerVideoSrc, proVideoSrc, blueprintMode, poseEnabled, poseResult, leftFlipH, leftZoom, leftPanX, leftPanY, leftRotation, rightFlipH, rightZoom, rightPanX, rightPanY, rightRotation]);

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

  // Pose detection loop — 10fps on the primary video
  useEffect(() => {
    if (!poseEnabled || !playerVideoSrc) { setPoseResult(null); return; }
    const id = setInterval(async () => {
      const vid = playerVideoRef.current;
      if (vid && vid.readyState >= 2) {
        const r = await detectPose(vid, performance.now());
        if (r) setPoseResult(r);
      }
    }, 100);
    return () => clearInterval(id);
  }, [poseEnabled, playerVideoSrc]);

  const saveToBlueprintMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/blueprint/content", {
        phase: blueprintPhase,
        contentType: "voiceover",
        title: blueprintTitle.trim(),
        description: notes.trim() || null,
        sourceUrl: voiceoverKey,
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      return res.json();
    },
    onSuccess: () => setBlueprintSaved(true),
  });

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
    onSuccess: (data) => { setShared(true); setSharedSessionId(data.id ?? null); },
  });

  if (blueprintSaved) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto py-20 text-center space-y-4">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
          <h2 className="font-display text-2xl uppercase tracking-wider">Blueprint Saved</h2>
          <p className="text-muted-foreground">The voiceover has been added to the Blueprint curriculum.</p>
          <div className="flex gap-3 justify-center pt-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/admin")}>Back to Admin</Button>
            <Button onClick={() => {
              setBlueprintSaved(false); setBlueprintTitle(""); setBlueprintPhase("foundation");
              setNotes(""); setVoiceoverKey(""); setRecordingState("idle");
              setPlayerVideoSrc(""); setPlayerVideoId("");
              setLeftAnnotations([]); setRightAnnotations([]);
            }}>Add Another</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (shared) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto py-20 text-center space-y-4">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
          <h2 className="font-display text-2xl uppercase tracking-wider">Session Shared</h2>
          <p className="text-muted-foreground">The player has been notified via email and in-app notification.</p>
          <div className="flex gap-3 justify-center pt-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/coach")}>Back to My Teams</Button>
            {sharedSessionId && (
              <Button variant="outline" onClick={() => navigate(`/coach/session/review?sessionId=${sharedSessionId}`)}>
                View Session
              </Button>
            )}
            <Button onClick={() => {
              setShared(false); setSharedSessionId(null); setNotes(""); setVoiceoverKey("");
              setRecordingState("idle"); setShowHighlight(false);
              setLeftAnnotations([]); setRightAnnotations([]);
            }}>Share Another</Button>
          </div>
        </div>
      </Layout>
    );
  }

  const isRecordingActive = recordingState === "recording";

  const videoTransform = (flipH: boolean, zoom: number, panX: number, panY: number, rotation: 0 | 90 | 180 | 270 = 0): React.CSSProperties => {
    const parts: string[] = [];
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);
    if (flipH) parts.push("scaleX(-1)");
    parts.push(`scale(${zoom})`);
    parts.push(`translate(${panX / zoom}px, ${panY / zoom}px)`);
    return { transform: parts.join(" "), transformOrigin: "center" };
  };

  return (
    <Layout>
      {/* Hidden recording canvas */}
      <canvas ref={canvasRef} width={1280} height={440} className="hidden" />

      <div className="max-w-6xl mx-auto w-full py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/coach")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-2xl uppercase tracking-wider">{blueprintMode ? "New Blueprint Recording" : "New Coaching Session"}</h1>
        </div>

        {/* ── Video picker (no video selected yet) ── */}
        {!playerVideoSrc && (
          <div className="space-y-2">
            {blueprintMode ? (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Pro Video to Analyze</p>
                <VideoLibraryModal
                  mode="pro"
                  trigger={
                    <div className="aspect-video max-w-sm rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors cursor-pointer">
                      <Video size={28} className="opacity-40" />
                      <p className="text-sm">Choose a pro video</p>
                    </div>
                  }
                  onVideoSelected={(src, _label, id) => {
                    setPlayerVideoSrc(src);
                    if (id) setPlayerVideoId(id);
                  }}
                />
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Player's Swing</p>
                {playerVideos.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                    {playerVideos.map(v => (
                      <button key={v.id}
                        onClick={() => { setPlayerVideoId(v.id); setPlayerVideoSrc(v.sourceUrl ?? ""); }}
                        className="flex flex-col rounded-md overflow-hidden border border-border hover:border-primary/50 transition-colors bg-secondary text-left"
                      >
                        <div className="relative aspect-video w-full bg-black">
                          {v.thumbnailUrl
                            ? <img src={v.thumbnailUrl} alt={v.title} className="w-full h-full object-cover" />
                            : <Video size={16} className="absolute inset-0 m-auto text-muted-foreground opacity-40" />
                          }
                        </div>
                        <div className="px-2 py-1.5">
                          <p className="text-white text-[11px] font-semibold truncate">{v.title}</p>
                          {v.createdAt && (
                            <p className="text-muted-foreground text-[10px] mt-0.5">
                              {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-video max-w-sm rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
                    <p className="text-sm">Player has no swings uploaded yet</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Analysis UI (player video selected) ── */}
        {playerVideoSrc && (
          <div className="space-y-3">
            {/* Drawing Toolbar */}
            <div className="flex items-center justify-center gap-2 py-2 px-3 overflow-x-auto border border-border rounded-lg bg-secondary/20">
              <ToolBtn icon={<MousePointer2 className="w-4 h-4" />} active={activeTool === "select"} tooltip="Select" onClick={() => setActiveTool("select")} />
              <ToolBtn icon={<PenTool className="w-4 h-4" />} active={activeTool === "pen"} tooltip="Freehand" onClick={() => setActiveTool("pen")} />
              <ToolBtn icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="4" x2="12" y2="20" /></svg>} active={activeTool === "line"} tooltip="Straight Line" onClick={() => setActiveTool("line")} />
              <ToolBtn icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="21" x2="21" y2="21" /><line x1="3" y1="21" x2="16" y2="4" /><path d="M10 21 A7 7 0 0 1 8.2 15.5" fill="none" /></svg>} active={activeTool === "angle"} tooltip="Measure Angle" onClick={() => setActiveTool("angle")} />
              <ToolBtn icon={<Circle className="w-4 h-4" />} active={activeTool === "circle"} tooltip="Circle" onClick={() => setActiveTool("circle")} />
              <ToolBtn icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="1" /></svg>} active={activeTool === "rect"} tooltip="Rectangle" onClick={() => setActiveTool("rect")} />
              <ToolBtn icon={<Type className="w-4 h-4" />} active={activeTool === "text"} tooltip="Text Notes" onClick={() => setActiveTool("text")} />

              <div className="w-px h-6 bg-border mx-1 shrink-0" />

              <ToolBtn icon={<Timer className="w-4 h-4" />} active={activeTool === "timer"} tooltip="Frame Timer" onClick={() => setActiveTool("timer")} />

              <div className="w-px h-6 bg-border mx-1 shrink-0" />

              {COLORS.map(c => (
                <div
                  key={c.value}
                  onClick={() => setActiveColor(c.value)}
                  className={`w-6 h-6 rounded-full border-2 cursor-pointer hover:scale-110 transition-transform shrink-0 ${activeColor === c.value ? "border-white scale-110" : "border-background"}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}

              <div className="w-px h-6 bg-border mx-1 shrink-0" />

              <ToolBtn icon={<Undo className="w-4 h-4" />} tooltip="Undo" onClick={undoAnnotation} />
              <ToolBtn icon={<Trash2 className="w-4 h-4" />} tooltip="Clear All" onClick={clearAnnotations} />

              <div className="w-px h-6 bg-border mx-1 shrink-0" />
              <ToolBtn icon={<PersonStanding className="w-4 h-4" />} active={poseEnabled} tooltip="Pose Detection" onClick={() => setPoseEnabled(v => !v)} />

              <div className="ml-auto shrink-0">
                <button
                  onClick={() => { setPlayerVideoSrc(""); setPlayerVideoId(""); setLeftAnnotations([]); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <X size={12} /> {blueprintMode ? "Change pro video" : "Change video"}
                </button>
              </div>
            </div>

            {/* Video panels */}
            <div className={`grid ${blueprintMode ? "" : "md:grid-cols-2"} gap-4`}>
              {/* Player swing */}
              <div
                onClick={() => setActivePanel("left")}
                className={`relative aspect-video rounded-lg overflow-hidden bg-black border-2 transition-colors cursor-pointer ${activePanel === "left" ? "border-primary" : "border-border"}`}
                onPointerDown={(e) => {
                  if (activeTool === "pen" || activeTool === "line" || activeTool === "angle" || activeTool === "circle" || activeTool === "rect") return;
                  if (leftZoom > 1) {
                    leftPanRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, basePanX: leftPanX, basePanY: leftPanY };
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }
                }}
                onPointerMove={(e) => {
                  const p = leftPanRef.current;
                  if (p.dragging) {
                    setLeftPanX(p.basePanX + (e.clientX - p.startX));
                    setLeftPanY(p.basePanY + (e.clientY - p.startY));
                  }
                }}
                onPointerUp={() => { leftPanRef.current.dragging = false; }}
              >
                <video
                  ref={playerVideoRef}
                  src={playerVideoSrc}
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain"
                  style={videoTransform(leftFlipH, leftZoom, leftPanX, leftPanY, leftRotation)}
                  onLoadedMetadata={e => {
                    const dur = (e.target as HTMLVideoElement).duration;
                    setVideoDuration(dur);
                    setHighlightEnd(dur);
                  }}
                  onTimeUpdate={e => {
                    const v = e.target as HTMLVideoElement;
                    setCurrentTime(v.currentTime);
                    if (v.duration > 0) setProgress([v.currentTime / v.duration * 100]);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
                <DrawingCanvas
                  ref={leftAnnotationRef}
                  tool={activePanel === "left" ? activeTool : "select"}
                  color={activeColor}
                  annotations={leftAnnotations}
                  onAnnotationsChange={setLeftAnnotations}
                />
                <PoseOverlay poseResult={poseResult} visible={poseEnabled} videoElement={playerVideoRef.current} />
                <div className="absolute top-2 left-2 text-[10px] font-bold text-white/60 bg-black/40 px-1.5 py-0.5 rounded pointer-events-none">{blueprintMode ? "Pro" : "Player"}</div>
                <div className="absolute top-2 right-2 flex items-center gap-1 pointer-events-auto z-30" onPointerDown={e => e.stopPropagation()}>
                  <button onClick={e => { e.stopPropagation(); setLeftFlipH(f => !f); }} title="Flip horizontal" className="bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded p-1 transition-colors">
                    <FlipHorizontal2 size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setLeftRotation(r => ((r + 90) % 360) as 0 | 90 | 180 | 270); }} title="Rotate" className="bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded p-1 transition-colors">
                    <RotateCw size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setLeftZoom(z => { const nz = Math.max(1, +(z - 0.5).toFixed(1)); if (nz === 1) { setLeftPanX(0); setLeftPanY(0); } return nz; }); }} title="Zoom out" className="bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded p-1 transition-colors">
                    <ZoomOut size={13} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); setLeftZoom(z => +(z + 0.5).toFixed(1)); }} title="Zoom in" className="bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded p-1 transition-colors">
                    <ZoomIn size={13} />
                  </button>
                </div>
                {isRecordingActive && (
                  <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded pointer-events-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> REC {formatTime(recordingTime)}
                  </div>
                )}
              </div>

              {/* Pro video — hidden in blueprint mode */}
              {!blueprintMode && <div
                onClick={() => proVideoSrc && setActivePanel("right")}
                className={`relative aspect-video rounded-lg overflow-hidden bg-black border-2 transition-colors ${proVideoSrc ? (activePanel === "right" ? "border-primary cursor-pointer" : "border-border cursor-pointer") : "border-dashed border-border"}`}
                onPointerDown={(e) => {
                  if (!proVideoSrc) return;
                  if (activeTool === "pen" || activeTool === "line" || activeTool === "angle" || activeTool === "circle" || activeTool === "rect") return;
                  if (rightZoom > 1) {
                    rightPanRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, basePanX: rightPanX, basePanY: rightPanY };
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  }
                }}
                onPointerMove={(e) => {
                  const p = rightPanRef.current;
                  if (p.dragging) {
                    setRightPanX(p.basePanX + (e.clientX - p.startX));
                    setRightPanY(p.basePanY + (e.clientY - p.startY));
                  }
                }}
                onPointerUp={() => { rightPanRef.current.dragging = false; }}
              >
                {proVideoSrc ? (
                  <>
                    <video
                      ref={proVideoRef}
                      src={proVideoSrc}
                      crossOrigin="anonymous"
                      className="w-full h-full object-contain"
                      style={videoTransform(rightFlipH, rightZoom, rightPanX, rightPanY, rightRotation)}
                      onTimeUpdate={e => {
                        if (activePanel === "right" && !synced) {
                          const v = e.target as HTMLVideoElement;
                          setCurrentTime(v.currentTime);
                          if (v.duration > 0) setProgress([v.currentTime / v.duration * 100]);
                        }
                      }}
                      onPlay={() => { if (affectsRight) setIsPlaying(true); }}
                      onPause={() => { if (affectsRight) setIsPlaying(false); }}
                    />
                    <DrawingCanvas
                      ref={rightAnnotationRef}
                      tool={activePanel === "right" ? activeTool : "select"}
                      color={activeColor}
                      annotations={rightAnnotations}
                      onAnnotationsChange={setRightAnnotations}
                    />
                    <div className="absolute top-2 left-2 text-[10px] font-bold text-white/60 bg-black/40 px-1.5 py-0.5 rounded pointer-events-none">Pro</div>
                    <div className="absolute top-2 right-2 flex items-center gap-1 pointer-events-auto z-30" onPointerDown={e => e.stopPropagation()}>
                      <button onClick={e => { e.stopPropagation(); setRightFlipH(f => !f); }} title="Flip horizontal" className="bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded p-1 transition-colors">
                        <FlipHorizontal2 size={13} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setRightRotation(r => ((r + 90) % 360) as 0 | 90 | 180 | 270); }} title="Rotate" className="bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded p-1 transition-colors">
                        <RotateCw size={13} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setRightZoom(z => { const nz = Math.max(1, +(z - 0.5).toFixed(1)); if (nz === 1) { setRightPanX(0); setRightPanY(0); } return nz; }); }} title="Zoom out" className="bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded p-1 transition-colors">
                        <ZoomOut size={13} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setRightZoom(z => +(z + 0.5).toFixed(1)); }} title="Zoom in" className="bg-black/50 hover:bg-black/70 text-white/70 hover:text-white rounded p-1 transition-colors">
                        <ZoomIn size={13} />
                      </button>
                      {!isRecordingActive && (
                        <button
                          onClick={e => { e.stopPropagation(); setProVideoSrc(""); setProVideoId(""); setRightAnnotations([]); }}
                          className="bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                        ><X size={13} /></button>
                      )}
                    </div>
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
              </div>}

            </div>

            {/* Playback Controls */}
            <div className="border border-border rounded-lg bg-secondary/30 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-8 flex items-center">
                  <Slider value={progress} onValueChange={handleSeek} max={100} step={0.1} className="w-full" />
                </div>
                <div className="text-sm font-mono text-muted-foreground w-10 text-right shrink-0">
                  {Math.floor(currentTime)}s
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className={`h-10 w-10 shrink-0 ${synced ? "bg-primary/20 text-primary border-primary/50" : "text-muted-foreground"}`}
                    onClick={() => setSynced(s => !s)}
                    title={synced ? "Videos synced — click to unsync" : "Videos unsynced — click to sync"}
                  >
                    <Link2 className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground" onClick={() => stepFrame(-1)} title="Previous frame">
                    <SkipBack className="w-5 h-5" />
                  </Button>
                  <Button size="icon" className="h-12 w-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={togglePlay}>
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground" onClick={() => stepFrame(1)} title="Next frame">
                    <SkipForward className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 bg-secondary/50 border border-border rounded-md p-1">
                    {SPEEDS.map(s => (
                      <button
                        key={s}
                        onClick={() => { setSpeed(s); if (playerVideoRef.current) playerVideoRef.current.playbackRate = s; if (proVideoRef.current) proVideoRef.current.playbackRate = s; }}
                        className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold transition-colors ${speed === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                  {!synced && (
                    <div className="flex items-center gap-0.5 bg-secondary/50 border border-border rounded-md p-1 text-xs font-semibold text-muted-foreground">
                      <span className="px-1">Active:</span>
                      {(["left", "right"] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setActivePanel(p)}
                          className={`px-2 py-0.5 rounded transition-colors ${activePanel === p ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
                        >
                          {p === "left" ? "Player" : "Pro"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
                  <StopIcon size={12} className="mr-2 fill-current" /> Stop
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

        {/* Notes / Description */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{blueprintMode ? "Description (optional)" : "Coach Notes (optional)"}</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={blueprintMode ? "Describe what this recording covers…" : "Add written feedback to accompany your recording…"}
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
        </div>

        {blueprintMode ? (
          <>
            {/* Blueprint save form */}
            <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Blueprint Details</p>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Title</label>
                <input
                  type="text"
                  value={blueprintTitle}
                  onChange={e => setBlueprintTitle(e.target.value)}
                  placeholder="e.g. Hip Load — Aaron Judge"
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Phase</label>
                <select
                  value={blueprintPhase}
                  onChange={e => setBlueprintPhase(e.target.value)}
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="foundation">Foundation</option>
                  <option value="gather">Gather</option>
                  <option value="lag">Lag</option>
                  <option value="on_plane">On Plane</option>
                  <option value="contact">Contact</option>
                  <option value="finish">Finish</option>
                </select>
              </div>
            </div>
            {saveToBlueprintMutation.isError && (
              <p className="text-sm text-destructive">{(saveToBlueprintMutation.error as Error).message}</p>
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate("/admin")}>Cancel</Button>
              <Button
                onClick={() => saveToBlueprintMutation.mutate()}
                disabled={
                  saveToBlueprintMutation.isPending ||
                  recordingState === "recording" ||
                  recordingState === "uploading" ||
                  !voiceoverKey ||
                  !blueprintTitle.trim()
                }
                className="flex-1 sm:flex-none"
              >
                <Check size={15} className="mr-2" />
                {saveToBlueprintMutation.isPending ? "Saving…" : "Save to Blueprint"}
              </Button>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </Layout>
  );
}

function ToolBtn({ icon, active, tooltip, onClick }: { icon: React.ReactNode; active?: boolean; tooltip: string; onClick?: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={tooltip}
      onClick={onClick}
      className={`h-9 w-9 rounded-md shrink-0 transition-colors ${
        active
          ? "bg-primary/20 text-primary border border-primary/30"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      {icon}
    </Button>
  );
}
