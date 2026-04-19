import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api, wsUrl } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  Play, Pause, RotateCcw, RotateCw, Send, Cast, CastOff, Film, Smile,
  SkipBack, SkipForward, Users, MonitorOff, ExternalLink, Maximize2, Minimize2,
  MessageSquare, MessageSquareOff, Mic, MicOff, Video, VideoOff, Headphones,
} from "lucide-react";
import PlatformLogo from "../components/PlatformLogo";

const PLATFORM_LABEL = {
  netflix: "Netflix", prime: "Prime Video", hotstar: "JioHotstar",
  hoichoi: "Hoichoi", addatimes: "Addatimes", zee5: "ZEE5", custom: "Custom",
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

// Fallback — replaced at runtime by fetchIceServers()
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function VoiceTile({ self = false, name, stream, videoRef, hasVideo, hasAudio }) {
  const localRef = useRef(null);
  const targetRef = videoRef || localRef;
  useEffect(() => {
    if (targetRef.current && stream) {
      targetRef.current.srcObject = stream;
      const p = targetRef.current.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [stream, targetRef]);
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";
  return (
    <div
      data-testid={`voice-tile-${self ? "self" : name}`}
      className="relative w-36 h-24 bg-black/80 border border-white/20 rounded-md overflow-hidden shadow-[0_6px_20px_rgba(26,11,46,0.35)]"
    >
      {hasVideo ? (
        <video
          ref={targetRef}
          autoPlay
          playsInline
          muted={self}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#7209b7] to-[#1a0b2e]">
          <span className="font-head uppercase text-white text-2xl tracking-wider">{initials}</span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent">
        <span className="font-mono text-[9px] tracking-widest uppercase text-white truncate">
          {self ? "You" : name}
        </span>
        <span className="flex items-center gap-1">
          {hasAudio ? (
            <Mic size={10} className="text-[#4cc9f0]" />
          ) : (
            <MicOff size={10} className="text-[#f72585]" />
          )}
        </span>
      </div>
    </div>
  );
}

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
  const peersRef = useRef({}); // user_id -> RTCPeerConnection (screen-share channel)
  const stageRef = useRef(null);
  const idleTimerRef = useRef(null);

  // Voice/Video chat (mesh) — separate peer connections on "voice" channel
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [remoteMedia, setRemoteMedia] = useState({}); // peer_id -> { stream, hasVideo, hasAudio, name }
  const localMediaRef = useRef(null); // our MediaStream for mic+cam
  const voicePeersRef = useRef({}); // user_id -> RTCPeerConnection (voice/video channel)
  const iceServersRef = useRef(ICE_SERVERS);
  const localVideoRef = useRef(null);

  const wsRef = useRef(null);
  const chatEndRef = useRef(null);

  const isHost = room && room.host_id === user.id;
  const isCoHost = room && (room.co_hosts || []).includes(user.id);
  const canControl = isHost || isCoHost;

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
      try {
        const { data } = await api.get("/rtc/ice");
        if (data?.iceServers?.length) iceServersRef.current = data.iceServers;
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
          // If we're already in voice/video chat, dial the new joiner
          if ((micOn || camOn) && !voicePeersRef.current[msg.joined.id]) {
            callVoicePeer(msg.joined.id, msg.joined.name).catch(() => {});
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
    if (!canControl) return toast.error("Only the host or a co-host can control playback");
    const next = !playing;
    setPlaying(next);
    setLastSyncAt(Date.now());
    sendSync(next ? "play" : "pause", next, position);
  };

  const seek = (delta) => {
    if (!canControl) return toast.error("Only the host or a co-host can seek");
    const next = Math.max(0, position + delta);
    setPosition(next);
    setLastSyncAt(Date.now());
    sendSync("seek", playing, next);
  };

  const resetTimer = () => {
    if (!canControl) return;
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
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
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
    // Dispatch by channel: "voice" routes to voice mesh, else screen-share
    if (msg.channel === "voice") {
      return handleVoiceSignal(msg);
    }
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

  // =======================
  // Voice/Video chat (mesh)
  // =======================
  const getOrCreateVoicePeer = (peerId, peerName) => {
    if (voicePeersRef.current[peerId]) return voicePeersRef.current[peerId];
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        wsRef.current?.send(JSON.stringify({
          type: "webrtc-signal",
          channel: "voice",
          to: peerId,
          kind: "ice",
          signal: ev.candidate,
        }));
      }
    };
    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      setRemoteMedia((m) => ({
        ...m,
        [peerId]: {
          stream,
          name: peerName || m[peerId]?.name || "Guest",
          hasAudio: stream.getAudioTracks().some((t) => t.enabled),
          hasVideo: stream.getVideoTracks().some((t) => t.enabled),
        },
      }));
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        try { pc.close(); } catch {}
        delete voicePeersRef.current[peerId];
        setRemoteMedia((m) => {
          const n = { ...m };
          delete n[peerId];
          return n;
        });
      }
    };
    voicePeersRef.current[peerId] = pc;
    // Add our local tracks (if already streaming)
    const local = localMediaRef.current;
    if (local) {
      local.getTracks().forEach((t) => pc.addTrack(t, local));
    }
    return pc;
  };

  const callVoicePeer = async (peerId, peerName) => {
    const pc = getOrCreateVoicePeer(peerId, peerName);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    wsRef.current?.send(JSON.stringify({
      type: "webrtc-signal",
      channel: "voice",
      to: peerId,
      kind: "offer",
      signal: offer,
    }));
  };

  const handleVoiceSignal = async (msg) => {
    const from = msg.from;
    const pc = getOrCreateVoicePeer(from, msg.from_name);
    if (msg.kind === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsRef.current?.send(JSON.stringify({
        type: "webrtc-signal",
        channel: "voice",
        to: from,
        kind: "answer",
        signal: answer,
      }));
    } else if (msg.kind === "answer") {
      try { await pc.setRemoteDescription(new RTCSessionDescription(msg.signal)); } catch {}
    } else if (msg.kind === "ice") {
      try { await pc.addIceCandidate(new RTCIceCandidate(msg.signal)); } catch {}
    }
  };

  const ensureLocalMedia = async (wantVideo) => {
    const want = { audio: true, video: wantVideo ? { width: 640, height: 360 } : false };
    let stream = localMediaRef.current;
    const needReplace = !stream || (wantVideo && stream.getVideoTracks().length === 0);
    if (needReplace) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(want);
      } catch (e) {
        toast.error(e.message || "Microphone/camera access denied");
        return null;
      }
      // stop old if upgrading
      if (localMediaRef.current) {
        localMediaRef.current.getTracks().forEach((t) => t.stop());
      }
      localMediaRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      // replace / add tracks on every existing voice peer
      Object.values(voicePeersRef.current).forEach((pc) => {
        const senders = pc.getSenders();
        stream.getTracks().forEach((t) => {
          const s = senders.find((s) => s.track && s.track.kind === t.kind);
          if (s) s.replaceTrack(t);
          else pc.addTrack(t, stream);
        });
      });
    }
    return stream;
  };

  const toggleMic = async () => {
    if (!micOn) {
      const stream = await ensureLocalMedia(camOn);
      if (!stream) return;
      stream.getAudioTracks().forEach((t) => { t.enabled = true; });
      setMicOn(true);
      // Call every other presence user on the voice channel
      (presence || []).forEach((p) => {
        if (p.id !== user.id && !voicePeersRef.current[p.id]) {
          callVoicePeer(p.id, p.name).catch(() => {});
        }
      });
    } else {
      const stream = localMediaRef.current;
      stream?.getAudioTracks().forEach((t) => { t.enabled = false; });
      setMicOn(false);
    }
  };

  const toggleCam = async () => {
    if (!camOn) {
      const stream = await ensureLocalMedia(true);
      if (!stream) return;
      stream.getVideoTracks().forEach((t) => { t.enabled = true; });
      setCamOn(true);
      (presence || []).forEach((p) => {
        if (p.id !== user.id && !voicePeersRef.current[p.id]) {
          callVoicePeer(p.id, p.name).catch(() => {});
        }
      });
    } else {
      const stream = localMediaRef.current;
      stream?.getVideoTracks().forEach((t) => { t.enabled = false; });
      setCamOn(false);
    }
  };

  // Clean up voice peers + local stream on unmount / leave
  useEffect(() => {
    return () => {
      Object.values(voicePeersRef.current).forEach((pc) => { try { pc.close(); } catch {} });
      voicePeersRef.current = {};
      if (localMediaRef.current) {
        localMediaRef.current.getTracks().forEach((t) => t.stop());
        localMediaRef.current = null;
      }
    };
  }, []);

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
        <div className="p-10 font-mono text-xs tracking-[0.3em] uppercase text-[#6b5b84]" data-testid="room-loading">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <main className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-3">
            <PlatformLogo platform={room.platform} size={52} rounded="md" showRing />
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7209b7] mb-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#f72585] pulse-live" /> Live · {PLATFORM_LABEL[room.platform]}
              </div>
              <h1 className="font-head text-2xl sm:text-3xl uppercase leading-none" data-testid="watch-room-name">{room.name}</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[#6b5b84] px-3 py-2 border border-[#7209b7]/30 bg-white">
              Room: <span className="text-[#7209b7]">{roomId}</span>
            </div>
            <button
              onClick={leave}
              data-testid="watch-leave-button"
              className="border border-[#7209b7]/45 font-mono text-xs tracking-widest uppercase px-4 py-2 hover:border-[#f72585] hover:text-[#f72585]"
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
                : "bg-[#fdf4ff] border-[#7209b7]/30 lg:col-span-3 h-[55vh] sm:h-[62vh] lg:h-[78vh]")
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
                  className="absolute top-3 right-3 bg-[#ffffff]/95 border border-[#7209b7] text-[#1a0b2e] px-3 py-1.5 font-mono text-[10px] tracking-[0.25em] uppercase hover:bg-[#7209b7]/20 z-10"
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
                    : "bg-[#ffffff]/95 border-[#7209b7] text-[#1a0b2e] hover:bg-[#7209b7]/20") +
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
                  {room.platform !== "custom" && (
                    <div className="flex justify-center mb-4">
                      <PlatformLogo platform={room.platform} size={110} rounded="xl" showRing />
                    </div>
                  )}
                  <div className="font-head text-3xl sm:text-5xl uppercase text-[#7209b7] mb-3">Intermission</div>
                  <p className="text-[#6b5b84] max-w-md mx-auto mb-6">
                    Open <span className="font-mono text-[#7209b7]">{PLATFORM_LABEL[room.platform]}</span> in a new tab and hit play — your room syncs the timer.
                    {isHost && " Or start screen-share to broadcast your window."}
                  </p>
                  <div className="flex justify-center gap-3 flex-wrap">
                    {room.platform !== "custom" && (
                      <button
                        type="button"
                        onClick={() => {
                          const w = window.screen.availWidth;
                          const h = window.screen.availHeight;
                          const popW = Math.min(1280, Math.round(w * 0.7));
                          const popH = Math.min(800, Math.round(h * 0.85));
                          window.open(
                            PLATFORM_URL[room.platform],
                            "cinemasync-ott",
                            `popup=yes,width=${popW},height=${popH},left=${w - popW - 20},top=40,scrollbars=yes,resizable=yes`
                          );
                        }}
                        data-testid="watch-open-platform-link"
                        className="inline-flex items-center gap-2 border border-[#7209b7]/45 font-mono text-xs tracking-widest uppercase px-4 py-3 hover:border-[#7209b7] hover:text-[#7209b7]"
                      >
                        <ExternalLink size={13} /> Open {PLATFORM_LABEL[room.platform]} popup
                      </button>
                    )}
                  </div>
                </div>
              )}
              {remoteSharerId && !sharing && (
                <div className="absolute top-3 left-3 px-3 py-1.5 bg-[#ffffff]/80 border border-[#7209b7]/40 text-[#7209b7] font-mono text-[10px] tracking-[0.25em] uppercase">
                  Sharing · {remoteSharerName}
                </div>
              )}
            </div>

            {/* Sync control bar */}
            <div className={
              "absolute bottom-6 left-1/2 -translate-x-1/2 backdrop-blur-xl border px-4 py-3 flex gap-4 items-center rounded-sm shadow-2xl transition-opacity duration-300 " +
              (fullscreen
                ? "bg-black/70 border-white/20 text-white"
                : "bg-[#ffffff]/85 border-[#7209b7]/30") +
              (fullscreen && !controlsVisible ? " opacity-0 pointer-events-none" : " opacity-100")
            }
                 data-testid="sync-control-bar">
              <button
                onClick={() => seek(-10)}
                disabled={!canControl}
                data-testid="sync-back-10"
                className="text-[#1a0b2e] hover:text-[#7209b7] disabled:opacity-40 disabled:hover:text-[#1a0b2e]"
                title="-10s"
              >
                <SkipBack size={20} />
              </button>
              <button
                onClick={onPlayPause}
                disabled={!canControl}
                data-testid="sync-play-pause"
                className="w-10 h-10 sm:w-11 sm:h-11 bg-[#7209b7] text-[#1a0b2e] flex items-center justify-center hover:bg-[#4a0580] disabled:opacity-40 disabled:hover:bg-[#7209b7]"
                title={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button
                onClick={() => seek(10)}
                disabled={!canControl}
                data-testid="sync-fwd-10"
                className="text-[#1a0b2e] hover:text-[#7209b7] disabled:opacity-40 disabled:hover:text-[#1a0b2e]"
                title="+10s"
              >
                <SkipForward size={20} />
              </button>
              <div className="w-px h-8 bg-[#7209b7]/15" />
              <div className="font-mono text-xs tracking-widest text-[#1a0b2e]" data-testid="sync-timer">
                {fmtTime(position)}
              </div>
              {isHost && (
                <>
                  <div className="w-px h-8 bg-[#7209b7]/15" />
                  <button
                    onClick={resetTimer}
                    data-testid="sync-reset"
                    className="text-[#6b5b84] hover:text-[#7209b7]"
                    title="Reset timer"
                  >
                    <RotateCcw size={16} />
                  </button>
                </>
              )}
              <div className="w-px h-8 bg-[#7209b7]/15" />
              {isHost ? (
                !sharing ? (
                  <button
                    onClick={startShare}
                    data-testid="screenshare-start-button"
                    className="text-[#1a0b2e] hover:text-[#7209b7] flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase"
                  >
                    <Cast size={16} /> Share
                  </button>
                ) : (
                  <button
                    onClick={stopShare}
                    data-testid="screenshare-stop-button"
                    className="text-[#f72585] hover:text-[#f72585] flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase"
                  >
                    <MonitorOff size={16} /> Stop
                  </button>
                )
              ) : (
                <span className={"font-mono text-[10px] tracking-widest uppercase " + (fullscreen ? "text-white/60" : "text-[#6b5b84]")}>Guest</span>
              )}
              <div className="w-px h-8 bg-[#7209b7]/15" />
              <button
                onClick={toggleMic}
                data-testid="voice-mic-toggle"
                title={micOn ? "Mute microphone" : "Unmute microphone"}
                className={
                  "flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors " +
                  (micOn
                    ? (fullscreen ? "text-[#4cc9f0]" : "text-[#7209b7]")
                    : (fullscreen ? "text-white/60 hover:text-white" : "text-[#6b5b84] hover:text-[#1a0b2e]"))
                }
              >
                {micOn ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
              <button
                onClick={toggleCam}
                data-testid="voice-cam-toggle"
                title={camOn ? "Turn camera off" : "Turn camera on"}
                className={
                  "flex items-center gap-1.5 font-mono text-[10px] tracking-widest uppercase transition-colors " +
                  (camOn
                    ? (fullscreen ? "text-[#4cc9f0]" : "text-[#7209b7]")
                    : (fullscreen ? "text-white/60 hover:text-white" : "text-[#6b5b84] hover:text-[#1a0b2e]"))
                }
              >
                {camOn ? <Video size={16} /> : <VideoOff size={16} />}
              </button>
            </div>

            {/* Floating voice/video tile grid (top-right) */}
            {(micOn || camOn || Object.keys(remoteMedia).length > 0) && (
              <div
                data-testid="voice-tile-grid"
                className={
                  "absolute right-3 top-16 z-20 flex flex-col gap-2 max-h-[calc(100%-10rem)] overflow-y-auto transition-opacity duration-300 " +
                  (fullscreen && !controlsVisible ? "opacity-0 pointer-events-none" : "opacity-100")
                }
              >
                {/* Self */}
                {(micOn || camOn) && (
                  <VoiceTile
                    self
                    name="You"
                    stream={localMediaRef.current}
                    videoRef={localVideoRef}
                    hasVideo={camOn}
                    hasAudio={micOn}
                  />
                )}
                {/* Remote peers */}
                {Object.entries(remoteMedia).map(([pid, m]) => (
                  <VoiceTile
                    key={pid}
                    name={m.name}
                    stream={m.stream}
                    hasVideo={m.stream?.getVideoTracks().some((t) => t.enabled && t.readyState === "live")}
                    hasAudio={m.stream?.getAudioTracks().some((t) => t.enabled && t.readyState === "live")}
                  />
                ))}
              </div>
            )}

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
                    <div key={m.id} className={"border-l-2 pl-2 py-0.5 " + (m.sender_id === room.host_id ? "border-[#7209b7]" : "border-[#4cc9f0]")}>
                      <div className="flex items-baseline gap-2">
                        <span className={"font-mono text-[10px] tracking-widest uppercase " + (m.sender_id === room.host_id ? "text-[#7209b7]" : "text-[#4cc9f0]")}>
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
                  <button type="submit" className="bg-[#7209b7] text-[#1a0b2e] px-2 py-1.5 hover:bg-[#4a0580]">
                    <Send size={14} />
                  </button>
                </form>
              </div>
            )}
          </section>

          {/* Chat & participants — hidden entirely in native fullscreen */}
          <aside className={
            (fullscreen ? "hidden" : "flex") +
            " border border-[#7209b7]/30 bg-white flex-col h-[55vh] sm:h-[62vh] lg:h-[78vh]"
          }>
            {/* Participants strip */}
            <div className="border-b border-[#7209b7]/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-[#7209b7]" />
                <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7209b7]">
                  In the theatre · {presence.length}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto" data-testid="watch-participants">
                {presence.map((p) => {
                  const m = memberMap[p.id];
                  return (
                    <div key={p.id} className="flex flex-col items-center gap-1 shrink-0" title={p.name}>
                      <div className={`w-10 h-10 border ${room.host_id === p.id ? "border-[#7209b7]" : "border-[#7209b7]/30"} bg-[#fdf4ff] flex items-center justify-center font-head text-sm`}>
                        {m?.profile_image ? (
                          <img src={m.profile_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          p.name?.[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="font-mono text-[9px] tracking-widest uppercase text-[#6b5b84] max-w-[64px] truncate">
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
                  className={`border-l-2 pl-3 py-1 ${m.sender_id === room.host_id ? "border-[#7209b7]" : "border-[#4cc9f0]"}`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className={`font-mono text-[10px] tracking-widest uppercase ${m.sender_id === room.host_id ? "text-[#7209b7]" : "text-[#4cc9f0]"}`}>
                      {m.sender_name}
                    </span>
                    <span className="font-mono text-[9px] text-[#a597c4]">
                      {new Date(m.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-[#1a0b2e] text-sm break-words">{m.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Composer */}
            <form onSubmit={sendMessage} className="border-t border-[#7209b7]/30 p-3">
              <div className="relative">
                {showEmoji && (
                  <div className="absolute bottom-12 left-0 right-0 bg-[#fdf4ff] border border-[#7209b7]/30 p-2 grid grid-cols-9 gap-1 z-10">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setMsgText((t) => t + e)}
                        className="text-lg hover:bg-[#7209b7]/10 rounded"
                      >{e}</button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmoji((s) => !s)}
                    data-testid="chat-emoji-toggle"
                    className="text-[#6b5b84] hover:text-[#7209b7] p-2"
                  >
                    <Smile size={18} />
                  </button>
                  <input
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder="Send a message…"
                    data-testid="chat-input"
                    className="flex-1 bg-[#fdf4ff] border border-[#7209b7]/30 focus:border-[#7209b7] px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    data-testid="chat-send-button"
                    className="bg-[#7209b7] text-[#1a0b2e] px-3 py-2 hover:bg-[#4a0580]"
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
