import { useState, useEffect, useRef, useCallback } from "react";

const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

function useHandTracker() {
  const videoRef = useRef(null);
  const [isTracking, setIsTracking] = useState(false);
  const [gesture, setGesture] = useState(null);
  const [landmarks, setLandmarks] = useState(null);
  const [handPosition, setHandPosition] = useState({ x: 0.5, y: 0.5 });
  const [fps, setFps] = useState(0);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const frameCount = useRef(0);
  const lastFpsTime = useRef(Date.now());

  const detectGesture = useCallback((lm) => {
    if (!lm || lm.length === 0) return null;
    const hand = lm[0];
    const thumb = hand[4], index = hand[8], middle = hand[12], ring = hand[16], pinky = hand[20];
    const wrist = hand[0], indexMcp = hand[5], middleMcp = hand[9], ringMcp = hand[13], pinkyMcp = hand[17];
    const thumbIp = hand[3];

    const indexUp = index.y < indexMcp.y - 0.04;
    const middleUp = middle.y < middleMcp.y - 0.04;
    const ringUp = ring.y < ringMcp.y - 0.04;
    const pinkyUp = pinky.y < pinkyMcp.y - 0.04;
    const thumbOut = Math.abs(thumb.x - wrist.x) > 0.06;
    const thumbUp = thumb.y < thumbIp.y - 0.03 && thumb.y < wrist.y - 0.08;

    const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
    if (pinchDist < 0.045) return "pinch";
    if (thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) return "thumbs-up";
    if (!indexUp && !middleUp && !ringUp && !pinkyUp && !thumbOut) return "fist";
    if (indexUp && middleUp && ringUp && pinkyUp && thumbOut) return "open-palm";
    if (indexUp && middleUp && !ringUp && !pinkyUp) return "victory";
    if (indexUp && !middleUp && !ringUp && !pinkyUp) return "pointing";
    return "neutral";
  }, []);

  useEffect(() => {
    let active = true;
    const loadMediaPipe = async () => {
      try {
        if (!window.Hands) {
          const s1 = document.createElement("script");
          s1.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";
          s1.crossOrigin = "anonymous";
          document.head.appendChild(s1);
          await new Promise((r, j) => { s1.onload = r; s1.onerror = j; });
          const s2 = document.createElement("script");
          s2.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
          s2.crossOrigin = "anonymous";
          document.head.appendChild(s2);
          await new Promise((r, j) => { s2.onload = r; s2.onerror = j; });
        }
        const hands = new window.Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.6 });
        hands.onResults((results) => {
          if (!active) return;
          frameCount.current++;
          const now = Date.now();
          if (now - lastFpsTime.current >= 1000) { setFps(frameCount.current); frameCount.current = 0; lastFpsTime.current = now; }
          if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            setLandmarks(results.multiHandLandmarks);
            const idx = results.multiHandLandmarks[0][8];
            setHandPosition({ x: 1 - idx.x, y: idx.y });
            const g = detectGesture(results.multiHandLandmarks);
            setGesture(g);
            // Verbose logging for each detection frame
            try {
              const lm = results.multiHandLandmarks[0].map(p => ({ x: p.x.toFixed(3), y: p.y.toFixed(3), z: p.z.toFixed(3) }));
              console.debug('[useHandTracker] frame', { time: new Date().toISOString(), gesture: g, handPosition: { x: (1-idx.x).toFixed(3), y: idx.y.toFixed(3) }, landmarks: lm.slice(0,5), totalLandmarks: results.multiHandLandmarks[0].length });
            } catch (e) { console.debug('[useHandTracker] logging error', e); }
            setIsTracking(true);
          } else { setIsTracking(false); setGesture(null); setLandmarks(null); }
        });
        handsRef.current = hands;
        if (videoRef.current) {
          const cam = new window.Camera(videoRef.current, {
            onFrame: async () => { if (handsRef.current && videoRef.current) await handsRef.current.send({ image: videoRef.current }); },
            width: 1280, height: 720,
          });
          cam.start();
          cameraRef.current = cam;
        }
      } catch (e) { console.warn("MediaPipe load error:", e); }
    };
    loadMediaPipe();
    return () => { active = false; cameraRef.current?.stop(); handsRef.current?.close(); };
  }, [detectGesture]);

  return { videoRef, isTracking, gesture, landmarks, handPosition, fps };
}

export default useHandTracker;
