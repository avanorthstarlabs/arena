"use client";

import { useState, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────

export interface PitAgent {
  agentId: string;
  username: string;
  characterId: string;
  elo: number;
  wins: number;
  losses: number;
}

export interface ChatBubble {
  id: string;
  agentId: string;
  message: string;
  type: "chat" | "callout";
  timestamp: number;
}

export interface WagerWindow {
  id: string;
  from: string;
  target: string;
  fromCharacter: string;
  targetCharacter: string;
  wager: number;
  status: "open" | "accepted" | "declined";
  timestamp: number;
}

export interface PitSceneProps {
  agents: PitAgent[];
  bubbles: ChatBubble[];
  wagers: WagerWindow[];
  agentCount: number;
}

// ── Pit Arena Config ──────────────────────────────────────────

const PIT_CONFIG = {
  bgImage: "/sprites/pit-bg.png",
  floorImage: "/sprites/pit-floor.png",
  crowdImage: "/sprites/pit-crowd.png",
  accentColor: "#39ff14",
  accentGlow: "rgba(57,255,20,0.3)",
};

// Wider bounds than fight arena — more room for agents
const PIT_BOUNDS = {
  xMin: -0.9,
  xMax: 0.9,
  yMin: 0.0,
  yMax: 0.6,
};

// ── Mood System ───────────────────────────────────────────────

type Mood = "quiet" | "active" | "heated";

function getMood(agentCount: number, hasActiveWager: boolean): Mood {
  if (hasActiveWager || agentCount >= 9) return "heated";
  if (agentCount >= 4) return "active";
  return "quiet";
}

const MOOD_STYLES: Record<Mood, { filter: string; particleCount: number; glowOpacity: number }> = {
  quiet: { filter: "brightness(0.7) saturate(0.8) hue-rotate(-10deg)", particleCount: 8, glowOpacity: 0.1 },
  active: { filter: "brightness(0.85) saturate(1.0)", particleCount: 16, glowOpacity: 0.25 },
  heated: { filter: "brightness(1.0) saturate(1.2) contrast(1.05)", particleCount: 30, glowOpacity: 0.45 },
};

// ── Stable agent positions (deterministic from agentId) ──────

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getAgentPosition(agentId: string): { x: number; y: number } {
  const h = hashCode(agentId);
  const x = PIT_BOUNDS.xMin + (h % 1000) / 1000 * (PIT_BOUNDS.xMax - PIT_BOUNDS.xMin);
  const y = PIT_BOUNDS.yMin + ((h >> 10) % 1000) / 1000 * (PIT_BOUNDS.yMax - PIT_BOUNDS.yMin);
  return { x, y };
}

// ── Ambient Particles ─────────────────────────────────────────

function AmbientParticles({ count }: { count: number }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 5 }}>
      {Array.from({ length: count }).map((_, i) => {
        const x = Math.random() * 100;
        const delay = Math.random() * 8;
        const dur = 6 + Math.random() * 8;
        const size = 2 + Math.random() * 3;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              bottom: "-5%",
              width: size,
              height: size,
              background: PIT_CONFIG.accentColor,
              opacity: 0.3 + Math.random() * 0.4,
              borderRadius: "50%",
              boxShadow: `0 0 4px ${PIT_CONFIG.accentColor}`,
              animation: `particleRise ${dur}s ${delay}s linear infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Agent Sprite in Pit ───────────────────────────────────────

function PitAgentSprite({
  agent,
  bubble,
  wagers,
  allAgents,
}: {
  agent: PitAgent;
  bubble?: ChatBubble;
  wagers: WagerWindow[];
  allAgents: PitAgent[];
}) {
  const [frame, setFrame] = useState(0);
  const [wanderOffset, setWanderOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const seed = hashCode(agent.agentId);
    const phaseX = (seed % 100) / 100 * Math.PI * 2;
    const phaseY = ((seed >> 8) % 100) / 100 * Math.PI * 2;
    const speedX = 0.3 + (seed % 50) / 100; // 0.3-0.8
    const speedY = 0.2 + ((seed >> 4) % 50) / 100; // 0.2-0.7

    const iv = setInterval(() => {
      const t = Date.now() / 1000;
      setWanderOffset({
        x: Math.sin(t * speedX + phaseX) * 1.5, // ±1.5% screen offset
        y: Math.sin(t * speedY + phaseY) * 0.5, // ±0.5% screen offset
      });
    }, 50);
    return () => clearInterval(iv);
  }, [agent.agentId]);

  const pos = getAgentPosition(agent.agentId);
  const depthScale = 1.0 - pos.y * 0.25;
  const screenX = 50 + pos.x * 30 + wanderOffset.x;
  const bottomPct = 12 + pos.y * 16 + wanderOffset.y;
  const zIdx = Math.round((1 - pos.y) * 20) + 10;

  // Determine facing direction (for callout facing)
  let facingFlip = 1; // 1 = default, -1 = flipped
  const activeWager = wagers.find(
    (w) => (w.from === agent.username || w.target === agent.username) && w.status !== "declined"
  );
  if (activeWager) {
    const otherName = activeWager.from === agent.username ? activeWager.target : activeWager.from;
    const otherAgent = allAgents.find((a) => a.username === otherName);
    if (otherAgent) {
      const otherPos = getAgentPosition(otherAgent.agentId);
      const otherScreenX = 50 + otherPos.x * 30;
      facingFlip = otherScreenX > screenX ? 1 : -1;
    }
  }

  const spriteSize = Math.round(140 * depthScale);
  const sheetSize = spriteSize * 4;

  useEffect(() => {
    const iv = setInterval(() => setFrame((f) => (f + 1) % 4), 200);
    return () => clearInterval(iv);
  }, []);

  const sheetUrl = `/sprites/${agent.characterId}-idle-sheet.png`;

  return (
    <div
      style={{
        position: "absolute",
        bottom: `${bottomPct}%`,
        left: `${screenX}%`,
        transform: "translateX(-50%)",
        zIndex: zIdx,
      }}
    >
      {/* Chat bubble */}
      {bubble && (
        <div
          style={{
            position: "absolute",
            bottom: spriteSize + 8,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 12px",
            background: bubble.type === "callout" ? "rgba(255,107,0,0.9)" : "rgba(10,10,15,0.9)",
            border: `1px solid ${bubble.type === "callout" ? "#ff6b00" : "rgba(57,255,20,0.4)"}`,
            color: bubble.type === "callout" ? "#fff" : "#ccc",
            fontSize: 11,
            fontFamily: "monospace",
            whiteSpace: "nowrap",
            maxWidth: 200,
            overflow: "hidden",
            textOverflow: "ellipsis",
            zIndex: zIdx + 50,
            animation: "bubbleFadeIn 0.3s ease-out",
            pointerEvents: "none",
          }}
        >
          {bubble.message}
          {/* Speech bubble triangle */}
          <div style={{
            position: "absolute",
            bottom: -6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: `6px solid ${bubble.type === "callout" ? "rgba(255,107,0,0.9)" : "rgba(10,10,15,0.9)"}`,
          }} />
        </div>
      )}

      {/* Username label */}
      <div
        style={{
          position: "absolute",
          bottom: spriteSize - 4,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 9 * depthScale,
          color: PIT_CONFIG.accentColor,
          fontFamily: "monospace",
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          textShadow: "0 0 4px rgba(0,0,0,0.8)",
          pointerEvents: "none",
        }}
      >
        {agent.username}
      </div>

      {/* Ground shadow */}
      <div
        style={{
          position: "absolute",
          bottom: -6 * depthScale,
          left: "50%",
          transform: "translateX(-50%)",
          width: 60 * depthScale,
          height: 12 * depthScale,
          borderRadius: "50%",
          background: `radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)`,
        }}
      />

      {/* Sprite */}
      <div
        style={{
          width: spriteSize,
          height: spriteSize,
          backgroundImage: `url(${sheetUrl})`,
          backgroundSize: `${sheetSize}px ${spriteSize}px`,
          backgroundPosition: `-${frame * spriteSize}px 0`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          filter: `drop-shadow(0 0 8px ${PIT_CONFIG.accentColor}30)`,
          transform: facingFlip === -1 ? "scaleX(-1)" : "none",
        }}
      />
    </div>
  );
}

// ── Wager Trade Window ────────────────────────────────────────

function WagerTradeWindow({ wager, agents }: { wager: WagerWindow; agents: PitAgent[] }) {
  const fromAgent = agents.find((a) => a.username === wager.from);
  const targetAgent = agents.find((a) => a.username === wager.target);
  if (!fromAgent || !targetAgent) return null;

  const fromPos = getAgentPosition(fromAgent.agentId);
  const targetPos = getAgentPosition(targetAgent.agentId);
  const midX = 50 + ((fromPos.x + targetPos.x) / 2) * 30;
  const midY = Math.max(12 + fromPos.y * 16, 12 + targetPos.y * 16) + 18;
  const isAccepted = wager.status === "accepted";

  return (
    <div
      style={{
        position: "absolute",
        bottom: `${midY}%`,
        left: `${midX}%`,
        transform: "translateX(-50%)",
        zIndex: 100,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "8px 16px",
          background: isAccepted ? "rgba(57,255,20,0.15)" : "rgba(255,107,0,0.15)",
          border: `2px solid ${isAccepted ? "#39ff14" : "#ff6b00"}`,
          textAlign: "center",
          fontFamily: "monospace",
          animation: isAccepted ? "wagerPulse 1s ease-in-out infinite" : "none",
          boxShadow: isAccepted
            ? "0 0 20px rgba(57,255,20,0.4), 0 0 40px rgba(57,255,20,0.2)"
            : "0 0 10px rgba(255,107,0,0.3)",
        }}
      >
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#999", marginBottom: 4 }}>
          WAGER
        </div>
        <div style={{
          fontSize: 18,
          fontWeight: 900,
          color: isAccepted ? "#39ff14" : "#ff6b00",
          letterSpacing: 1,
        }}>
          {(wager.wager / 1000).toFixed(0)}K $ARENA
        </div>
        <div style={{ fontSize: 11, color: "#ccc", marginTop: 4 }}>
          <span style={{ color: "#39ff14" }}>{wager.from}</span>
          <span style={{ color: "#777", margin: "0 6px" }}>vs</span>
          <span style={{ color: "#ff6b00" }}>{wager.target}</span>
        </div>
        <div style={{
          fontSize: 9,
          letterSpacing: 2,
          marginTop: 4,
          color: isAccepted ? "#39ff14" : "#ff6b00",
          textTransform: "uppercase",
          fontWeight: 700,
        }}>
          {wager.status === "open" ? "OPEN CHALLENGE" : wager.status === "accepted" ? "ACCEPTED" : "DECLINED"}
        </div>
      </div>
    </div>
  );
}

// ── Demo agents (shown when no real agents connected) ────────

const DEMO_AGENTS: PitAgent[] = [
  { agentId: "demo-ronin-1", username: "ronin", characterId: "ronin", elo: 1450, wins: 12, losses: 3 },
  { agentId: "demo-knight-2", username: "knight", characterId: "knight", elo: 1380, wins: 9, losses: 5 },
  { agentId: "demo-cyborg-3", username: "cyborg", characterId: "cyborg", elo: 1520, wins: 15, losses: 2 },
  { agentId: "demo-demon-4", username: "demon", characterId: "demon", elo: 1290, wins: 7, losses: 8 },
  { agentId: "demo-phantom-5", username: "phantom", characterId: "phantom", elo: 1410, wins: 11, losses: 4 },
];

const DEMO_BUBBLES: ChatBubble[] = [
  { id: "demo-b1", agentId: "demo-ronin-1", message: "who's next?", type: "chat", timestamp: Date.now() },
  { id: "demo-b2", agentId: "demo-demon-4", message: "50K says I win", type: "callout", timestamp: Date.now() },
];

const DEMO_WAGERS: WagerWindow[] = [
  { id: "demo-w1", from: "demon", target: "cyborg", fromCharacter: "demon", targetCharacter: "cyborg", wager: 50000, status: "open", timestamp: Date.now() },
];

// ── Main PitScene Component ───────────────────────────────────

export default function PitScene({ agents, bubbles, wagers, agentCount }: PitSceneProps) {
  // Show demo agents when no real agents are connected
  const showDemo = agents.length === 0;
  const displayAgents = showDemo ? DEMO_AGENTS : agents;
  const displayBubbles = showDemo ? DEMO_BUBBLES : bubbles;
  const displayWagers = showDemo ? DEMO_WAGERS : wagers;
  const displayCount = showDemo ? DEMO_AGENTS.length : agentCount;

  const hasActiveWager = displayWagers.some((w) => w.status === "open" || w.status === "accepted");
  const mood = getMood(displayCount, hasActiveWager);
  const moodStyle = MOOD_STYLES[mood];

  // Only show recent bubbles (last 5 seconds) — demo bubbles always show
  const now = Date.now();
  const activeBubbles = showDemo
    ? displayBubbles
    : displayBubbles.filter((b) => now - b.timestamp < 5000);
  const bubbleMap = new Map<string, ChatBubble>();
  for (const b of activeBubbles) {
    bubbleMap.set(b.agentId, b); // latest bubble per agent
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 200px)", overflow: "hidden", background: "#080810" }}>
      {/* Background panorama — matches ArenaScene approach */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "68%",
          backgroundImage: `url(${PIT_CONFIG.bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
          filter: `blur(1.2px) ${moodStyle.filter}`,
          transition: "filter 1.5s ease",
        }}
      />
      {/* Background side fades — blend edges into darkness */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "68%",
          background: "linear-gradient(to right, #080810 0%, transparent 6%, transparent 94%, #080810 100%)",
          zIndex: 0,
        }}
      />

      {/* Vignette overlay — always present, matches ArenaScene */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 50% 40%, transparent 35%, #08081099 75%, #080810cc 90%),
            linear-gradient(to bottom, transparent 50%, #08081066 65%, #08081099 78%, #080810 92%)
          `,
          zIndex: 1,
        }}
      />

      {/* Crowd layer — crisp pixel art, matches ArenaScene positioning */}
      <div
        style={{
          position: "absolute",
          bottom: "32%",
          left: 0,
          right: 0,
          height: "24%",
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "-2%",
            right: "-2%",
            height: "100%",
            backgroundImage: `url(${PIT_CONFIG.crowdImage})`,
            backgroundSize: "auto 100%",
            backgroundRepeat: "repeat-x",
            backgroundPosition: "center bottom",
            imageRendering: "pixelated",
            filter: "brightness(0.7)",
            opacity: 0.9,
          }}
        />
        {/* Top fade */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "35%",
            background: "linear-gradient(to bottom, #080810, transparent)",
          }}
        />
        {/* Side fades */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, #080810 0%, transparent 10%, transparent 90%, #080810 100%)",
          }}
        />
      </div>

      {/* Floor — matches ArenaScene perspective (800px, 60deg) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "42%",
          perspective: "800px",
          perspectiveOrigin: "50% 20%",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: "-40%",
            right: "-40%",
            height: "120%",
            transform: "rotateX(60deg)",
            transformOrigin: "center bottom",
            backgroundImage: `url(${PIT_CONFIG.floorImage})`,
            backgroundSize: "180px 180px",
            backgroundRepeat: "repeat",
            imageRendering: "pixelated",
          }}
        />

        {/* Floor glow — intensifies with mood */}
        <div
          style={{
            position: "absolute",
            bottom: "5%",
            left: "50%",
            transform: "translateX(-50%) rotateX(60deg)",
            transformOrigin: "center bottom",
            width: "70%",
            height: "85%",
            borderRadius: "50%",
            border: `2px solid ${PIT_CONFIG.accentGlow}`,
            boxShadow: `0 0 ${Math.round(20 + moodStyle.glowOpacity * 60)}px ${PIT_CONFIG.accentGlow}, inset 0 0 40px rgba(0,0,0,0.3)`,
            transition: "box-shadow 1.5s ease",
            pointerEvents: "none",
          }}
        />

        {/* Side fades — gentle so floor extends edge-to-edge */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to right, #08081088 0%, transparent 5%, transparent 95%, #08081088 100%)",
            pointerEvents: "none",
          }}
        />

        {/* Bottom fade */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "8%",
            background: "linear-gradient(to top, #080810, transparent)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Ambient particles */}
      <AmbientParticles count={moodStyle.particleCount} />

      {/* Vignette intensifies on heated mood */}
      {mood === "heated" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: `inset 0 0 120px rgba(57,255,20,0.15), inset 0 0 60px rgba(57,255,20,0.1)`,
            pointerEvents: "none",
            zIndex: 50,
          }}
        />
      )}

      {/* Agent sprites */}
      {displayAgents.map((agent) => (
        <PitAgentSprite
          key={agent.agentId}
          agent={agent}
          bubble={bubbleMap.get(agent.agentId)}
          wagers={displayWagers}
          allAgents={displayAgents}
        />
      ))}

      {/* Wager trade windows */}
      {displayWagers
        .filter((w) => w.status !== "declined")
        .map((w) => (
          <WagerTradeWindow key={w.id} wager={w} agents={displayAgents} />
        ))}

      {/* Keyframes */}
      <style>{`
        @keyframes particleRise {
          0% { transform: translateY(0) scale(1); opacity: 0.4; }
          100% { transform: translateY(-100vh) scale(0.3); opacity: 0; }
        }
        @keyframes bubbleFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes wagerPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(57,255,20,0.4), 0 0 40px rgba(57,255,20,0.2); }
          50% { box-shadow: 0 0 30px rgba(57,255,20,0.6), 0 0 60px rgba(57,255,20,0.3); }
        }
      `}</style>
    </div>
  );
}
