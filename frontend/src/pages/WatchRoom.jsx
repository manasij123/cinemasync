import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api, wsUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, RotateCw, Send, Cast, CastOff, Film, Smile,
  SkipBack, SkipForward, Users, MonitorOff, ExternalLink, Maximize2, Minimize2,
  MessageSquare, MessageSquareOff,
} from "lucide-react";

const PLATFORM_LABEL = {
  netflix: "Netflix", prime: "Prime Video", hotstar: "Hotstar",
  hoichoi: "Hoichoi", addatimes: "Adda Times", zee5: "ZEE5", custom: "Custom",
};

const PLATFORM_URL = {
  netflix: "https://www.netflix.com/",
  prime: "https://www.primevideo.com/",
  hotstar: "https://www.hotstar.com/",
  hoichoi: "https://www.hoichoi.tv/",
  addatimes: "https://www.addatimes.com/",
  zee5: "https://www.zee5.com/",
};

const EMOJIS = ["😂","🔥","🎬","🍿","😱","❤️","👏","🤣","😭","🥹","😎","💀","👀","🎉","💯","🙌","🤯","👍"];

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function fmtTime(s) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${h > 0 ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function WatchRoom() {
  const { roomId } = useParams();
  const { user, formatApiError } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [presence, setPresence] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);

  // Playback (host authoritative)
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(Date.now());

  // Screen share
  const [sharing, setSharing] = useState(false);
  const [remoteSharerId, setRemoteSharerId] = useState(null);
  const [remoteSharerName, setRemoteSharerName] = useState("");
  const [videoMuted, setVideoMuted] = useState(true);

  // Fullscreen / chat collapse
  const [fullscreen, setFullscreen] = useState(false);
  const [chatOpenInFs, setChatOpenInFs] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const localStreamRef = useRef(null);
  const videoRef = useRef(null);
  const peersRef = useRef({}); // user_id -> RTCPeerConnection
  const stageRef = useRef(null);
  const idleTimerRef = useRef(null);

  const wsRef = useRef(null);
  const chatEndRef = useRef(null);

  const isHost = room && room.host_id === user.id;

  // --- load initial room ---
  const loadRoom = useCallback(async () => {
    try {
      const { data } = await api.get(`/rooms/${roomId}`);
      setRoom(data.room);
      setMembers(data.members || []);
      setPlaying(!!data.room.state?.playing);
      setPosition(Number(data.room.state?.position || 0));
      setLastSyncAt(Date.now());
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
      navigate("/dashboard");
    }
  }, [roomId]);

  useEffect(() => {
    loadRoom();
    (async () => {
      try {
        const { data } = await api.get(`/rooms/${roomId}/messages`);
        setMessages(data.messages || []);
      } catch {}
    })();
  }, [loadRoom, roomId]);

  // --- websocket ---
  useEffect(() => {
    if (!room) return;
    const token = localStorage.getItem("cs_token") || "";
    const ws = new WebSocket(wsUrl(`/api/ws/room/${roomId}${token ? `?token=${encodeURIComponent(token)}` : ""}`));
    wsRef.current = ws;

    ws.onopen = () => {};
    ws.onclose = () => {};
    ws.onerror = () => {};

    ws.onmessage = async (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }
      if (msg.type === "hello") {
        setPresence(msg.participants || []);
        if (msg.state) {
          setPlaying(!!msg.state.playing);
          setPosition(Number(msg.state.position || 0));
          setLastSyncAt(Date.now());
        }
      } else if (msg.type === "presence") {
        setPresence(msg.participants || []);
        // Host-only: toast when someone leaves, offer auto-pause
        if (msg.left && room && room.host_id === user.id && msg.left.id !== user.id) {
          toast(`${msg.left.name} left the room`, {
            description: playing ? "Tap to pause playback" : "Room continues",
            action: playing
              ? {
                  label: "Pause",
                  onClick: () => {
                    setPlaying(false);
                    wsRef.current?.send(JSON.stringify({
                      type: "sync", action: "pause", playing: false, position,
                    }));
                  },
                }
              : undefined,
          });
        }
        if (msg.joined && room && msg.joined.id !== user.id) {
          toast.success(`${msg.joined.name} joined`);
          // If host is currently sharing, proactively re-announce + offer stream to new joiner
          if (room.host_id === user.id && localStreamRef.current) {
            wsRef.current?.send(JSON.stringify({ type: "screenshare-start" }));
            createOfferTo(msg.joined.id, localStreamRef.current).catch(() => {});
          }
        }
      } else if (msg.type === "sync") {
        setPlaying(!!msg.state.playing);
        setPosition(Number(msg.state.position || 0));
        setLastSyncAt(Date.now());
      } else if (msg.type === "chat") {
        setMessages((prev) => [...prev, msg.message]);
      } else if (msg.type === "platform-change") {
        setRoom((r) => (r ? { ...r, platform: msg.platform } : r));
      } else if (msg.type === "screenshare-start") {
        setRemoteSharerId(msg.from);
        setRemoteSharerName(msg.from_name);
        // As viewer, create a peer and send offer request? We'll wait for host to initiate offer.
        // Host will proactively create offers to all non-host peers.
      } else if (msg.type === "screenshare-stop") {
        setRemoteSharerId(null);
        setRemoteSharerName("");
        setVideoMuted(true);
        if (videoRef.current) videoRef.current.srcObject = null;
      } else if (msg.type === "webrtc-signal") {
        await handleSignal(msg);
      }
    };

    return () => { try { ws.close(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  // Local clock: advance position when playing
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPosition((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, [playing]);

  // Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Native Fullscreen API + auto-hide controls
  useEffect(() => {
    const handler = () => {
      const isFs = !!document.fullscreenElement;
      setFullscreen(isFs);
      if (!isFs) setChatOpenInFs(false);
      setControlsVisible(true);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (stageRef.current && stageRef.current.requestFullscreen) {
          await stageRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      toast.error("Fullscreen blocked by browser");
    }
  };

  // Mouse-idle auto-hide of controls while in fullscreen
  useEffect(() => {
    if (!fullscreen) {
      setControlsVisible(true);
      return;
    }
    const ping = () => {
      setControlsVisible(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setControlsVisible(false), 2500);
    };
    ping();
    const el = stageRef.current;
    el?.addEventListener("mousemove", ping);
    el?.addEventListener("touchstart", ping);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      el?.removeEventListener("mousemove", ping);
      el?.removeEventListener("touchstart", ping);
    };
  }, [fullscreen]);

  // --- host controls ---
  const sendSync = (action, nextPlaying, nextPos) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({
      type: "sync",
      action,
      playing: nextPlaying,
      position: nextPos,
    }));
  };

  const onPlayPause = () => {
    if (!isHost) return toast.error("Only the host can control playback");
    const next = !playing;
    setPlaying(next);
    setLastSyncAt(Date.now());
    sendSync(next ? "play" : "pause", next, position);
  };

  const seek = (delta) => {
    if (!isHost) return toast.error("Only the host can seek");
    const next = Math.max(0, position + delta);
    setPosition(next);
    setLastSyncAt(Date.now());
    sendSync("seek", playing, next);
  };

  const resetTimer = () => {
    if (!isHost) return;
    setPosition(0);
    sendSync("seek", playing, 0);
  };

  // --- chat ---
  const sendMessage = (e) => {
    e?.preventDefault();
    const t = msgText.trim();
    if (!t) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "chat", text: t }));
    setMsgText("");
    setShowEmoji(false);
  };

  // --- webrtc screen share ---
  // Host creates PeerConnection to each viewer and offers the stream
  const startShare = async () => {
    if (!isHost) {
      toast.error("Only host can screen-share in this version");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true; // avoid echo for host
        try { await videoRef.current.play(); } catch {}
      }
      setSharing(true);
      wsRef.current?.send(JSON.stringify({ type: "screenshare-start" }));
      // Create peer to each viewer (use latest presence)
      const viewers = presence.filter((p) => p.id !== user.id);
      for (const v of viewers) {
        await createOfferTo(v.id, stream);
      }
      // Auto stop handler
      stream.getVideoTracks()[0].onended = () => stopShare();
    } catch (e) {
      toast.error("Screen share cancelled or blocked");
    }
  };

  const stopShare = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setSharing(false);
    if (videoRef.current) videoRef.current.srcObject = null;
    Object.values(peersRef.current).forEach((pc) => { try { pc.close(); } catch {} });
    peersRef.current = {};
    wsRef.current?.send(JSON.stringify({ type: "screenshare-stop" }));
  };

  const getOrCreatePeer = (peerId) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        wsRef.current?.send(JSON.stringify({
          type: "webrtc-signal",
          to: peerId,
          kind: "ice",
          signal: ev.candidate,
        }));
      }
    };
    pc.ontrack = (ev) => {
      console.log("[CinemaSync] ontrack fired from peer", peerId, "streams:", ev.streams.length);
      if (videoRef.current) {
        // Mute initially to satisfy browser autoplay policy — user can tap to unmute
        videoRef.current.muted = true;
        videoRef.current.srcObject = ev.streams[0];
        const play = videoRef.current.play();
        if (play && typeof play.catch === "function") play.catch((err) => {
          console.warn("[CinemaSync] video.play() failed (expected in some cases):", err?.name);
        });
      }
    };
    pc.onconnectionstatechange = () => {
      console.log("[CinemaSync] peer", peerId, "state:", pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        try { pc.close(); } catch {}
        delete peersRef.current[peerId];
      }
    };
    peersRef.current[peerId] = pc;
    return pc;
  };

  const createOfferTo = async (peerId, stream) => {
    const pc = getOrCreatePeer(peerId);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsRef.current?.send(JSON.stringify({
      type: "webrtc-signal",
      to: peerId,
      kind: "offer",
      signal: offer,
    }));
  };

  const handleSignal = async (msg) => {
    const from = msg.from;
    const kind = msg.kind;
    const signal = msg.signal;
    const pc = getOrCreatePeer(from);

    if (kind === "offer") {
      // Receiving an offer implies the sender is sharing — unhide the video
      // surface even if we missed the screenshare-start broadcast.
      setRemoteSharerId(from);
      setRemoteSharerName(msg.from_name || "Host");
      setVideoMuted(true);
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsRef.current?.send(JSON.stringify({
        type: "webrtc-signal",
        to: from,
        kind: "answer",
        signal: answer,
      }));
    } else if (kind === "answer") {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (kind === "ice") {
      try { await pc.addIceCandidate(new RTCIceCandidate(signal)); } catch {}
    }
  };

  const leave = async () => {
    try { wsRef.current?.close(); } catch {}
    try { await api.post(`/rooms/${roomId}/leave`); } catch {}
    navigate("/dashboard");
  };

  const memberMap = useMemo(() => {
    const m = {};
    for (const u of members) m[u.id] = u;
    return m;
  }, [members]);

  if (!room) {
    return (
      <div>
        <Navbar />
        <div className="p-10 font-mono text-xs tracking-[0.3em] uppercase text-[#7a6a55]" data-testid="room-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#d4a373] mb-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-[#a04a2f] pulse-live" /> Live · {PLATFORM_LABEL[room.platform]}
            </div>
            <h1 className="font-head text-2xl sm:text-3xl uppercase leading-none" data-testid="watch-room-name">{room.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[#7a6a55] px-3 py-2 border border-[#d4a373]/30 bg-[#faedcd]">
              Room: <span className="text-[#d4a373]">{roomId}</span>
            </div>
            <button
              onClick={leave}
              data-testid="watch-leave-button"
              className="border border-[#d4a373]/45 font-mono text-xs tracking-widest uppercase px-4 py-2 hover:border-[#a04a2f] hover:text-[#a04a2f]"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Stage */}
          <section
            ref={stageRef}
            className={
              "relative overflow-hidden flex flex-col border " +
              (fullscreen
                ? "bg-black border-black h-screen w-screen lg:col-span-4 cursor-[auto]"
                : "bg-[#fefae0] border-[#d4a373]/30 lg:col-span-3 h-[55vh] sm:h-[62vh] lg:h-[78vh]")
            }
          >
            <div className="flex-1 relative flex items-center justify-center">
              {/* Video surface: remote or own share */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-contain bg-[#0A0908] ${sharing || remoteSharerId ? "block" : "hidden"}`}
                data-testid="watch-video-surface"
              />
              {remoteSharerId && !sharing && (
                <button
                  onClick={() => {
                    if (videoRef.current) {
                      const next = !videoRef.current.muted;
                      videoRef.current.muted = next ? false : true;
                      setVideoMuted(videoRef.current.muted);
                      const p = videoRef.current.play();
                      if (p && typeof p.catch === "function") p.catch(() => {});
                    }
                  }}
                  data-testid="watch-unmute-button"
                  className="absolute top-3 right-3 bg-[#fefae0]/95 border border-[#d4a373] text-[#2b2118] px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] uppercase hover:bg-[#d4a373]/20 z-10"
                  title="Toggle audio"
                >
                  {videoMuted ? "🔇 Tap to unmute" : "🔊 Unmuted"}
                </button>
              )}
              {/* Fullscreen toggle — available to everyone */}
              <button
                onClick={toggleFullscreen}
                data-testid="watch-fullscreen-button"
                className={
                  "absolute top-3 left-3 border p-2 font-mono z-10 transition-opacity duration-300 " +
                  (fullscreen
                    ? "bg-black/70 border-white/30 text-white hover:bg-white/10"
                    : "bg-[#fefae0]/95 border-[#d4a373] text-[#2b2118] hover:bg-[#d4a373]/20") +
                  (fullscreen && !controlsVisible ? " opacity-0 pointer-events-none" : " opacity-100")
                }
                title={fullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
              >
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              {/* Chat toggle (only while fullscreen) — overlay */}
              {fullscreen && (
                <button
                  onClick={() => setChatOpenInFs((v) => !v)}
                  data-testid="watch-chat-toggle-button"
                  className={
                    "absolute top-3 left-14 bg-black/70 border border-white/30 text-white p-2 z-10 transition-opacity duration-300 hover:bg-white/10 " +
                    (controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none")
                  }
                  title={chatOpenInFs ? "Hide chat" : "Show chat"}
                >
                  {chatOpenInFs ? <MessageSquareOff size={16} /> : <MessageSquare size={16} />}
                </button>
              )}
              {!sharing && !remoteSharerId && !fullscreen && (
                <div className="text-center px-6">
                  <div className="font-head text-3xl sm:text-5xl uppercase text-[#d4a373] mb-3">Intermission</div>
                  <p className="text-[#7a6a55] max-w-md mx-auto mb-6">
                    Open <span className="font-mono text-[#d4a373]">{PLATFORM_LABEL[room.platform]}</span> in a new tab and hit play — your room syncs the timer.
                    {isHost && " Or start screen-share to broadcast your window."}
                  </p>
                  <div className="flex justify-center gap-3 flex-wrap">
                    {room.platform !== "custom" && (
                      <a
                        href={PLATFORM_URL[room.platform]}
                        target="_blank"
                        rel="noreferrer"
                        data-testid="watch-open-platform-link"
                        className="inline-flex items-center gap-2 border border-[#d4a373]/45 font-mono text-xs tracking-widest uppercase px-4 py-3 hover:border-[#d4a373] hover:text-[#d4a373]"
                      >
                        <ExternalLink size={13} /> Open {PLATFORM_LABEL[room.platform]}
                      </a>
                    )}
                  </div>
                </div>
              )}
              {remoteSharerId && !sharing && (
                <div className="absolute top-3 left-3 px-3 py-1.5 bg-[#fefae0]/80 border border-[#d4a373]/40 text-[#d4a373] font-mono text-[10px] tracking-[0.25em] uppercase">
                  Sharing · {remoteSharerName}
                </div>
              )}
            </div>

            {/* Sync control bar */}
            <div className={
              "absolute bottom-6 left-1/2 -translate-x-1/2 backdrop-blur-xl border px-4 py-3 flex gap-4 items-center rounded-sm shadow-2xl transition-opacity duration-300 " +
              (fullscreen
                ? "bg-black/70 border-white/20 text-white"
                : "bg-[#fefae0]/85 border-[#d4a373]/30") +
              (fullscreen && !controlsVisible ? " opacity-0 pointer-events-none" : " opacity-100")
            }
                 data-testid="sync-control-bar">
              <button
                onClick={() => seek(-10)}
                disabled={!isHost}
                data-testid="sync-back-10"
                className="text-[#2b2118] hover:text-[#d4a373] disabled:opacity-40 disabled:hover:text-[#2b2118]"
                title="-10s"
              >
                <SkipBack size={20} />
              </button>
              <button
                onClick={onPlayPause}
                disabled={!isHost}
                data-testid="sync-play-pause"
                className="w-10 h-10 sm:w-11 sm:h-11 bg-[#d4a373] text-[#2b2118] flex items-center justify-center hover:bg-[#c08456] disabled:opacity-40 disabled:hover:bg-[#d4a373]"
                title={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                onClick={() => seek(10)}
                disabled={!isHost}
                data-testid="sync-fwd-10"
                className="text-[#2b2118] hover:text-[#d4a373] disabled:opacity-40 disabled:hover:text-[#2b2118]"
                title="+10s"
              >
                <SkipForward size={20} />
              </button>
              <div className="w-px h-8 bg-[#d4a373]/15" />
              <div className="font-mono text-xs tracking-widest text-[#2b2118]" data-testid="sync-timer">
                {fmtTime(position)}
              </div>
              {isHost && (
                <>
                  <div className="w-px h-8 bg-[#d4a373]/15" />
                  <button
                    onClick={resetTimer}
                    data-testid="sync-reset"
                    className="text-[#7a6a55] hover:text-[#d4a373]"
                    title="Reset timer"
                  >
                    <RotateCcw size={16} />
                  </button>
                </>
              )}
              <div className="w-px h-8 bg-[#d4a373]/15" />
              {isHost ? (
                !sharing ? (
                  <button
                    onClick={startShare}
                    data-testid="screenshare-start-button"
                    className="text-[#2b2118] hover:text-[#d4a373] flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase"
                  >
                    <Cast size={16} /> Share
                  </button>
                ) : (
                  <button
                    onClick={stopShare}
                    data-testid="screenshare-stop-button"
                    className="text-[#a04a2f] hover:text-[#a04a2f] flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase"
                  >
                    <MonitorOff size={16} /> Stop
                  </button>
                )
              ) : (
                <span className={"font-mono text-[10px] tracking-widest uppercase " + (fullscreen ? "text-white/60" : "text-[#7a6a55]")}>Guest</span>
              )}
            </div>

            {/* In-stage chat overlay (only in fullscreen) */}
            {fullscreen && chatOpenInFs && (
              <div className={
                "absolute top-0 right-0 bottom-0 w-[320px] max-w-[85vw] bg-black/80 backdrop-blur-xl border-l border-white/10 flex flex-col text-white z-20 transition-opacity duration-300 " +
                (controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none")
              }>
                <div className="border-b border-white/10 p-3">
                  <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/70">
                    In the theatre · {presence.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className={"border-l-2 pl-2 py-0.5 " + (m.sender_id === room.host_id ? "border-[#d4a373]" : "border-[#a3b18a]")}>
                      <div className="flex items-baseline gap-2">
                        <span className={"font-mono text-[10px] tracking-widest uppercase " + (m.sender_id === room.host_id ? "text-[#d4a373]" : "text-[#a3b18a]")}>
                          {m.sender_name}
                        </span>
                      </div>
                      <div className="text-white text-sm break-words">{m.text}</div>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendMessage} className="border-t border-white/10 p-2 flex gap-2">
                  <input
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Message…"
                    data-testid="chat-input-fs"
                    className="flex-1 bg-white/5 border border-white/10 focus:border-white/40 px-2 py-1.5 text-sm text-white placeholder-white/40"
                  />
                  <button type="submit" className="bg-[#d4a373] text-[#2b2118] px-2 py-1.5 hover:bg-[#c08456]">
                    <Send size={14} />
                  </button>
                </form>
              </div>
            )}
          </section>

          {/* Chat & participants — hidden entirely in native fullscreen */}
          <aside className={
            (fullscreen ? "hidden" : "flex") +
            " border border-[#d4a373]/30 bg-[#faedcd] flex-col h-[55vh] sm:h-[62vh] lg:h-[78vh]"
          }>
            {/* Participants strip */}
            <div className="border-b border-[#d4a373]/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-[#d4a373]" />
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#d4a373]">
                  In the theatre · {presence.length}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto" data-testid="watch-participants">
                {presence.map((p) => {
                  const m = memberMap[p.id];
                  return (
                    <div key={p.id} className="flex flex-col items-center gap-1 shrink-0" title={p.name}>
                      <div className={`w-10 h-10 border ${room.host_id === p.id ? "border-[#d4a373]" : "border-[#d4a373]/30"} bg-[#fefae0] flex items-center justify-center font-head text-sm`}>
                        {m?.profile_image ? (
                          <img src={m.profile_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          p.name?.[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="font-mono text-[9px] tracking-widest uppercase text-[#7a6a55] max-w-[64px] truncate">
                        {p.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="chat-messages">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`border-l-2 pl-3 py-1 ${m.sender_id === room.host_id ? "border-[#d4a373]" : "border-[#a3b18a]"}`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className={`font-mono text-[10px] tracking-widest uppercase ${m.sender_id === room.host_id ? "text-[#d4a373]" : "text-[#a3b18a]"}`}>
                      {m.sender_name}
                    </span>
                    <span className="font-mono text-[9px] text-[#a89578]">
                      {new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-[#2b2118] text-sm break-words">{m.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Composer */}
            <form onSubmit={sendMessage} className="border-t border-[#d4a373]/30 p-3">
              <div className="relative">
                {showEmoji && (
                  <div className="absolute bottom-12 left-0 right-0 bg-[#fefae0] border border-[#d4a373]/30 p-2 grid grid-cols-9 gap-1 z-10">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setMsgText((t) => t + e)}
                        className="text-lg hover:bg-[#d4a373]/10 rounded"
                      >{e}</button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmoji((s) => !s)}
                    data-testid="chat-emoji-toggle"
                    className="text-[#7a6a55] hover:text-[#d4a373] p-2"
                  >
                    <Smile size={18} />
                  </button>
                  <input
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Send a message…"
                    data-testid="chat-input"
                    className="flex-1 bg-[#fefae0] border border-[#d4a373]/30 focus:border-[#d4a373] px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    data-testid="chat-send-button"
                    className="bg-[#d4a373] text-[#2b2118] px-3 py-2 hover:bg-[#c08456]"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}
