import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api, wsUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, RotateCw, Send, Cast, CastOff, Film, Smile,
  SkipBack, SkipForward, Users, MonitorOff, ExternalLink,
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
  const localStreamRef = useRef(null);
  const videoRef = useRef(null);
  const peersRef = useRef({}); // user_id -> RTCPeerConnection

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
      if (videoRef.current) videoRef.current.srcObject = stream;
      setSharing(true);
      wsRef.current?.send(JSON.stringify({ type: "screenshare-start" }));
      // Create peer to each viewer
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
      if (videoRef.current) videoRef.current.srcObject = ev.streams[0];
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
      try { await pc.addIceCandidate(signal); } catch {}
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
        <div className="p-10 font-mono text-xs tracking-[0.3em] uppercase text-[#99958E]" data-testid="room-loading">Loading…</div>
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
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#E5A93C] mb-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-[#FF3B00] pulse-live" /> Live · {PLATFORM_LABEL[room.platform]}
            </div>
            <h1 className="font-head text-2xl sm:text-3xl uppercase leading-none" data-testid="watch-room-name">{room.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[#99958E] px-3 py-2 border border-white/10 bg-[#141211]">
              Room: <span className="text-[#E5A93C]">{roomId}</span>
            </div>
            <button
              onClick={leave}
              data-testid="watch-leave-button"
              className="border border-white/20 font-mono text-xs tracking-widest uppercase px-4 py-2 hover:border-[#FF3B00] hover:text-[#FF3B00]"
            >
              Exit
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Stage */}
          <section className="lg:col-span-3 bg-[#0A0908] border border-white/10 relative overflow-hidden h-[62vh] lg:h-[78vh] flex flex-col">
            <div className="flex-1 relative flex items-center justify-center">
              {/* Video surface: remote or own share */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isHost} /* host mutes own share preview */
                className={`w-full h-full object-contain ${sharing || remoteSharerId ? "block" : "hidden"}`}
                data-testid="watch-video-surface"
              />
              {!sharing && !remoteSharerId && (
                <div className="text-center px-6">
                  <div className="font-head text-5xl uppercase text-[#E5A93C] mb-3">Intermission</div>
                  <p className="text-[#99958E] max-w-md mx-auto mb-6">
                    Open <span className="font-mono text-[#E5A93C]">{PLATFORM_LABEL[room.platform]}</span> in a new tab and hit play — your room syncs the timer.
                    {isHost && " Or start screen-share to broadcast your window."}
                  </p>
                  <div className="flex justify-center gap-3 flex-wrap">
                    {room.platform !== "custom" && (
                      <a
                        href={PLATFORM_URL[room.platform]}
                        target="_blank"
                        rel="noreferrer"
                        data-testid="watch-open-platform-link"
                        className="inline-flex items-center gap-2 border border-white/20 font-mono text-xs tracking-widest uppercase px-4 py-3 hover:border-[#E5A93C] hover:text-[#E5A93C]"
                      >
                        <ExternalLink size={13} /> Open {PLATFORM_LABEL[room.platform]}
                      </a>
                    )}
                  </div>
                </div>
              )}
              {remoteSharerId && !sharing && (
                <div className="absolute top-3 left-3 px-3 py-1.5 bg-[#0A0908]/80 border border-[#E5A93C]/40 text-[#E5A93C] font-mono text-[10px] tracking-[0.25em] uppercase">
                  Sharing · {remoteSharerName}
                </div>
              )}
            </div>

            {/* Sync control bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0A0908]/85 backdrop-blur-xl border border-white/10 px-4 py-3 flex gap-4 items-center rounded-sm shadow-2xl"
                 data-testid="sync-control-bar">
              <button
                onClick={() => seek(-10)}
                disabled={!isHost}
                data-testid="sync-back-10"
                className="text-[#F7F7F2] hover:text-[#E5A93C] disabled:opacity-40 disabled:hover:text-[#F7F7F2]"
                title="-10s"
              >
                <SkipBack size={20} />
              </button>
              <button
                onClick={onPlayPause}
                disabled={!isHost}
                data-testid="sync-play-pause"
                className="w-11 h-11 bg-[#E5A93C] text-[#0A0908] flex items-center justify-center hover:bg-[#F0B955] disabled:opacity-40 disabled:hover:bg-[#E5A93C]"
                title={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                onClick={() => seek(10)}
                disabled={!isHost}
                data-testid="sync-fwd-10"
                className="text-[#F7F7F2] hover:text-[#E5A93C] disabled:opacity-40 disabled:hover:text-[#F7F7F2]"
                title="+10s"
              >
                <SkipForward size={20} />
              </button>
              <div className="w-px h-8 bg-white/10" />
              <div className="font-mono text-xs tracking-widest text-[#F7F7F2]" data-testid="sync-timer">
                {fmtTime(position)}
              </div>
              {isHost && (
                <>
                  <div className="w-px h-8 bg-white/10" />
                  <button
                    onClick={resetTimer}
                    data-testid="sync-reset"
                    className="text-[#99958E] hover:text-[#E5A93C]"
                    title="Reset timer"
                  >
                    <RotateCcw size={16} />
                  </button>
                </>
              )}
              <div className="w-px h-8 bg-white/10" />
              {isHost ? (
                !sharing ? (
                  <button
                    onClick={startShare}
                    data-testid="screenshare-start-button"
                    className="text-[#F7F7F2] hover:text-[#E5A93C] flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase"
                  >
                    <Cast size={16} /> Share
                  </button>
                ) : (
                  <button
                    onClick={stopShare}
                    data-testid="screenshare-stop-button"
                    className="text-[#FF3B00] hover:text-[#FF3B00] flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase"
                  >
                    <MonitorOff size={16} /> Stop
                  </button>
                )
              ) : (
                <span className="font-mono text-[10px] tracking-widest uppercase text-[#99958E]">Guest</span>
              )}
            </div>
          </section>

          {/* Chat & participants */}
          <aside className="border border-white/10 bg-[#141211] flex flex-col h-[62vh] lg:h-[78vh]">
            {/* Participants strip */}
            <div className="border-b border-white/10 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-[#E5A93C]" />
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#E5A93C]">
                  In the theatre · {presence.length}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto" data-testid="watch-participants">
                {presence.map((p) => {
                  const m = memberMap[p.id];
                  return (
                    <div key={p.id} className="flex flex-col items-center gap-1 shrink-0" title={p.name}>
                      <div className={`w-10 h-10 border ${room.host_id === p.id ? "border-[#E5A93C]" : "border-white/10"} bg-[#0A0908] flex items-center justify-center font-head text-sm`}>
                        {m?.profile_image ? (
                          <img src={m.profile_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          p.name?.[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="font-mono text-[9px] tracking-widest uppercase text-[#99958E] max-w-[64px] truncate">
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
                  className={`border-l-2 pl-3 py-1 ${m.sender_id === room.host_id ? "border-[#E5A93C]" : "border-[#5C5A56]"}`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className={`font-mono text-[10px] tracking-widest uppercase ${m.sender_id === room.host_id ? "text-[#E5A93C]" : "text-[#99958E]"}`}>
                      {m.sender_name}
                    </span>
                    <span className="font-mono text-[9px] text-[#5C5A56]">
                      {new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-[#F7F7F2] text-sm break-words">{m.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Composer */}
            <form onSubmit={sendMessage} className="border-t border-white/10 p-3">
              <div className="relative">
                {showEmoji && (
                  <div className="absolute bottom-12 left-0 right-0 bg-[#0A0908] border border-white/10 p-2 grid grid-cols-9 gap-1 z-10">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setMsgText((t) => t + e)}
                        className="text-lg hover:bg-white/5 rounded"
                      >{e}</button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmoji((s) => !s)}
                    data-testid="chat-emoji-toggle"
                    className="text-[#99958E] hover:text-[#E5A93C] p-2"
                  >
                    <Smile size={18} />
                  </button>
                  <input
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Send a message…"
                    data-testid="chat-input"
                    className="flex-1 bg-[#0A0908] border border-white/10 focus:border-[#E5A93C] px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    data-testid="chat-send-button"
                    className="bg-[#E5A93C] text-[#0A0908] px-3 py-2 hover:bg-[#F0B955]"
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
