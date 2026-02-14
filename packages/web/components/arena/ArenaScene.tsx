"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { FightHUD } from "./FightHUD";
import type { FightState } from "./useGameState";

// ── Types ──────────────────────────────────────────────────────

type AnimState = "idle" | "attack" | "block" | "dodge" | "hurt" | "ko";

interface ArenaSceneProps {
  gameState: FightState | null;
  arenaId?: string;
}

interface ArenaConfig {
  id: string;
  name: string;
  bgImage: string;
  floorImage: string;
  accentColor: string;
  accentGlow: string;
  bgTint: string;
}

// ── Arena Themes ────────────────────────────────────────────────

const ARENAS: Record<string, ArenaConfig> = {
  gothic: {
    id: "gothic",
    name: "Shadow Colosseum",
    bgImage: "/sprites/arena-bg.png",
    floorImage: "/sprites/arena-floor.png",
    accentColor: "#39ff14",
    accentGlow: "rgba(57,255,20,0.3)",
    bgTint: "#080810",
  },
  volcanic: {
    id: "volcanic",
    name: "Inferno Forge",
    bgImage: "/sprites/arena-volcanic-bg.png",
    floorImage: "/sprites/arena-volcanic-floor.png",
    accentColor: "#ff6600",
    accentGlow: "rgba(255,102,0,0.3)",
    bgTint: "#100808",
  },
  ice: {
    id: "ice",
    name: "Frozen Depths",
    bgImage: "/sprites/arena-ice-bg.png",
    floorImage: "/sprites/arena-ice-floor.png",
    accentColor: "#44bbff",
    accentGlow: "rgba(68,187,255,0.3)",
    bgTint: "#080810",
  },
  neon: {
    id: "neon",
    name: "Neon District",
    bgImage: "/sprites/arena-neon-bg.png",
    floorImage: "/sprites/arena-neon-floor.png",
    accentColor: "#ff00ff",
    accentGlow: "rgba(255,0,255,0.3)",
    bgTint: "#0a0812",
  },
};

const ARENA_IDS = Object.keys(ARENAS);

function getRandomArena(): ArenaConfig {
  const id = ARENA_IDS[Math.floor(Math.random() * ARENA_IDS.length)];
  return ARENAS[id];
}

// ── Action → AnimState mapping ─────────────────────────────────

function getAnimState(
  action: string | undefined,
  isHurt: boolean,
  isKO: boolean,
): AnimState {
  if (isKO) return "ko";
  if (isHurt) return "hurt";
  if (!action) return "idle";
  const a = action.toLowerCase();
  if (
    a.includes("punch") ||
    a.includes("kick") ||
    a.includes("uppercut") ||
    a.includes("sweep") ||
    a.includes("grab")
  )
    return "attack";
  if (a.includes("block")) return "block";
  if (a.includes("dodge")) return "dodge";
  if (a.includes("taunt")) return "idle";
  return "idle";
}

// ── 2.5D Position System ────────────────────────────────────────
// x: -1 (far left) to 1 (far right) on the arena floor
// y: 0 (front/close) to 1 (back/far) — affects scale + screen-y

interface FighterPos {
  x: number;
  y: number;
}

function getTargetPosition(
  animState: AnimState,
  side: "left" | "right",
  basePos: FighterPos,
): FighterPos {
  const dir = side === "left" ? 1 : -1;
  switch (animState) {
    case "attack":
      return { x: basePos.x + 0.12 * dir, y: basePos.y };
    case "dodge":
      return { x: basePos.x - 0.1 * dir, y: basePos.y + 0.08 };
    case "hurt":
      return { x: basePos.x - 0.06 * dir, y: basePos.y };
    case "ko":
      return { x: basePos.x - 0.08 * dir, y: basePos.y + 0.05 };
    default:
      return basePos;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ── Fighter Sprite Component ───────────────────────────────────

const ANIM_FPS: Record<AnimState, number> = {
  idle: 5,
  attack: 10,
  block: 8,
  dodge: 12,
  hurt: 10,
  ko: 6,
};

const ANIM_LOOP: Record<AnimState, boolean> = {
  idle: true,
  attack: false,
  block: false,
  dodge: false,
  hurt: false,
  ko: false,
};

function FighterSprite({
  characterId,
  animState,
  flipX,
  pos,
  arena,
}: {
  characterId: string;
  animState: AnimState;
  flipX: boolean;
  pos: FighterPos;
  arena: ArenaConfig;
}) {
  const [frame, setFrame] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const prevAnimRef = useRef(animState);

  useEffect(() => {
    if (animState !== prevAnimRef.current) {
      setFrame(0);
      prevAnimRef.current = animState;
    }

    const fps = ANIM_FPS[animState];
    const loop = ANIM_LOOP[animState];

    timerRef.current = setInterval(() => {
      setFrame((f) => {
        if (loop) return (f + 1) % 4;
        return Math.min(f + 1, 3);
      });
    }, 1000 / fps);

    return () => clearInterval(timerRef.current);
  }, [animState]);

  const sheetUrl = `/sprites/${characterId}-${animState}-sheet.png`;
  const offsetX = -(frame * 160);

  const isShaking = animState === "hurt";
  const isKO = animState === "ko";

  // 2.5D depth calculations
  const depthScale = 1.0 - pos.y * 0.25; // further back = smaller
  const screenX = 50 + pos.x * 30; // % from center
  const screenY = 72 + pos.y * 12; // % from top (lower = closer to viewer)
  const zIdx = Math.round((1 - pos.y) * 20) + 10;
  const spriteSize = Math.round(160 * depthScale);
  const sheetSize = spriteSize * 4;

  return (
    <div
      style={{
        position: "absolute",
        bottom: `${100 - screenY}%`,
        left: `${screenX}%`,
        transform: `
          translateX(-50%)
          ${flipX ? "scaleX(-1)" : ""}
          ${isShaking ? `translateX(${Math.random() > 0.5 ? 4 : -4}px)` : ""}
          ${isKO ? "rotate(15deg) translateY(20px)" : ""}
        `,
        transition: isShaking ? "none" : "all 0.4s ease-out",
        zIndex: zIdx,
      }}
    >
      {/* Drop shadow on floor */}
      <div
        style={{
          position: "absolute",
          bottom: -8 * depthScale,
          left: "50%",
          transform: "translateX(-50%)",
          width: 90 * depthScale,
          height: 14 * depthScale,
          borderRadius: "50%",
          background: `rgba(0,0,0,0.6)`,
          filter: `blur(${5 * depthScale}px)`,
        }}
      />
      {/* Sprite */}
      <div
        style={{
          width: spriteSize,
          height: spriteSize,
          backgroundImage: `url(${sheetUrl})`,
          backgroundSize: `${sheetSize}px ${spriteSize}px`,
          backgroundPosition: `${-(frame * spriteSize)}px 0`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}

// ── Damage Number Popup ────────────────────────────────────────

function DamagePopup({
  damage,
  pos,
  arena,
}: {
  damage: number;
  pos: FighterPos;
  arena: ArenaConfig;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!visible || damage === 0) return null;

  const screenX = 50 + pos.x * 30;

  return (
    <div
      style={{
        position: "absolute",
        top: "35%",
        left: `${screenX}%`,
        transform: "translateX(-50%)",
        color: "#ff3333",
        fontSize: 36,
        fontWeight: 900,
        fontFamily: "monospace",
        textShadow: "0 0 10px #ff0000, 2px 2px 0 #000",
        animation: "damageFloat 1.2s ease-out forwards",
        zIndex: 50,
        pointerEvents: "none",
      }}
    >
      -{damage}
    </div>
  );
}

// ── Arena Ground (full-width perspective floor) ─────────────────

function ArenaGround({ arena }: { arena: ArenaConfig }) {
  return (
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
      {/* Full ground plane with perspective */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "-20%",
          right: "-20%",
          height: "100%",
          transform: "rotateX(60deg)",
          transformOrigin: "center bottom",
          backgroundImage: `url(${arena.floorImage})`,
          backgroundSize: "180px 180px",
          backgroundRepeat: "repeat",
          imageRendering: "pixelated",
        }}
      />

      {/* Arena ring glow (circular boundary on the floor) */}
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
          border: `2px solid ${arena.accentGlow}`,
          boxShadow: `
            0 0 40px ${arena.accentGlow},
            inset 0 0 40px rgba(0,0,0,0.3)
          `,
          pointerEvents: "none",
        }}
      />

      {/* Center mark */}
      <div
        style={{
          position: "absolute",
          bottom: "42%",
          left: "50%",
          transform: "translateX(-50%) rotateX(60deg)",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: arena.accentColor,
          boxShadow: `0 0 15px ${arena.accentColor}`,
        }}
      />

      {/* Edge fade to darkness on sides */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            linear-gradient(to right, ${arena.bgTint} 0%, transparent 15%, transparent 85%, ${arena.bgTint} 100%)
          `,
          pointerEvents: "none",
        }}
      />

      {/* Floor-to-bottom fade */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "15%",
          background: `linear-gradient(to top, ${arena.bgTint}, transparent)`,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ── Main Arena Scene ───────────────────────────────────────────

const CHARACTER_MAP: Record<string, string> = {
  p1: "knight",
  p2: "ronin",
};

function getCharacterId(agentId: string | undefined, isP1: boolean): string {
  return isP1 ? CHARACTER_MAP.p1 : CHARACTER_MAP.p2;
}

export function ArenaScene({ gameState, arenaId }: ArenaSceneProps) {
  // Pick arena once on mount (random if not specified)
  // Use state instead of useMemo to avoid hydration mismatch from Math.random()
  const [arena, setArena] = useState<ArenaConfig>(ARENAS.gothic);
  const arenaInitRef = useRef(false);

  useEffect(() => {
    if (arenaInitRef.current) return;
    arenaInitRef.current = true;
    if (arenaId && ARENAS[arenaId]) {
      setArena(ARENAS[arenaId]);
    } else {
      setArena(getRandomArena());
    }
  }, [arenaId]);

  const lastResult = gameState?.lastResult;
  const isP1Hurt = lastResult ? lastResult.p2Damage > 0 : false;
  const isP2Hurt = lastResult ? lastResult.p1Damage > 0 : false;
  const isP1KO = gameState ? gameState.p1.hp <= 0 : false;
  const isP2KO = gameState ? gameState.p2.hp <= 0 : false;

  const lastEntry =
    gameState?.history && gameState.history.length > 0
      ? gameState.history[gameState.history.length - 1]
      : null;

  const p1Anim = getAnimState(lastEntry?.p1Action, isP1Hurt, isP1KO);
  const p2Anim = getAnimState(lastEntry?.p2Action, isP2Hurt, isP2KO);

  const p1Char = getCharacterId(gameState?.p1.agentId, true);
  const p2Char = getCharacterId(gameState?.p2.agentId, false);

  // ── 2.5D Fighter Positions ──────────────────────────────
  const BASE_P1: FighterPos = { x: -0.45, y: 0.25 };
  const BASE_P2: FighterPos = { x: 0.45, y: 0.25 };

  const [p1Pos, setP1Pos] = useState<FighterPos>(BASE_P1);
  const [p2Pos, setP2Pos] = useState<FighterPos>(BASE_P2);
  const animFrameRef = useRef<number>();

  // Smooth position interpolation toward targets
  useEffect(() => {
    const target1 = getTargetPosition(p1Anim, "left", BASE_P1);
    const target2 = getTargetPosition(p2Anim, "right", BASE_P2);

    let cancelled = false;
    const animate = () => {
      if (cancelled) return;
      setP1Pos((prev) => ({
        x: lerp(prev.x, target1.x, 0.08),
        y: lerp(prev.y, target1.y, 0.08),
      }));
      setP2Pos((prev) => ({
        x: lerp(prev.x, target2.x, 0.08),
        y: lerp(prev.y, target2.y, 0.08),
      }));
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [p1Anim, p2Anim]);

  // Determine which fighter is to the left — flip sprites accordingly
  const p1FacingRight = p1Pos.x < p2Pos.x;

  // Track damage for popups
  const [damageKey, setDamageKey] = useState(0);
  const prevExchange = useRef(0);

  useEffect(() => {
    if (gameState && gameState.exchange !== prevExchange.current) {
      prevExchange.current = gameState.exchange;
      setDamageKey((k) => k + 1);
    }
  }, [gameState?.exchange]);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background: arena.bgTint,
      }}
    >
      {/* Arena background panorama */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 1920,
          height: "68%",
          backgroundImage: `url(${arena.bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
        }}
      />

      {/* Vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 50% 35%, transparent 30%, ${arena.bgTint}cc 85%),
            linear-gradient(to bottom, transparent 45%, ${arena.bgTint} 72%)
          `,
          zIndex: 1,
        }}
      />

      {/* Full-width arena ground */}
      <ArenaGround arena={arena} />

      {/* Fighters */}
      <FighterSprite
        characterId={p1Char}
        animState={p1Anim}
        flipX={!p1FacingRight}
        pos={p1Pos}
        arena={arena}
      />
      <FighterSprite
        characterId={p2Char}
        animState={p2Anim}
        flipX={p1FacingRight}
        pos={p2Pos}
        arena={arena}
      />

      {/* Damage popups */}
      {lastResult && lastResult.p2Damage > 0 && (
        <DamagePopup
          key={`p2-${damageKey}`}
          damage={lastResult.p2Damage}
          pos={p2Pos}
          arena={arena}
        />
      )}
      {lastResult && lastResult.p1Damage > 0 && (
        <DamagePopup
          key={`p1-${damageKey}`}
          damage={lastResult.p1Damage}
          pos={p1Pos}
          arena={arena}
        />
      )}

      {/* HUD */}
      {gameState && <FightHUD state={gameState} />}

      {/* Arena name plate */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          color: arena.accentGlow,
          fontSize: 10,
          letterSpacing: 6,
          textTransform: "uppercase",
          fontFamily: "monospace",
          fontWeight: 700,
        }}
      >
        {arena.name}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes damageFloat {
          0% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-60px); }
        }
      `}</style>
    </div>
  );
}
