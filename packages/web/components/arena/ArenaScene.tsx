"use client";

import { useState, useEffect, useRef } from "react";
import { FightHUD } from "./FightHUD";
import type { FightState } from "./useGameState";

// ── Types ──────────────────────────────────────────────────────

type AnimState = "idle" | "attack" | "block" | "dodge" | "hurt" | "ko";

interface ArenaSceneProps {
  gameState: FightState | null;
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
  side,
}: {
  characterId: string;
  animState: AnimState;
  flipX: boolean;
  side: "left" | "right";
}) {
  const [frame, setFrame] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const prevAnimRef = useRef(animState);

  // Reset frame on anim change
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
        return Math.min(f + 1, 3); // one-shot: hold last frame
      });
    }, 1000 / fps);

    return () => clearInterval(timerRef.current);
  }, [animState]);

  const sheetUrl = `/sprites/${characterId}-${animState}-sheet.png`;
  const offsetX = -(frame * 160); // 160px per frame at display size

  const isShaking = animState === "hurt";
  const isKO = animState === "ko";

  return (
    <div
      style={{
        position: "absolute",
        bottom: side === "left" ? 90 : 80,
        left: side === "left" ? "22%" : undefined,
        right: side === "right" ? "22%" : undefined,
        transform: `
          ${flipX ? "scaleX(-1)" : ""}
          ${isShaking ? `translateX(${Math.random() > 0.5 ? 3 : -3}px)` : ""}
          ${isKO ? "rotate(15deg) translateY(20px)" : ""}
        `,
        transition: isShaking ? "none" : "transform 0.3s ease",
        zIndex: 10,
      }}
    >
      {/* Drop shadow on floor */}
      <div
        style={{
          position: "absolute",
          bottom: -12,
          left: "50%",
          transform: "translateX(-50%)",
          width: 100,
          height: 16,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.5)",
          filter: "blur(6px)",
        }}
      />
      {/* Sprite */}
      <div
        style={{
          width: 160,
          height: 160,
          backgroundImage: `url(${sheetUrl})`,
          backgroundSize: "640px 160px",
          backgroundPosition: `${offsetX}px 0`,
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
  side,
}: {
  damage: number;
  side: "left" | "right";
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 1200);
    return () => clearTimeout(t);
  }, []);

  if (!visible || damage === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "30%",
        left: side === "left" ? "26%" : undefined,
        right: side === "right" ? "26%" : undefined,
        color: "#ff3333",
        fontSize: 36,
        fontWeight: 900,
        fontFamily: "monospace",
        textShadow: "0 0 10px #ff0000, 2px 2px 0 #000",
        animation: "damageFloat 1.2s ease-out forwards",
        zIndex: 30,
        pointerEvents: "none",
      }}
    >
      -{damage}
    </div>
  );
}

// ── Arena Floor ────────────────────────────────────────────────

function ArenaFloor() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%) perspective(600px) rotateX(55deg)",
        width: 800,
        height: 400,
        backgroundImage: "url(/sprites/arena-floor.png)",
        backgroundSize: "200px 200px",
        backgroundRepeat: "repeat",
        borderRadius: "50%",
        border: "2px solid rgba(57,255,20,0.3)",
        boxShadow:
          "0 0 60px rgba(57,255,20,0.15), inset 0 0 80px rgba(0,0,0,0.5)",
        imageRendering: "pixelated",
        zIndex: 1,
      }}
    >
      {/* Green glow overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(57,255,20,0.06) 0%, transparent 70%)",
        }}
      />
      {/* Inner ring */}
      <div
        style={{
          position: "absolute",
          inset: 30,
          borderRadius: "50%",
          border: "1px solid rgba(57,255,20,0.15)",
        }}
      />
      {/* Center mark */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#39ff14",
          boxShadow: "0 0 20px #39ff14",
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

export function ArenaScene({ gameState }: ArenaSceneProps) {
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
        background: "#080810",
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
          height: "75%",
          backgroundImage: "url(/sprites/arena-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center bottom",
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
        }}
      />

      {/* Vignette overlay on background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(8,8,16,0.6) 80%),
            linear-gradient(to bottom, transparent 50%, #080810 85%)
          `,
          zIndex: 1,
        }}
      />

      {/* Background-to-floor transition */}
      <div
        style={{
          position: "absolute",
          bottom: "18%",
          left: 0,
          right: 0,
          height: 80,
          background:
            "linear-gradient(to bottom, transparent, rgba(8,8,16,0.95))",
          zIndex: 3,
        }}
      />

      {/* Arena floor */}
      <ArenaFloor />

      {/* Fighters */}
      <FighterSprite
        characterId={p1Char}
        animState={p1Anim}
        flipX={false}
        side="left"
      />
      <FighterSprite
        characterId={p2Char}
        animState={p2Anim}
        flipX={true}
        side="right"
      />

      {/* Damage popups */}
      {lastResult && lastResult.p2Damage > 0 && (
        <DamagePopup
          key={`p2-${damageKey}`}
          damage={lastResult.p2Damage}
          side="right"
        />
      )}
      {lastResult && lastResult.p1Damage > 0 && (
        <DamagePopup
          key={`p1-${damageKey}`}
          damage={lastResult.p1Damage}
          side="left"
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
          color: "rgba(57,255,20,0.3)",
          fontSize: 10,
          letterSpacing: 6,
          textTransform: "uppercase",
          fontFamily: "monospace",
          fontWeight: 700,
        }}
      >
        Agent Battle Arena
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes damageFloat {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-60px); }
        }
      `}</style>
    </div>
  );
}
