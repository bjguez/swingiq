import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";

let poseLandmarker: PoseLandmarker | null = null;
let initPromise: Promise<PoseLandmarker> | null = null;

const MEDIAPIPE_CDN = "/mediapipe/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export async function initPoseDetector(): Promise<PoseLandmarker> {
  if (poseLandmarker) return poseLandmarker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log("[PoseDetector] Loading WASM...");
    const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_CDN);
    console.log("[PoseDetector] WASM loaded, creating PoseLandmarker...");
    try {
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      console.log("[PoseDetector] Created with GPU delegate");
    } catch (gpuErr) {
      console.warn("[PoseDetector] GPU failed, falling back to CPU:", gpuErr);
      poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numPoses: 1,
      });
      console.log("[PoseDetector] Created with CPU delegate");
    }
    return poseLandmarker;
  })();

  return initPromise;
}

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseResult {
  landmarks: PoseLandmark[];
  jointAngles: JointAngles;
  phase: SwingPhase;
}

export interface JointAngles {
  leftElbow: number;
  rightElbow: number;
  leftShoulder: number;
  rightShoulder: number;
  leftHip: number;
  rightHip: number;
  leftKnee: number;
  rightKnee: number;
  trunkAngle: number;
  shoulderRotation: number;
}

export type SwingPhase = "Gather" | "Touchdown" | "Thrust" | "Contact" | "Post-Contact" | "Unknown";

export const LANDMARK_NAMES: Record<number, string> = {
  0: "nose", 1: "left_eye_inner", 2: "left_eye", 3: "left_eye_outer",
  4: "right_eye_inner", 5: "right_eye", 6: "right_eye_outer",
  7: "left_ear", 8: "right_ear", 9: "mouth_left", 10: "mouth_right",
  11: "left_shoulder", 12: "right_shoulder", 13: "left_elbow", 14: "right_elbow",
  15: "left_wrist", 16: "right_wrist", 17: "left_pinky", 18: "right_pinky",
  19: "left_index", 20: "right_index", 21: "left_thumb", 22: "right_thumb",
  23: "left_hip", 24: "right_hip", 25: "left_knee", 26: "right_knee",
  27: "left_ankle", 28: "right_ankle", 29: "left_heel", 30: "right_heel",
  31: "left_foot_index", 32: "right_foot_index",
};

export const SKELETON_CONNECTIONS: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [24, 26], [26, 28],
  [27, 29], [29, 31], [28, 30], [30, 32],
  [15, 17], [15, 19], [15, 21], [16, 18], [16, 20], [16, 22],
];

export const UPPER_BODY_INDICES = new Set([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
export const LOWER_BODY_INDICES = new Set([23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);

function calcAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);
  if (magAB === 0 || magCB === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.round((Math.acos(cosAngle) * 180) / Math.PI);
}

export function computeJointAngles(lm: PoseLandmark[]): JointAngles {
  if (lm.length < 33) {
    return { leftElbow: 0, rightElbow: 0, leftShoulder: 0, rightShoulder: 0, leftHip: 0, rightHip: 0, leftKnee: 0, rightKnee: 0, trunkAngle: 0, shoulderRotation: 0 };
  }

  const leftElbow = calcAngle(lm[11], lm[13], lm[15]);
  const rightElbow = calcAngle(lm[12], lm[14], lm[16]);
  const leftShoulder = calcAngle(lm[13], lm[11], lm[23]);
  const rightShoulder = calcAngle(lm[14], lm[12], lm[24]);
  const leftHip = calcAngle(lm[11], lm[23], lm[25]);
  const rightHip = calcAngle(lm[12], lm[24], lm[26]);
  const leftKnee = calcAngle(lm[23], lm[25], lm[27]);
  const rightKnee = calcAngle(lm[24], lm[26], lm[28]);

  const midShoulder = { x: (lm[11].x + lm[12].x) / 2, y: (lm[11].y + lm[12].y) / 2, z: 0, visibility: 1 };
  const midHip = { x: (lm[23].x + lm[24].x) / 2, y: (lm[23].y + lm[24].y) / 2, z: 0, visibility: 1 };
  const vertical = { x: midHip.x, y: midHip.y - 0.2, z: 0, visibility: 1 };
  const trunkAngle = calcAngle(midShoulder, midHip, vertical);

  const shoulderDx = lm[12].x - lm[11].x;
  const shoulderDy = lm[12].y - lm[11].y;
  const shoulderRotation = Math.round(Math.atan2(shoulderDy, shoulderDx) * (180 / Math.PI));

  return { leftElbow, rightElbow, leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, trunkAngle, shoulderRotation };
}

// Phase conditions are evaluated in priority order: Gather → Touchdown → Thrust → Contact → Post-Contact.
// Thrust and Contact share similar heuristics; Thrust requires stricter hip bend (< 155) vs Contact (< 165)
// and higher trunk lean (> 15 vs > 10). If the order changes, frames at Contact may be misclassified as Thrust.
export function detectSwingPhase(lm: PoseLandmark[], angles: JointAngles): SwingPhase {
  if (lm.length < 33) return "Unknown";

  const handsY = (lm[15].y + lm[16].y) / 2;
  const shouldersY = (lm[11].y + lm[12].y) / 2;
  const hipsY = (lm[23].y + lm[24].y) / 2;
  const handsX = (lm[15].x + lm[16].x) / 2;
  const hipsX = (lm[23].x + lm[24].x) / 2;

  const frontKnee = Math.min(angles.leftKnee, angles.rightKnee);
  const backKnee = Math.max(angles.leftKnee, angles.rightKnee);
  const avgHipAngle = (angles.leftHip + angles.rightHip) / 2;

  const handsNearShoulders = Math.abs(handsY - shouldersY) < 0.12;
  const handsAboveShoulders = handsY < shouldersY - 0.05;
  const handsFarForward = Math.abs(handsX - hipsX) > 0.25;
  const handsExtended = Math.abs(handsX - hipsX) > 0.35;

  if (handsNearShoulders && frontKnee > 140 && !handsFarForward) {
    return "Gather";
  }

  if (handsNearShoulders && frontKnee < 160 && avgHipAngle < 160) {
    return "Touchdown";
  }

  if (angles.trunkAngle > 15 && avgHipAngle < 155 && handsFarForward && !handsExtended) {
    return "Thrust";
  }

  if (handsFarForward && avgHipAngle < 165 && angles.trunkAngle > 10) {
    return "Contact";
  }

  if (handsExtended || handsAboveShoulders) {
    return "Post-Contact";
  }

  return "Unknown";
}

let detecting = false;
let lastTimestamp = -1;

export function resetPoseDetector() {
  detecting = false;
  lastTimestamp = -1;
}

export async function detectPose(video: HTMLVideoElement, timestampMs: number): Promise<PoseResult | null> {
  if (detecting) return null;
  if (video.readyState < 2) return null;

  const ts = Math.max(timestampMs, lastTimestamp + 1);
  lastTimestamp = ts;

  try {
    detecting = true;
    const detector = await initPoseDetector();
    const result = detector.detectForVideo(video, ts);

    if (!result.landmarks || result.landmarks.length === 0) return null;

    const landmarks: PoseLandmark[] = result.landmarks[0].map(lm => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? 0,
    }));

    const jointAngles = computeJointAngles(landmarks);
    const phase = detectSwingPhase(landmarks, jointAngles);

    return { landmarks, jointAngles, phase };
  } catch (e) {
    console.warn("[PoseDetector] Detection error:", e);
    return null;
  } finally {
    detecting = false;
  }
}

export { DrawingUtils };
