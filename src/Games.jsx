import { useState, useEffect, useRef, useCallback } from "react";

function TicTacToe({ gesture, handPosition, onScore }) {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [hover, setHover] = useState(null);
  const lastPinch = useRef(0);

  useEffect(() => {
    if (!gesture || gesture !== "pointing") { setHover(null); return; }
    // map handPosition to cell
    const x = Math.floor(handPosition.x * 3);
    const y = Math.floor(handPosition.y * 3);
    const cell = Math.min(8, Math.max(0, y * 3 + x));
    setHover(cell);
  }, [gesture, handPosition]);

  useEffect(() => {
    if (gesture === "pinch") {
      const now = Date.now();
      if (now - lastPinch.current < 600) return; lastPinch.current = now;
      if (hover === null) return;
      setBoard(b => { if (b[hover]) return b; const nb = b.slice(); nb[hover] = turn; setTurn(t => t === "X" ? "O" : "X"); return nb; });
    }
  }, [gesture, hover, turn]);

  const winner = (b) => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b1,c] of lines) if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
    return null;
  };

  const w = winner(board);

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ marginBottom: 8 }}>Tic Tac Toe — Point to hover, Pinch to place</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, width: 300 }}>
        {board.map((v, i) => (
          <div key={i} style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", background: hover===i?"#7c3aed44":"rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 36, fontWeight: 800 }}>{v || (hover===i?"•":"")}</div>
        ))}
      </div>
      <div style={{ marginTop: 8 }}>{w ? `Winner: ${w}` : `Turn: ${turn}`}</div>
    </div>
  );
}

function Runner({ gesture, onScore }) {
  const [pos, setPos] = useState(0);
  const [alive, setAlive] = useState(true);
  useEffect(() => { const iv = setInterval(() => { if (alive) setPos(p => p + 1); }, 200); return () => clearInterval(iv); }, [alive]);
  useEffect(() => { if (gesture === "pinch") setPos(p => p + 20); }, [gesture]);
  useEffect(() => { if (pos > 200) setAlive(false); }, [pos]);
  useEffect(() => { onScore && onScore(Math.floor(pos/10)); }, [pos]);
  return (
    <div style={{ padding: 12 }}>
      <h3>Runner — Pinch to boost</h3>
      <div style={{ height: 80, background: "linear-gradient(90deg,#0b1220,#14203a)", borderRadius: 12, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: `${Math.min(90, pos/3)}%`, bottom: 10, width: 40, height: 40, borderRadius: 8, background: alive?"#fbbf24":"#777" }} />
      </div>
      <div style={{ marginTop: 8 }}>{alive ? `Distance: ${pos}` : `Game Over — Distance ${pos}`}</div>
    </div>
  );
}

function Match3({ gesture, handPosition, onScore }) {
  const [grid, setGrid] = useState(() => Array.from({length: 6*6}, () => Math.floor(Math.random()*5)));
  const [sel, setSel] = useState(null);
  const lastPinch = useRef(0);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (gesture === "pinch") {
      const now = Date.now(); if (now - lastPinch.current < 500) return; lastPinch.current = now;
      const x = Math.floor(handPosition.x * 6);
      const y = Math.floor(handPosition.y * 6);
      const idx = Math.min(35, Math.max(0, y*6 + x));
      if (sel === null) { setSel(idx); }
      else { // swap with simple animation (swap values then check matches)
        const a = sel, b = idx; setSel(null);
        setGrid(g => {
          const n = g.slice(); const t = n[a]; n[a] = n[b]; n[b] = t; return n;
        });
        // award points for swap
        setScore(s => { const ns = s + 100; onScore && onScore(100); return ns; });
      }
    }
  }, [gesture, handPosition, sel]);

  return (
    <div style={{ padding: 12 }}>
      <h3>Match-3 — Pinch to select/swap</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 40px)", gap: 6 }}>
        {grid.map((v,i) => (
          <div key={i} style={{ width:40, height:40, borderRadius:6, background: sel===i?"#34d399":"#111", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", transition:"transform 180ms" }}>{v}</div>
        ))}
      </div>
      <div style={{ marginTop:8, color:"#a78bfa" }}>Score: {score}</div>
    </div>
  );
}

export default function Games({ gesture, handPosition, onScore }) {
  const [tab, setTab] = useState("tic");
  const [kbOverride, setKbOverride] = useState(null);
  const containerRef = useRef(null);
  const [focused, setFocused] = useState(false);
  

  const activeGesture = kbOverride || gesture;
  const activeHandPos = handPosition || null;

  // Keyboard controls: use a focusable container so keys work without global listeners
  useEffect(() => { if (containerRef.current) containerRef.current.focus(); }, []);

  const onKey = (e) => {
    // keyboard still supports gesture overrides (pinch/open-palm)
    if (e.code === 'Space' || e.key === 'Enter') { setKbOverride('pinch'); setTimeout(() => setKbOverride(null), 220); }
    if (e.key === 'o') { setKbOverride('open-palm'); setTimeout(() => setKbOverride(null), 220); }
  };

  // pinch simulation duration (ms)
  const [pinchMs, setPinchMs] = useState(() => { try { return parseInt(localStorage.getItem('vr_pinch_ms')||'220',10); } catch { return 220; } });
  useEffect(() => { localStorage.setItem('vr_pinch_ms', String(pinchMs)); }, [pinchMs]);

  const simulatePinch = (dur = pinchMs) => { setKbOverride('pinch'); setTimeout(() => setKbOverride(null), dur); };
  return (
    <div tabIndex={0} ref={containerRef} onKeyDown={onKey} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ outline: 'none', boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.25)' : 'none', borderRadius: 8 }}>
      <div style={{ display:"flex", gap:8, marginBottom:12 }}>
        <button onClick={() => setTab("tic")} style={{ padding:8, borderRadius:8 }}>Tic Tac Toe</button>
        <button onClick={() => setTab("run")} style={{ padding:8, borderRadius:8 }}>Runner</button>
        <button onClick={() => setTab("match")} style={{ padding:8, borderRadius:8 }}>Match-3</button>
        <div style={{ marginLeft:"auto", color:"#a78bfa", fontSize:13 }}>Gesture: {gesture}</div>
      </div>
      <div style={{ background:"rgba(255,255,255,0.02)", padding:16, borderRadius:12, position: 'relative' }}>
        {/* Cursor removed — UI is gesture-first; keyboard still supports pinch/overrides */}

        {tab === "tic" && <TicTacToe gesture={activeGesture} handPosition={activeHandPos} onScore={onScore} />}
        {tab === "run" && <Runner gesture={activeGesture} onScore={onScore} />}
        {tab === "match" && <Match3 gesture={activeGesture} handPosition={activeHandPos} onScore={onScore} />}

        {/* Keyboard help removed — keyboard fallback works via focusable container */}
      </div>
    </div>
  );
}
