import { useState, useEffect, useRef, useCallback } from "react";
import useHandTracker from "./useHandTracker";

// ==================== LIVE GESTURE CANVAS ====================
const HAND_CONNECTIONS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [0,9],[9,10],[10,11],[11,12],
  [0,13],[13,14],[14,15],[15,16],
  [0,17],[17,18],[18,19],[19,20],
  [5,9],[9,13],[13,17],
];

const COLORS = [
  { name: "Neon Pink", value: "#f472b6" },
  { name: "Electric Blue", value: "#60a5fa" },
  { name: "Cyber Purple", value: "#a78bfa" },
  { name: "Matrix Green", value: "#34d399" },
  { name: "Solar Gold", value: "#fbbf24" },
  { name: "Plasma Red", value: "#f87171" },
  { name: "Pure White", value: "#ffffff" },
  { name: "Hot Orange", value: "#fb923c" },
  { name: "Sky Cyan", value: "#22d3ee" },
  { name: "Lime", value: "#a3e635" },
];

const BRUSH_SIZES = [
  { size: 2, label: "XS" },
  { size: 4, label: "S" },
  { size: 8, label: "M" },
  { size: 14, label: "L" },
  { size: 22, label: "XL" },
];

const GESTURE_EFFECTS = {
  "open-palm": { icon: "✋", label: "OPEN PALM", color: "#34d399", action: "Stop Drawing" },
  "fist": { icon: "👊", label: "FIST", color: "#f87171", action: "Eraser Mode" },
  "pinch": { icon: "🤏", label: "PINCH", color: "#fbbf24", action: "Toggle Draw" },
  "victory": { icon: "✌️", label: "VICTORY", color: "#a78bfa", action: "Special" },
  "thumbs-up": { icon: "👍", label: "THUMBS UP", color: "#60a5fa", action: "Confirm" },
  "pointing": { icon: "☝️", label: "POINTING", color: "#f472b6", action: "Draw / Cursor" },
  "neutral": { icon: "🖐", label: "NEUTRAL", color: "rgba(255,255,255,0.4)", action: "Idle" },
};

// useHandTracker now lives in src/useHandTracker.js

// ==================== MAIN COMPONENT ====================
export default function LiveGestureCanvas({ sharedTracker, overrideGesture }) {
  const tracker = sharedTracker || useHandTracker();
  const { videoRef, isTracking, gesture: realGesture, landmarks, handPosition, fps } = tracker;
  const [cameraError, setCameraError] = useState(null);
  const [autoRequested, setAutoRequested] = useState(false);
  const [localOverride, setLocalOverride] = useState(null);
  const gesture = overrideGesture || localOverride || realGesture;

  const [drawingMode, setDrawingMode] = useState(false);
  const [color, setColor] = useState("#f472b6");
  const [brushSize, setBrushSize] = useState(4);
  const [erasing, setErasing] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState([]);
  const [particles, setParticles] = useState([]);
  const [gesturePopups, setGesturePopups] = useState([]);
  const [trailPoints, setTrailPoints] = useState([]);
  const [showPreview, setShowPreview] = useState(true);
  const [showGuide, setShowGuide] = useState(true);

  const lastGestureRef = useRef(null);
  const gestureDebounce = useRef(0);
  const drawingRef = useRef(false);
  const particleId = useRef(0);

  // Gesture handler
  useEffect(() => {
    if (!gesture || gesture === "neutral") return;
    const now = Date.now();
    if (now - gestureDebounce.current < 500) return;
    if (gesture === lastGestureRef.current) return;
    gestureDebounce.current = now;
    lastGestureRef.current = gesture;

    if (gesture === "pinch") { setDrawingMode(d => !d); setErasing(false); }
    if (gesture === "fist" && drawingMode) { setErasing(e => !e); }
    if (gesture === "open-palm") {
      setDrawingMode(false); setErasing(false);
      if (currentStroke.length > 0) { setStrokes(s => [...s, { points: currentStroke, color, size: brushSize }]); setCurrentStroke([]); }
    }

    const effect = GESTURE_EFFECTS[gesture];
    if (effect) {
      const popup = { id: Date.now(), ...effect, x: handPosition.x, y: handPosition.y };
      setGesturePopups(p => [...p, popup]);
      setTimeout(() => setGesturePopups(p => p.filter(pp => pp.id !== popup.id)), 1200);
    }
    spawnParticles(handPosition.x, handPosition.y, effect?.color || "#fff");
  }, [gesture]);

  // Drawing logic
  useEffect(() => {
    if (!isTracking || !drawingMode) {
      if (currentStroke.length > 0) { setStrokes(s => [...s, { points: currentStroke, color: erasing ? "erase" : color, size: brushSize }]); setCurrentStroke([]); }
      drawingRef.current = false;
      return;
    }
    if (gesture === "pointing" || gesture === "pinch") {
      drawingRef.current = true;
      setCurrentStroke(prev => [...prev, { x: handPosition.x, y: handPosition.y }]);
    } else if (drawingRef.current && currentStroke.length > 2) {
      setStrokes(s => [...s, { points: currentStroke, color: erasing ? "erase" : color, size: brushSize }]);
      setCurrentStroke([]); drawingRef.current = false;
    }
  }, [handPosition, isTracking, drawingMode, gesture]);

  // Trail
  useEffect(() => {
    if (!isTracking) return;
    setTrailPoints(prev => [...prev, { x: handPosition.x, y: handPosition.y, t: Date.now(), color: drawingMode ? color : "#a78bfa" }].filter(p => Date.now() - p.t < 350).slice(-25));
  }, [handPosition, isTracking]);

  const spawnParticles = useCallback((x, y, c) => {
    const np = Array.from({ length: 6 }, () => ({ id: particleId.current++, x, y, vx: (Math.random() - 0.5) * 0.06, vy: (Math.random() - 0.5) * 0.06, life: 1, color: c }));
    setParticles(p => [...p, ...np]);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => { setParticles(p => p.map(x => ({ ...x, x: x.x + x.vx, y: x.y + x.vy, life: x.life - 0.04 })).filter(x => x.life > 0)); }, 16);
    return () => clearInterval(iv);
  }, []);

  // Auto-request camera on mount so users don't have to click the debug button
  useEffect(() => {
    if (autoRequested) return;
    let mounted = true;
    (async () => {
      try {
        setAutoRequested(true);
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        if (!mounted) return;
        if (videoRef && videoRef.current) videoRef.current.srcObject = s;
        setCameraError(null);
      } catch (err) {
        if (!mounted) return;
        const msg = err && err.name === 'NotAllowedError' ? 'Camera permission denied' : (err && err.message) || String(err);
        setCameraError(msg);
        console.warn('Auto camera request failed', err);
      }
    })();
    return () => { mounted = false; };
  }, [autoRequested, videoRef]);

  const clearCanvas = () => { setStrokes([]); setCurrentStroke([]); };
  const undoStroke = () => { setStrokes(s => s.slice(0, -1)); };

  const saveImage = useCallback(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0a0010";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(stroke => {
      if (stroke.color === "erase" || stroke.points.length < 2) return;
      ctx.beginPath(); ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.size * 2;
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.shadowColor = stroke.color; ctx.shadowBlur = 12;
      stroke.points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x * 1280, p.y * 720); else ctx.lineTo(p.x * 1280, p.y * 720); });
      ctx.stroke();
    });
    const link = document.createElement("a"); link.download = `drawing-${Date.now()}.png`; link.href = canvas.toDataURL(); link.click();
  }, [strokes]);

  // enableClicks removed — overlays are interactive by default; gestures control games

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {/* Debug panel */}
      <div style={{ position: "fixed", left: 12, top: 70, zIndex: 300, background: "rgba(0,0,0,0.6)", padding: 10, borderRadius: 8, border: "1px solid rgba(124,58,237,0.2)", color: "#fff", fontSize: 12 }}>
        <div style={{ marginBottom: 6, fontWeight: 700, color: "#a78bfa" }}>Tracker</div>
        <div>Tracking: {isTracking ? "yes" : "no"}</div>
        <div>Gesture: {gesture || "—"}</div>
        <div>FPS: {fps}</div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button onClick={async () => {
            try {
              const s = await navigator.mediaDevices.getUserMedia({ video: true });
              if (videoRef.current) videoRef.current.srcObject = s;
            } catch (e) { console.warn('camera request failed', e); }
          }} style={{ padding: "6px 8px", borderRadius: 6 }}>Request Camera</button>
          <button onClick={() => { setLocalOverride('pinch'); setTimeout(() => setLocalOverride(null), 300); }} style={{ padding: "6px 8px", borderRadius: 6 }}>Simulate Pinch</button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={enableClicks} onChange={(e) => setEnableClicks(e.target.checked)} /> Enable Clicks
          </label>
        </div>
      </div>
      {/* LEFT SIDE: Camera + Drawing Canvas */}
      <div style={{ flex: "1 1 600px", minWidth: 0 }}>

        {/* Main camera/drawing area */}
        <div style={{
          position: "relative", width: "100%", paddingBottom: "56.25%",
          borderRadius: 16, overflow: "hidden",
          border: `2px solid ${isTracking ? (drawingMode ? color + "88" : "rgba(52,211,153,0.5)") : "rgba(124,58,237,0.3)"}`,
          boxShadow: isTracking ? `0 0 25px ${drawingMode ? color + "33" : "rgba(52,211,153,0.15)"}` : "none",
          transition: "all 0.3s",
        }}>
          <video ref={videoRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", pointerEvents: 'none' }} autoPlay playsInline muted />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)", pointerEvents: 'none' }} />

          {/* Permission / preview banner */}
          {cameraError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 250 }}>
              <div style={{ background: 'rgba(0,0,0,0.8)', padding: 14, borderRadius: 10, textAlign: 'center', border: '1px solid rgba(167,139,250,0.12)' }}>
                <div style={{ fontWeight: 700, color: '#f472b6', marginBottom: 6 }}>Camera access required</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>The app needs camera permission to detect your hand.</div>
                <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{cameraError}</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button onClick={async () => {
                    try { setCameraError(null); const s = await navigator.mediaDevices.getUserMedia({ video: true }); if (videoRef && videoRef.current) videoRef.current.srcObject = s; }
                    catch (e) { setCameraError((e && e.message) || String(e)); }
                  }} style={{ padding: '8px 12px', borderRadius: 8 }}>Retry</button>
                  <button onClick={() => { setCameraError('You can grant camera via browser site settings for localhost.'); }} style={{ padding: '8px 12px', borderRadius: 8 }}>How to enable</button>
                </div>
              </div>
            </div>
          )}

          {/* Hand skeleton */}
          {landmarks && landmarks.map((hand, hIdx) => (
            <svg key={hIdx} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: 'auto' }}>
              {HAND_CONNECTIONS.map(([a, b], i) => (
                <line key={i} x1={`${(1 - hand[a].x) * 100}%`} y1={`${hand[a].y * 100}%`} x2={`${(1 - hand[b].x) * 100}%`} y2={`${hand[b].y * 100}%`} stroke="#a78bfa" strokeWidth="2" opacity="0.6" strokeLinecap="round" />
              ))}
              {hand.map((lm, i) => (
                <circle key={i} cx={`${(1 - lm.x) * 100}%`} cy={`${lm.y * 100}%`} r={i === 8 ? 7 : i === 4 ? 5 : 3} fill={i === 8 ? "#f472b6" : i === 4 ? "#fbbf24" : "#fff"} opacity={i === 8 || i === 4 ? 1 : 0.6} />
              ))}
            </svg>
          ))}

          {/* Strokes overlay */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: 'auto' }} viewBox="0 0 100 56.25" preserveAspectRatio="none">
            {strokes.map((stroke, i) => {
              if (stroke.color === "erase" || stroke.points.length < 2) return null;
              return <polyline key={i} points={stroke.points.map(p => `${p.x * 100},${p.y * 56.25}`).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.size * 0.12} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 2px ${stroke.color})` }} />;
            })}
            {currentStroke.length > 1 && (
              <polyline points={currentStroke.map(p => `${p.x * 100},${p.y * 56.25}`).join(" ")} fill="none" stroke={erasing ? "#f87171" : color} strokeWidth={brushSize * 0.12} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={erasing ? "1,1" : "none"} style={{ filter: `drop-shadow(0 0 3px ${erasing ? "#f87171" : color})` }} />
            )}
          </svg>

          {/* Trail */}
          {trailPoints.length > 1 && (
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: 'auto' }} viewBox="0 0 100 56.25" preserveAspectRatio="none">
              {trailPoints.map((pt, i) => i > 0 && (
                <circle key={i} cx={pt.x * 100} cy={pt.y * 56.25} r={0.3 * (1 - i / trailPoints.length)} fill={pt.color} opacity={0.6 * (1 - i / trailPoints.length)} />
              ))}
            </svg>
          )}

          {/* Particles */}
          {particles.map(p => (
            <div key={p.id} style={{ position: "absolute", left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: 5 * p.life, height: 5 * p.life, borderRadius: "50%", background: p.color, boxShadow: `0 0 6px ${p.color}`, opacity: p.life, transform: "translate(-50%,-50%)", pointerEvents: 'none' }} />
          ))}

          {/* Gesture popups */}
          {gesturePopups.map(popup => (
            <div key={popup.id} style={{ position: "absolute", left: `${popup.x * 100}%`, top: `${popup.y * 100}%`, transform: "translate(-50%,-130%)", background: "rgba(0,0,0,0.85)", border: `1px solid ${popup.color}55`, borderRadius: 10, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, animation: "feedback-pop 0.4s ease-out", pointerEvents: 'auto' }}>
              <span style={{ fontSize: 18 }}>{popup.icon}</span>
              <span style={{ color: popup.color, fontWeight: 700, fontSize: 11 }}>{popup.label}</span>
            </div>
          ))}

          {/* Cursor */}
          {isTracking && (
            <div style={{ position: "absolute", left: `${handPosition.x * 100}%`, top: `${handPosition.y * 100}%`, width: drawingMode ? brushSize * 2 + 8 : 18, height: drawingMode ? brushSize * 2 + 8 : 18, borderRadius: "50%", border: `2px solid ${drawingMode ? (erasing ? "#f87171" : color) : "#a78bfa"}`, boxShadow: `0 0 10px ${drawingMode ? (erasing ? "#f87171" : color) : "#a78bfa"}`, transform: "translate(-50%,-50%)", pointerEvents: "none", transition: "width 0.1s, height 0.1s" }}>
              {drawingMode && <div style={{ position: "absolute", inset: "25%", borderRadius: "50%", background: erasing ? "#f87171" : color, opacity: 0.5 }} />}
            </div>
          )}

          {/* Status badge */}
          <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", borderRadius: 8, padding: "5px 10px", display: "flex", gap: 10, alignItems: "center", border: "1px solid rgba(124,58,237,0.2)" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: isTracking ? "#34d399" : "#f87171", boxShadow: `0 0 6px ${isTracking ? "#34d399" : "#f87171"}` }} />
            <span style={{ color: "#a78bfa", fontSize: 10 }}>{fps} FPS</span>
            {drawingMode && <span style={{ color: erasing ? "#f87171" : color, fontSize: 10, fontWeight: 600 }}>{erasing ? "ERASER" : "DRAWING"}</span>}
          </div>

          {/* Gesture label top-right */}
          {gesture && gesture !== "neutral" && GESTURE_EFFECTS[gesture] && (
            <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", borderRadius: 8, padding: "5px 10px", display: "flex", alignItems: "center", gap: 6, border: `1px solid ${GESTURE_EFFECTS[gesture].color}33` }}>
              <span style={{ fontSize: 16 }}>{GESTURE_EFFECTS[gesture].icon}</span>
              <span style={{ color: GESTURE_EFFECTS[gesture].color, fontWeight: 700, fontSize: 11 }}>{GESTURE_EFFECTS[gesture].label}</span>
            </div>
          )}

          {/* Waiting for camera */}
          {!isTracking && !landmarks && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: 52, marginBottom: 12, animation: "float 2s ease-in-out infinite" }}>🖐</div>
              <div style={{ color: "#a78bfa", fontSize: 16, fontWeight: 700 }}>Show your hand to the camera</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6 }}>Allow camera access to start</div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE: Controls + Preview + Guide */}
      <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* COLOR PALETTE PANEL */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: 16, backdropFilter: "blur(8px)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            🎨 Color Palette
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 14 }}>
            {COLORS.map(c => (
              <div key={c.value} onClick={() => { setColor(c.value); setErasing(false); }}
                style={{
                  width: "100%", aspectRatio: "1", borderRadius: 10, cursor: "pointer",
                  background: c.value,
                  border: color === c.value ? "3px solid #fff" : "2px solid rgba(255,255,255,0.1)",
                  boxShadow: color === c.value ? `0 0 14px ${c.value}, inset 0 0 8px rgba(255,255,255,0.3)` : `0 0 4px ${c.value}44`,
                  transform: color === c.value ? "scale(1.15)" : "scale(1)",
                  transition: "all 0.15s",
                }} title={c.name} />
            ))}
          </div>

          {/* Current color preview */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.3)" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: color, boxShadow: `0 0 10px ${color}` }} />
            <div>
              <div style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>Active Color</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{COLORS.find(c => c.value === color)?.name || color}</div>
            </div>
          </div>
        </div>

        {/* BRUSH SIZE PANEL */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: 16, backdropFilter: "blur(8px)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 10 }}>✏️ Brush Size</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", justifyContent: "center" }}>
            {BRUSH_SIZES.map(b => (
              <div key={b.size} onClick={() => setBrushSize(b.size)}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }}>
                <div style={{
                  width: b.size + 14, height: b.size + 14, borderRadius: "50%",
                  background: brushSize === b.size ? color : "rgba(255,255,255,0.1)",
                  border: brushSize === b.size ? "2px solid #fff" : "1px solid rgba(255,255,255,0.2)",
                  boxShadow: brushSize === b.size ? `0 0 10px ${color}` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "all 0.15s",
                }}>
                  <div style={{ width: b.size, height: b.size, borderRadius: "50%", background: brushSize === b.size ? "#fff" : "rgba(255,255,255,0.4)" }} />
                </div>
                <span style={{ fontSize: 9, color: brushSize === b.size ? color : "rgba(255,255,255,0.4)", fontWeight: 600 }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TOOLS */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: 12, backdropFilter: "blur(8px)", display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button onClick={() => { setDrawingMode(d => !d); setErasing(false); }}
            style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", background: drawingMode ? "linear-gradient(135deg, #7c3aed, #db2777)" : "rgba(255,255,255,0.08)", color: drawingMode ? "#fff" : "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 11 }}>
            {drawingMode ? "✏️ ON" : "✏️ Draw"}
          </button>
          <button onClick={() => setErasing(e => !e)}
            style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", background: erasing ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.08)", color: erasing ? "#f87171" : "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 11 }}>
            🧹 {erasing ? "ON" : "Erase"}
          </button>
          <button onClick={undoStroke} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 11 }}>↩️ Undo</button>
          <button onClick={clearCanvas} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(248,113,113,0.1)", color: "#f87171", fontWeight: 700, fontSize: 11 }}>🗑️ Clear</button>
          <button onClick={saveImage} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(96,165,250,0.1)", color: "#60a5fa", fontWeight: 700, fontSize: 11 }}>📸 Save</button>
          <button onClick={() => setShowPreview(p => !p)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", background: showPreview ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.08)", color: showPreview ? "#34d399" : "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: 11 }}>👁 Preview</button>
        </div>

        {/* CANVAS PREVIEW - shows drawing only (no camera) */}
        {showPreview && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: 12, backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#34d399", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              🖼️ Canvas Preview
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>({strokes.length} strokes)</span>
            </div>
            <div style={{
              position: "relative", width: "100%", paddingBottom: "56.25%",
              borderRadius: 10, overflow: "hidden",
              background: "linear-gradient(135deg, #0a0010, #0d0020)",
              border: "1px solid rgba(124,58,237,0.15)",
            }}>
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 100 56.25" preserveAspectRatio="none">
                {strokes.map((stroke, i) => {
                  if (stroke.color === "erase" || stroke.points.length < 2) return null;
                  return <polyline key={i} points={stroke.points.map(p => `${p.x * 100},${p.y * 56.25}`).join(" ")} fill="none" stroke={stroke.color} strokeWidth={stroke.size * 0.12} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${stroke.color})` }} />;
                })}
                {currentStroke.length > 1 && (
                  <polyline points={currentStroke.map(p => `${p.x * 100},${p.y * 56.25}`).join(" ")} fill="none" stroke={erasing ? "#f87171" : color} strokeWidth={brushSize * 0.12} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
                )}
              </svg>
              {strokes.length === 0 && currentStroke.length === 0 && (
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.2)", fontSize: 11 }}>
                  Your drawing appears here
                </div>
              )}
            </div>
          </div>
        )}

        {/* HOW TO DRAW GUIDE */}
        {showGuide && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: 14, backdropFilter: "blur(8px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24" }}>📖 How to Draw</div>
              <button onClick={() => setShowGuide(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { step: "1", icon: "🤏", text: "Pinch to start drawing mode", color: "#fbbf24" },
                { step: "2", icon: "☝️", text: "Point finger = your pen moves", color: "#f472b6" },
                { step: "3", icon: "✋", text: "Open palm = stop / finish", color: "#34d399" },
                { step: "4", icon: "👊", text: "Fist = switch to eraser", color: "#f87171" },
                { step: "5", icon: "🤏", text: "Pinch again = toggle off", color: "#fbbf24" },
              ].map(item => (
                <div key={item.step} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 8, background: "rgba(0,0,0,0.2)" }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: `${item.color}22`, border: `1px solid ${item.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: item.color, fontWeight: 800, flexShrink: 0 }}>{item.step}</div>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>{item.text}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.15)" }}>
              <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600, marginBottom: 4 }}>💡 Tips</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                • Move finger slowly for smooth lines<br />
                • Select color/size before drawing<br />
                • Use Undo to fix mistakes<br />
                • Click Save to download your art
              </div>
            </div>
          </div>
        )}

        {/* Gesture Reference */}
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: 12, backdropFilter: "blur(8px)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>✋ Gestures</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(GESTURE_EFFECTS).filter(([k]) => k !== "neutral").map(([key, val]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 6px", borderRadius: 6, background: gesture === key ? `${val.color}15` : "transparent", transition: "background 0.2s" }}>
                <span style={{ fontSize: 16 }}>{val.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: gesture === key ? val.color : "rgba(255,255,255,0.5)", flex: 1 }}>{val.label}</span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)" }}>{val.action}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
