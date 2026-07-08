import { useState, useEffect, useRef, useCallback } from "react";
import LiveGestureCanvas from "./LiveGestureCanvas";
import Games from "./Games";
import useHandTracker from "./useHandTracker";

const NOTES = {
  piano: { C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 },
  guitar: { Em: [329.63,246.94,196.00,164.81,123.47,82.41], Am: [440.00,329.63,261.63,220.00,164.81], G: [392.00,329.63,246.94,196.00,146.83,98.00], C: [523.25,392.00,329.63,261.63,196.00], D: [587.33,440.00,349.23,293.66,220.00], F: [698.46,523.25,349.23,349.23,261.63] },
};
const CHORD_ZONES = ["Em","Am","G","C","D","F"];
const WHITE_KEYS = ["C4","D4","E4","F4","G4","A4","B4","C5","D5","E5","F5","G5"];
const BLACK_KEYS = {"C#4":1,"D#4":2,"F#4":4,"G#4":5,"A#4":6,"C#5":8,"D#5":9,"F#5":11};

const LEADERBOARD = [
  {rank:1,name:"NeonPhantom",score:98420,instrument:"Guitar",badge:"🏆"},
  {rank:2,name:"SynthWitch",score:87350,instrument:"Piano",badge:"🥈"},
  {rank:3,name:"VoidDrummer",score:76900,instrument:"Drums",badge:"🥉"},
  {rank:4,name:"GlitchMaestro",score:65200,instrument:"Guitar",badge:"⭐"},
  {rank:5,name:"QuantumBeat",score:54100,instrument:"Piano",badge:"⭐"},
];

const ACHIEVEMENTS = [
  {id:1,icon:"🎸",title:"First Strum",desc:"Play your first guitar chord",unlocked:true},
  {id:2,icon:"🎹",title:"Tickle the Keys",desc:"Play 10 piano notes",unlocked:true},
  {id:3,icon:"🥁",title:"Keep the Beat",desc:"Maintain a 16-beat combo",unlocked:false},
  {id:4,icon:"🔥",title:"On Fire",desc:"Score 50,000 in rhythm mode",unlocked:false},
  {id:5,icon:"✋",title:"Hand Tracker",desc:"Complete a Gesture Arcade game",unlocked:false},
  {id:6,icon:"🎨",title:"Air Artist",desc:"Score 90%+ in Air Drawing",unlocked:false},
];

function useAudioEngine() {
  const ctx = useRef(null);
  const init = useCallback(() => {
    if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.current.state === "suspended") ctx.current.resume();
  }, []);
  const playTone = useCallback((freq, type = "sine", duration = 0.3, vol = 0.3) => {
    init(); const ac = ctx.current; const osc = ac.createOscillator(); const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination); osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime); gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
    osc.start(ac.currentTime); osc.stop(ac.currentTime + duration);
  }, [init]);
  const playChord = useCallback((freqs) => { freqs.forEach((f, i) => setTimeout(() => playTone(f, "sawtooth", 0.6, 0.12), i * 20)); }, [playTone]);
  const playDrum = useCallback((type) => {
    init(); const ac = ctx.current;
    if (type === "kick") { const o = ac.createOscillator(); const g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.setValueAtTime(150, ac.currentTime); o.frequency.exponentialRampToValueAtTime(0.01, ac.currentTime + 0.5); g.gain.setValueAtTime(1, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.5); o.start(); o.stop(ac.currentTime + 0.5); }
    else { const buf = ac.createBuffer(1, ac.sampleRate * 0.15, ac.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const src = ac.createBufferSource(); const g = ac.createGain(); const f = ac.createBiquadFilter(); src.buffer = buf; f.type = type === "hihat" ? "highpass" : "bandpass"; f.frequency.value = type === "hihat" ? 8000 : 3000; src.connect(f); f.connect(g); g.connect(ac.destination); g.gain.setValueAtTime(0.6, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15); src.start(); src.stop(ac.currentTime + 0.15); }
  }, [init]);
  return { playTone, playChord, playDrum };
}

function NeonParticle({ x, y, color }) {
  return <div style={{ position:"absolute", left:x, top:y, width:6, height:6, borderRadius:"50%", background:color, boxShadow:`0 0 10px ${color}, 0 0 20px ${color}`, animation:"particle-burst 0.8s ease-out forwards", pointerEvents:"none", transform:"translate(-50%,-50%)" }} />;
}

function GuitarMode({ onScore, gesture, handPosition }) {
  const { playChord } = useAudioEngine();
  const [activeChord, setActiveChord] = useState(null);
  const [combo, setCombo] = useState(0);
  const [strumFlash, setStrumFlash] = useState(false);
  const lastY = useRef(null);
  const containerRef = useRef(null);

  const strum = useCallback((chord, dir, e) => {
    if (!chord) return;
    playChord(NOTES.guitar[chord]);
    setStrumFlash(true); setCombo(c => c + 1); onScore(100 + combo * 10);
    setTimeout(() => setStrumFlash(false), 300);
  }, [playChord, combo, onScore]);

  // gesture: pinch to strum, pointing to choose chord by x position
  useEffect(() => {
    if (!gesture) return;
    if (gesture === "pinch") { if (activeChord) strum(activeChord, "down"); }
    if (gesture === "pointing" && handPosition) {
      const x = Math.floor(handPosition.x * CHORD_ZONES.length);
      const chord = CHORD_ZONES[Math.min(CHORD_ZONES.length-1, Math.max(0, x))];
      setActiveChord(chord);
    }
  }, [gesture, handPosition]);

  const handleMouseMove = useCallback((e) => {
    if (!activeChord) return;
    if (lastY.current !== null) { const d = e.clientY - lastY.current; if (Math.abs(d) > 15) { strum(activeChord, d > 0 ? "down" : "up", e); lastY.current = e.clientY; } }
    else lastY.current = e.clientY;
  }, [activeChord, strum]);

  return (
    <div ref={containerRef} style={{ position:"relative", userSelect:"none" }} onMouseMove={handleMouseMove} onMouseLeave={() => { lastY.current = null; }}>
      <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
        {CHORD_ZONES.map(chord => (
          <button key={chord} onClick={() => setActiveChord(activeChord === chord ? null : chord)}
            style={{ padding:"12px 20px", borderRadius:12, border:"none", cursor:"pointer", background: activeChord === chord ? "linear-gradient(135deg, #7c3aed, #db2777)" : "rgba(124,58,237,0.15)", color: activeChord === chord ? "#fff" : "#a78bfa", fontSize:16, fontWeight:700, boxShadow: activeChord === chord ? "0 0 20px rgba(124,58,237,0.6)" : "none", transition:"all 0.2s" }}>
            {chord}
          </button>
        ))}
      </div>
      <div style={{ position:"relative", background:"rgba(0,0,0,0.6)", borderRadius:16, border:"1px solid rgba(124,58,237,0.3)", padding:"20px 0", overflow:"hidden", boxShadow: strumFlash ? "0 0 40px rgba(124,58,237,0.8)" : "none", transition:"box-shadow 0.15s" }}>
        {["E2","A2","D3","G3","B3","E4"].map((str, i) => (
          <div key={str} style={{ position:"relative", margin:"8px 0", padding:"0 24px" }}>
            <div style={{ height: 2 + i * 0.5, background:`hsl(${280+i*15},80%,60%)`, boxShadow:`0 0 8px hsl(${280+i*15},80%,60%)`, borderRadius:2, cursor:"pointer" }} onClick={(e) => strum(activeChord, "down", e)} />
            <span style={{ position:"absolute", right:8, top:-8, fontSize:11, color:"rgba(255,255,255,0.4)" }}>{str}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop:16, display:"flex", gap:24, alignItems:"center" }}>
        <div style={{ color:"#a78bfa", fontSize:14 }}>{activeChord ? `🎸 Chord: ${activeChord} — move mouse over strings` : "← Select a chord"}</div>
        {combo > 0 && <div style={{ background:"linear-gradient(135deg, #7c3aed, #db2777)", padding:"4px 12px", borderRadius:20, color:"#fff", fontSize:13, fontWeight:700 }}>🔥 {combo}x</div>}
      </div>
    </div>
  );
}

function PianoMode({ onScore, gesture, handPosition }) {
  const { playTone } = useAudioEngine();
  const [activeKeys, setActiveKeys] = useState(new Set());
  const triggerKey = useCallback((key, e) => {
    const freq = NOTES.piano[key] || (key==="C#4"?277.18:key==="D#4"?311.13:key==="F#4"?369.99:key==="G#4"?415.30:key==="A#4"?466.16:key==="C#5"?554.37:key==="D#5"?622.25:key==="F#5"?739.99:440);
    playTone(freq, "sine", 0.8, 0.4); onScore(50);
    setActiveKeys(k => new Set([...k, key]));
    setTimeout(() => setActiveKeys(k => { const n = new Set(k); n.delete(key); return n; }), 400);
  }, [playTone, onScore]);

  // gesture fallback: pointing selects key, pinch triggers
  useEffect(() => {
    if (!gesture) return;
    if ((gesture === "pinch" || gesture === "pointing") && handPosition) {
      const x = Math.floor(handPosition.x * WHITE_KEYS.length);
      const key = WHITE_KEYS[Math.min(WHITE_KEYS.length-1, Math.max(0, x))];
      triggerKey(key);
    }
  }, [gesture, handPosition]);

  return (
    <div>
      <div style={{ position:"relative", display:"flex", height:160, background:"linear-gradient(180deg, rgba(0,0,0,0.8), rgba(30,0,60,0.8))", borderRadius:16, border:"1px solid rgba(96,165,250,0.2)", overflow:"hidden", padding:"0 8px", alignItems:"flex-start" }}>
        {WHITE_KEYS.map(key => (
          <div key={key} onClick={(e) => triggerKey(key, e)}
            style={{ flex:1, height:"100%", borderRadius:"0 0 8px 8px", background: activeKeys.has(key) ? "linear-gradient(180deg, #60a5fa, #a78bfa)" : "linear-gradient(180deg, rgba(255,255,255,0.95), rgba(230,230,255,0.9))", border:"1px solid rgba(96,165,250,0.3)", borderTop:"none", margin:"0 1px", cursor:"pointer", boxShadow: activeKeys.has(key) ? "0 0 20px rgba(96,165,250,0.8)" : "none", position:"relative", zIndex:1 }}>
            <div style={{ position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)", fontSize:9, color: activeKeys.has(key) ? "#fff" : "#666", fontWeight:600 }}>{key.replace(/\d/,"")}</div>
          </div>
        ))}
        {Object.entries(BLACK_KEYS).map(([key, pos]) => (
          <div key={key} onClick={(e) => { e.stopPropagation(); triggerKey(key, e); }}
            style={{ position:"absolute", left:`calc(${pos*(100/WHITE_KEYS.length)}% + ${pos*2+8}px - 14px)`, width:28, height:"60%", top:0, zIndex:2, background: activeKeys.has(key) ? "linear-gradient(180deg, #7c3aed, #db2777)" : "linear-gradient(180deg, #1a1a2e, #16213e)", borderRadius:"0 0 6px 6px", cursor:"pointer", boxShadow: activeKeys.has(key) ? "0 0 15px rgba(167,139,250,0.9)" : "0 4px 8px rgba(0,0,0,0.5)", border:"1px solid rgba(167,139,250,0.2)" }} />
        ))}
      </div>
      <div style={{ marginTop:16, display:"flex", gap:12, flexWrap:"wrap" }}>
        {["C Major","G Major","F Major","A Minor"].map(prog => (
          <button key={prog} onClick={() => { const map={"C Major":["C4","E4","G4"],"G Major":["G4","B4","D5"],"F Major":["F4","A4","C5"],"A Minor":["A4","C5","E5"]}; map[prog].forEach((k,i) => setTimeout(() => triggerKey(k), i*100)); }}
            style={{ padding:"8px 16px", borderRadius:8, background:"rgba(96,165,250,0.15)", border:"1px solid rgba(96,165,250,0.3)", color:"#93c5fd", fontSize:13, cursor:"pointer" }}>
            {prog}
          </button>
        ))}
      </div>
    </div>
  );
}

function DrumMode({ onScore, gesture, handPosition }) {
  const { playDrum } = useAudioEngine();
  const [hits, setHits] = useState({});
  const drumPads = [{id:"crash",label:"CRASH",color:"#f59e0b",size:70,x:"10%",y:"5%"},{id:"hihat",label:"HI-HAT",color:"#60a5fa",size:80,x:"70%",y:"8%"},{id:"snare",label:"SNARE",color:"#a78bfa",size:100,x:"38%",y:"15%"},{id:"tom",label:"TOM",color:"#34d399",size:85,x:"15%",y:"38%"},{id:"kick",label:"KICK",color:"#f87171",size:120,x:"35%",y:"50%"}];
  const hit = useCallback((pad) => { playDrum(pad.id); onScore(75); setHits(h => ({...h,[pad.id]:true})); setTimeout(() => setHits(h => ({...h,[pad.id]:false})), 200); }, [playDrum, onScore]);

  useEffect(() => {
    if (!gesture || !handPosition) return;
    if (gesture === "pinch") {
      // map x,y to closest pad
      const px = handPosition.x; const py = handPosition.y;
      let closest = drumPads[0]; let dist = 1e9;
      drumPads.forEach(p => {
        const rx = parseFloat(p.x)/100; const ry = parseFloat(p.y)/100;
        const d = Math.hypot(rx-px, ry-py);
        if (d < dist) { dist = d; closest = p; }
      });
      hit(closest);
    }
  }, [gesture, handPosition]);
  return (
    <div style={{ position:"relative", height:300, userSelect:"none" }}>
      {drumPads.map(pad => (
        <div key={pad.id} onClick={() => hit(pad)}
          style={{ position:"absolute", left:pad.x, top:pad.y, width:pad.size, height:pad.size, borderRadius:"50%", background: hits[pad.id] ? `radial-gradient(circle, ${pad.color}, ${pad.color}88)` : `radial-gradient(circle, ${pad.color}22, ${pad.color}08)`, border:`2px solid ${pad.color}${hits[pad.id]?"ff":"66"}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.1s", transform: hits[pad.id] ? "scale(0.92)" : "scale(1)", boxShadow: hits[pad.id] ? `0 0 30px ${pad.color}` : `0 0 10px ${pad.color}22` }}>
          <span style={{ fontSize:10, fontWeight:800, color: hits[pad.id] ? "#fff" : pad.color, letterSpacing:1 }}>{pad.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function VirtualRockstar() {
  const [page, setPage] = useState("home");
  const [instrument, setInstrument] = useState("guitar");
  const [score, setScore] = useState(0);
  const tracker = useHandTracker();
  const { gesture: realGesture, handPosition } = tracker;
  const [overrideGesture, setOverrideGesture] = useState(null);
  const gesture = overrideGesture || realGesture;

  const [achievementsState, setAchievementsState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vr_achievements')) || ACHIEVEMENTS; } catch { return ACHIEVEMENTS; }
  });

  const addScore = useCallback((pts) => setScore(s => s + pts), []);

  // persist leaderboard & achievements in localStorage
  useEffect(() => {
    const lb = JSON.parse(localStorage.getItem('vr_leaderboard') || '[]');
    const entry = { score, ts: Date.now() };
    if (score > 0) {
      lb.push(entry);
      lb.sort((a,b) => b.score - a.score);
      localStorage.setItem('vr_leaderboard', JSON.stringify(lb.slice(0,5)));
    }
    // unlock achievements by score thresholds
    setAchievementsState(prev => {
      const next = prev.map(a => {
        if (!a.unlocked && a.id === 4 && score >= 50000) return { ...a, unlocked: true };
        return a;
      });
      localStorage.setItem('vr_achievements', JSON.stringify(next));
      return next;
    });
  }, [score]);

  // keyboard fallback
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') { setOverrideGesture('pinch'); setTimeout(() => setOverrideGesture(null), 250); }
      if (e.key === 'o') { setOverrideGesture('open-palm'); setTimeout(() => setOverrideGesture(null), 250); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const css = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@400;500;600&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#09090b;font-family:'Inter',sans-serif;color:#fff}
      @keyframes particle-burst{0%{transform:translate(-50%,-50%) scale(1);opacity:1}100%{transform:translate(-50%,-50%) translate(20px,-40px) scale(0);opacity:0}}
      @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      @keyframes neon-flicker{0%,100%{opacity:1}92%{opacity:0.8}96%{opacity:0.9}}
      ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(124,58,237,0.4);border-radius:2px}
    `;
    const el = document.createElement("style"); el.textContent = css; document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  const nav = [
    { id: "home", icon: "🏠", label: "Home" },
    { id: "music", icon: "🎵", label: "Music" },
    { id: "canvas", icon: "🎨", label: "Canvas" },
    { id: "games", icon: "🎮", label: "Games" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0010 0%, #0d0020 50%, #0a0010 100%)" }}>
      {/* NAV */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(10,0,20,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(124,58,237,0.2)", padding: "0 24px", display: "flex", alignItems: "center", height: 54 }}>
        <div style={{ fontFamily: "'Orbitron'", fontSize: 14, fontWeight: 900, color: "#a78bfa", letterSpacing: 2, marginRight: 24 }}>VIRTUAL ROCKSTAR</div>
        {nav.map(n => (
          <button key={n.id} onClick={() => setPage(n.id)}
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, marginRight: 4, background: page === n.id ? "rgba(124,58,237,0.3)" : "transparent", color: page === n.id ? "#a78bfa" : "rgba(255,255,255,0.5)" }}>
            {n.icon} {n.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", color: "#fbbf24", fontSize: 13, fontWeight: 700 }}>⭐ {score.toLocaleString()}</div>
      </nav>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* HOME */}
        {page === "home" && (
          <div>
            <h1 style={{ fontFamily: "'Orbitron'", fontSize: 36, fontWeight: 900, marginBottom: 8, background: "linear-gradient(135deg, #fff, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>VIRTUAL ROCKSTAR</h1>
            <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 32 }}>Play music and draw with gestures</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
              <div onClick={() => setPage("music")} style={{ background: "rgba(192,132,252,0.06)", border: "1px solid rgba(192,132,252,0.2)", borderRadius: 16, padding: 24, cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎵</div>
                <div style={{ fontWeight: 700, color: "#c084fc", marginBottom: 6, fontSize: 18 }}>Music Studio</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Guitar, Piano, Drums</div>
              </div>
              <div onClick={() => setPage("canvas")} style={{ background: "rgba(244,114,182,0.06)", border: "1px solid rgba(244,114,182,0.2)", borderRadius: 16, padding: 24, cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎨</div>
                <div style={{ fontWeight: 700, color: "#f472b6", marginBottom: 6, fontSize: 18 }}>Creative Canvas</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Draw in the air with hand tracking</div>
              </div>
              <div onClick={() => setPage("games")} style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 16, padding: 24, cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎮</div>
                <div style={{ fontWeight: 700, color: "#f59e0b", marginBottom: 6, fontSize: 18 }}>Gesture Arcade</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>Play mini-games using hand gestures</div>
              </div>
            </div>
          </div>
        )}

        {/* MUSIC */}
        {page === "music" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setPage("home")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>← Back</button>
              <h2 style={{ fontFamily: "'Orbitron'", fontSize: 24, fontWeight: 900, color: "#c084fc" }}>🎵 Music Studio</h2>
            </div>

            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {["guitar","piano","drums"].map(ins => (
                <button key={ins} onClick={() => setInstrument(ins)}
                  style={{ padding: "10px 20px", borderRadius: 10, border: "none", cursor: "pointer", background: instrument === ins ? "linear-gradient(135deg, #7c3aed, #db2777)" : "rgba(255,255,255,0.05)", color: instrument === ins ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: 700, fontSize: 14, textTransform: "capitalize" }}>
                  {ins === "guitar" ? "🎸" : ins === "piano" ? "🎹" : "🥁"} {ins}
                </button>
              ))}
              <div style={{ marginLeft: "auto", color: "#fbbf24", fontSize: 13, fontWeight: 600 }}>Session: {score} pts</div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 20, border: "1px solid rgba(124,58,237,0.15)", padding: 24 }}>
              {instrument === "guitar" && <GuitarMode onScore={addScore} gesture={gesture} handPosition={handPosition} />}
              {instrument === "piano" && <PianoMode onScore={addScore} gesture={gesture} handPosition={handPosition} />}
              {instrument === "drums" && <DrumMode onScore={addScore} gesture={gesture} handPosition={handPosition} />}
            </div>
          </div>
        )}

        {/* CANVAS */}
        {page === "canvas" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setPage("home")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>← Back</button>
              <h2 style={{ fontFamily: "'Orbitron'", fontSize: 24, fontWeight: 900, color: "#f472b6" }}>🎨 Creative Canvas</h2>
            </div>
            <LiveGestureCanvas sharedTracker={tracker} overrideGesture={overrideGesture} />
          </div>
        )}

        {/* GAMES */}
        {page === "games" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setPage("home")} style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>← Back</button>
              <h2 style={{ fontFamily: "'Orbitron'", fontSize: 24, fontWeight: 900, color: "#f59e0b" }}>🎮 Gesture Arcade</h2>
            </div>
            <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 20, border: "1px solid rgba(124,58,237,0.15)", padding: 24 }}>
              <Games gesture={gesture} handPosition={handPosition} onScore={addScore} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
