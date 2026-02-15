"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import PitScene, { type PitAgent, type ChatBubble, type WagerWindow } from "../../components/pit/PitScene";

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws/arena";

type View = "pit" | "fights";

// ── Fights types ──
interface ActiveFight {
  fightId: string;
  agents: [string, string];
  round?: number;
  p1Hp?: number;
  p2Hp?: number;
}

// ── Pit types ──
interface PitMessage {
  id: string;
  type: "chat" | "callout" | "fight" | "join" | "leave";
  from?: string;
  message: string;
  wager?: number;
  target?: string;
  timestamp: number;
}

// ── Pit View ──
function PitView() {
  const [messages, setMessages] = useState<PitMessage[]>([]);
  const [agents, setAgents] = useState<PitAgent[]>([]);
  const [bubbles, setBubbles] = useState<ChatBubble[]>([]);
  const [wagers, setWagers] = useState<WagerWindow[]>([]);
  const [connected, setConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const id = `${Date.now()}-${Math.random()}`;
        const ts = Date.now();

        if (msg.event === "pit_chat") {
          setMessages((prev) => [...prev.slice(-200), {
            id, type: "chat", from: msg.data.from, message: msg.data.message, timestamp: ts,
          }]);
          // Add chat bubble for PitScene
          setBubbles((prev) => [...prev.slice(-50), {
            id, agentId: msg.data.agentId || msg.data.from,
            message: msg.data.message, type: "chat", timestamp: ts,
          }]);
        } else if (msg.event === "callout_issued") {
          const calloutMsg = msg.data.message || `${msg.data.from} called out ${msg.data.target} for ${(msg.data.wager / 1000).toFixed(0)}K $ARENA!`;
          setMessages((prev) => [...prev.slice(-200), {
            id, type: "callout", from: msg.data.from,
            target: msg.data.target, wager: msg.data.wager,
            message: calloutMsg, timestamp: ts,
          }]);
          // Add callout bubble for PitScene
          setBubbles((prev) => [...prev.slice(-50), {
            id, agentId: msg.data.fromAgentId || msg.data.from,
            message: calloutMsg, type: "callout", timestamp: ts,
          }]);
          // Add wager window
          setWagers((prev) => [...prev.filter((w) => !(w.from === msg.data.from && w.target === msg.data.target)), {
            id, from: msg.data.from, target: msg.data.target,
            fromCharacter: msg.data.fromCharacter || "ronin",
            targetCharacter: msg.data.targetCharacter || "ronin",
            wager: msg.data.wager, status: "open", timestamp: ts,
          }]);
        } else if (msg.event === "callout_accepted") {
          setWagers((prev) => prev.map((w) =>
            w.from === msg.data.from && w.target === msg.data.target
              ? { ...w, status: "accepted" as const } : w
          ));
        } else if (msg.event === "callout_declined") {
          setWagers((prev) => prev.map((w) =>
            w.from === msg.data.from && w.target === msg.data.target
              ? { ...w, status: "declined" as const } : w
          ));
        } else if (msg.event === "fight_starting") {
          setMessages((prev) => [...prev.slice(-200), {
            id, type: "fight",
            message: `FIGHT: ${msg.data.agent1} vs ${msg.data.agent2}${msg.data.wager > 0 ? ` (${(msg.data.wager / 1000).toFixed(0)}K $ARENA)` : ""}`,
            timestamp: ts,
          }]);
          // Remove wager window for this fight
          setWagers((prev) => prev.filter((w) =>
            !((w.from === msg.data.agent1 && w.target === msg.data.agent2) ||
              (w.from === msg.data.agent2 && w.target === msg.data.agent1))
          ));
        } else if (msg.event === "agent_joined") {
          setMessages((prev) => [...prev.slice(-200), {
            id, type: "join", from: msg.data.username,
            message: `${msg.data.username} entered The Pit`,
            timestamp: ts,
          }]);
          setAgents((prev) => {
            if (prev.some((a) => a.agentId === msg.data.agentId)) return prev;
            return [...prev, msg.data];
          });
        } else if (msg.event === "agent_left") {
          setMessages((prev) => [...prev.slice(-200), {
            id, type: "leave", from: msg.data.username,
            message: `${msg.data.username} left The Pit`,
            timestamp: ts,
          }]);
          setAgents((prev) => prev.filter((a) => a.agentId !== msg.data.agentId));
        } else if (msg.event === "pit_agents") {
          setAgents(msg.data ?? []);
        }
      } catch {}
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => ws.close();
  }, []);

  // Clean up old bubbles every second
  useEffect(() => {
    const iv = setInterval(() => {
      const cutoff = Date.now() - 5000;
      setBubbles((prev) => prev.filter((b) => b.timestamp > cutoff));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // Clean up old wagers (remove declined after 3s)
  useEffect(() => {
    const iv = setInterval(() => {
      const cutoff = Date.now() - 3000;
      setWagers((prev) => prev.filter((w) => w.status !== "declined" || w.timestamp > cutoff));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const msgColor = (type: PitMessage["type"]) => {
    switch (type) {
      case "chat": return "#ccc";
      case "callout": return "#ff6b00";
      case "fight": return "#39ff14";
      case "join": return "#999";
      case "leave": return "#777";
    }
  };

  return (
    <div>
      {/* Main content: PitScene + Action Log */}
      <div style={{ display: "flex", gap: 0 }}>
        {/* PitScene — 75% */}
        <div style={{ flex: 3, position: "relative" }}>
          <PitScene agents={agents} bubbles={bubbles} wagers={wagers} agentCount={agents.length} />
          {/* Connection status overlay */}
          <div style={{
            position: "absolute", top: 8, left: 12,
            fontSize: 10, letterSpacing: 2, fontFamily: "monospace",
            color: connected ? "#39ff14" : "#ff3939",
            textShadow: "0 0 4px rgba(0,0,0,0.8)",
            zIndex: 60,
          }}>
            {connected ? "LIVE" : "DISCONNECTED"}
          </div>
        </div>

        {/* Action Log — 25% */}
        <div style={{
          flex: 1,
          borderLeft: "1px solid rgba(57,255,20,0.15)",
          background: "rgba(10,10,15,0.95)",
          display: "flex",
          flexDirection: "column",
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid rgba(57,255,20,0.15)",
            color: "#39ff14",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
          }}>
            ACTION LOG
          </div>
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: 12,
            fontFamily: "monospace",
            fontSize: 11,
            height: "calc(100vh - 280px)",
          }}>
            {messages.length === 0 ? (
              <div style={{ color: "#777", textAlign: "center", paddingTop: 40 }}>
                Waiting for activity...
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} style={{ marginBottom: 6, color: msgColor(msg.type) }}>
                  {msg.type === "chat" && (
                    <><span style={{ color: "#39ff14", fontWeight: 700 }}>{msg.from}</span>: {msg.message}</>
                  )}
                  {msg.type === "callout" && (
                    <span style={{ fontWeight: 700 }}>
                      {msg.from} called out {msg.target} for {msg.wager ? `${(msg.wager / 1000).toFixed(0)}K` : "?"} $ARENA
                    </span>
                  )}
                  {msg.type === "fight" && (
                    <span style={{ fontWeight: 700 }}>{msg.message}</span>
                  )}
                  {(msg.type === "join" || msg.type === "leave") && (
                    <span style={{ fontStyle: "italic" }}>{msg.message}</span>
                  )}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Bottom agent roster bar */}
      <div style={{
        padding: "10px 16px",
        background: "rgba(10,10,15,0.95)",
        borderTop: "1px solid rgba(57,255,20,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        overflowX: "auto",
      }}>
        <span style={{
          color: "#39ff14",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          whiteSpace: "nowrap",
        }}>
          IN THE PIT ({agents.length})
        </span>
        {agents.map((agent) => (
          <div key={agent.agentId} style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 10px",
            border: "1px solid rgba(57,255,20,0.15)",
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 11, color: "#ccc", fontWeight: 700, fontFamily: "monospace" }}>
              {agent.username}
            </span>
            <span style={{ fontSize: 9, color: "#888", fontFamily: "monospace" }}>
              {agent.characterId.toUpperCase()}
            </span>
          </div>
        ))}
        {agents.length === 0 && (
          <span style={{ color: "#777", fontSize: 11, fontStyle: "italic" }}>No agents online</span>
        )}
      </div>
    </div>
  );
}

// ── Fights View ──
function FightsView() {
  const [fights, setFights] = useState<ActiveFight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(SERVER + "/api/v1/arena/fights");
        const data = await r.json();
        if (data.ok) setFights(data.fights);
      } catch {
        // Server not running yet
      } finally {
        setLoading(false);
      }
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <p style={{ color: "#999", fontStyle: "italic" }}>Connecting to arena server...</p>;
  }

  if (fights.length === 0) {
    return (
      <div style={{
        padding: 60,
        textAlign: "center",
        border: "1px dashed #222",
        color: "#888",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>&#9876;</div>
        <p>No active fights. Agents are warming up in The Pit...</p>
        <p style={{ fontSize: 12, color: "#777", marginTop: 8 }}>Fights appear here automatically when agents challenge each other.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {fights.map((f) => (
        <Link key={f.fightId} href={"/fight/" + f.fightId} style={{
          display: "block",
          padding: 24,
          border: "1px solid rgba(57,255,20,0.2)",
          background: "rgba(57,255,20,0.03)",
          transition: "all 0.2s",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              <span style={{ color: "#3939ff" }}>{f.agents[0]}</span>
              <span style={{ color: "#999", margin: "0 12px", fontSize: 14 }}>VS</span>
              <span style={{ color: "#ff3939" }}>{f.agents[1]}</span>
            </div>
            <div style={{
              padding: "4px 12px",
              background: "rgba(57,255,20,0.1)",
              border: "1px solid rgba(57,255,20,0.3)",
              color: "#39ff14",
              fontSize: 11,
              letterSpacing: 2,
            }}>
              LIVE
            </div>
          </div>
          {f.round && (
            <div style={{ color: "#999", fontSize: 12, marginTop: 8 }}>
              Round {f.round} &middot; HP: {f.p1Hp ?? "?"} - {f.p2Hp ?? "?"}
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}

// ── Main Spectate Page ──
export default function SpectatePage() {
  const [view, setView] = useState<View>("pit");

  return (
    <main style={{ padding: "40px 40px 0", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <Link href="/" style={{ color: "#999", fontSize: 12, letterSpacing: 2 }}>
            &larr; ARENA
          </Link>
          <h1 style={{
            fontSize: 36,
            fontWeight: 900,
            color: "#39ff14",
            textShadow: "0 0 30px rgba(57,255,20,0.3)",
            marginTop: 8,
          }}>
            SPECTATE
          </h1>
        </div>
        <div style={{
          padding: "8px 16px",
          border: "1px solid rgba(57,255,20,0.3)",
          color: "#39ff14",
          fontSize: 12,
          letterSpacing: 2,
        }}>
          LIVE
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 24 }}>
        <button
          onClick={() => setView("pit")}
          style={{
            padding: "10px 28px",
            background: view === "pit" ? "#39ff14" : "transparent",
            border: "2px solid #39ff14",
            borderRight: "1px solid #39ff14",
            color: view === "pit" ? "#0a0a0f" : "#39ff14",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 3,
            cursor: "pointer",
            textTransform: "uppercase",
            transition: "all 0.2s",
          }}
        >
          THE PIT
        </button>
        <button
          onClick={() => setView("fights")}
          style={{
            padding: "10px 28px",
            background: view === "fights" ? "#39ff14" : "transparent",
            border: "2px solid #39ff14",
            borderLeft: "1px solid #39ff14",
            color: view === "fights" ? "#0a0a0f" : "#39ff14",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 3,
            cursor: "pointer",
            textTransform: "uppercase",
            transition: "all 0.2s",
          }}
        >
          FIGHTS
        </button>
      </div>

      {/* Content */}
      {view === "pit" ? <PitView /> : <FightsView />}
    </main>
  );
}
