import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Clapperboard, Copy, Check, Users, Send, Link2, UserPlus, Sparkles, Download, Share2, QrCode } from "lucide-react";
import PlatformLogo from "../components/PlatformLogo";
import QRCodeCard from "../components/QRCodeCard";

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

function PosterCard({ roomId, room }) {
  const { formatApiError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [poster, setPoster] = useState(null); // { url, download_name }
  const [blobUrl, setBlobUrl] = useState("");

  const fetchAsBlob = async (url) => {
    const res = await api.get(url.replace(/^\/api/, ""), { responseType: "blob" });
    return new Blob([res.data], { type: res.headers["content-type"] || "image/png" });
  };

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post(`/rooms/${roomId}/poster`);
      setPoster(data);
      const blob = await fetchAsBlob(data.url);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      setBlobUrl(URL.createObjectURL(blob));
      toast.success("Poster ready");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!blobUrl || !poster) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = poster.download_name || `cinemasync-${roomId}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const share = async () => {
    if (!poster || !blobUrl) return;
    try {
      const blob = await fetchAsBlob(poster.url);
      const file = new File([blob], poster.download_name || `cinemasync-${roomId}.png`, { type: blob.type });
      const shareData = {
        title: `Join my CinemaSync party · ${room?.name || roomId}`,
        text: `Come watch with me! Room ID: ${roomId}`,
      };
      if (navigator.canShare && navigator.canShare({ ...shareData, files: [file] })) {
        await navigator.share({ ...shareData, files: [file] });
      } else if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${window.location.origin}/invite/${roomId}`);
        toast.success("Invite copied to clipboard");
      }
    } catch (e) {
      if (e?.name !== "AbortError") toast.error(e.message || "Share failed");
    }
  };

  return (
    <div className="border border-[#6a14ff]/30 bg-white p-6" data-testid="poster-card">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-[#ffd100]" />
        <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#ffd100]">Share Party</span>
      </div>
      <h3 className="font-head text-2xl uppercase mb-2">Make a poster</h3>
      <p className="text-[#cccccc] text-sm mb-4">
        Generate a one-of-a-kind poster for this room and share it on WhatsApp or Instagram Stories.
      </p>

      {blobUrl ? (
        <div className="space-y-3">
          <div className="relative aspect-square max-w-[360px] mx-auto overflow-hidden rounded-md border border-[#6a14ff]/30 bg-[#2a2a2a]">
            <img
              src={blobUrl}
              alt="Watch-party poster"
              data-testid="poster-preview"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={share}
              data-testid="poster-share-button"
              className="flex-1 min-w-[140px] bg-[#ffd100] text-black font-mono tracking-[0.2em] uppercase text-xs px-4 py-3 rounded-md hover:shadow-[0_8px_20px_rgba(255,209,0,0.35)] flex items-center justify-center gap-2"
            >
              <Share2 size={13} /> Share
            </button>
            <button
              onClick={download}
              data-testid="poster-download-button"
              className="flex-1 min-w-[140px] border-2 border-[#6a14ff] text-[#6a14ff] font-mono tracking-[0.2em] uppercase text-xs px-4 py-3 rounded-md hover:bg-[#6a14ff] hover:text-white flex items-center justify-center gap-2"
            >
              <Download size={13} /> Download
            </button>
            <button
              onClick={generate}
              disabled={loading}
              data-testid="poster-regenerate-button"
              className="flex-1 min-w-[140px] border border-[#6a14ff]/40 text-[#cccccc] font-mono tracking-[0.2em] uppercase text-xs px-4 py-3 rounded-md hover:border-[#6a14ff] hover:text-[#6a14ff] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Sparkles size={13} /> {loading ? "…" : "Regenerate"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={generate}
          disabled={loading}
          data-testid="poster-generate-button"
          className="w-full bg-[#ffd100] text-black font-mono tracking-[0.25em] uppercase text-xs px-4 py-4 rounded-md hover:shadow-[0_10px_26px_rgba(255,209,0,0.35)] disabled:opacity-70 flex items-center justify-center gap-2"
        >
          <Sparkles size={14} />
          {loading ? "Rolling the poster…" : "Generate AI poster"}
        </button>
      )}
    </div>
  );
}

function QRCard({ roomId, room }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  return (
    <div className="border border-[#6a14ff]/30 bg-white p-6" data-testid="qr-panel">
      <div className="flex items-center gap-2 mb-3">
        <QrCode size={16} className="text-[#6a14ff]" />
        <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#6a14ff]">Scan to join</span>
      </div>
      <h3 className="font-head text-2xl uppercase mb-2">Room QR</h3>
      <p className="text-[#cccccc] text-sm mb-4">
        Re-type the room password to regenerate a scannable QR for friends.
      </p>
      {show ? (
        <div className="space-y-3">
          <QRCodeCard roomId={roomId} password={pw} roomName={room.name} size={200} testid="lobby-qr" />
          <button
            onClick={() => { setShow(false); setPw(""); }}
            data-testid="lobby-qr-hide"
            className="w-full border border-[#6a14ff]/40 text-[#6a14ff] font-mono text-xs tracking-widest uppercase px-4 py-2 rounded-md hover:bg-[#6a14ff]/10"
          >
            Hide QR
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (pw.trim()) setShow(true); }} className="space-y-3">
          <input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Room password"
            data-testid="lobby-qr-password-input"
            className="w-full bg-[#2a2a2a] border border-[#6a14ff]/30 focus:border-[#ffd100] px-3 py-2 rounded-md text-sm"
          />
          <button
            type="submit"
            disabled={!pw.trim()}
            data-testid="lobby-qr-generate"
            className="w-full bg-[#6a14ff] text-white font-mono tracking-[0.25em] uppercase text-xs px-4 py-3 rounded-md hover:bg-[#5a0fd6] disabled:opacity-60"
          >
            Generate QR
          </button>
        </form>
      )}
    </div>
  );
}

function InvitePanel({ roomId, isHost }) {
  const { formatApiError } = useAuth();
  const [friends, setFriends] = useState([]);
  const [pickFriend, setPickFriend] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState("");
  const inviteUrl = `${window.location.origin}/invite/${roomId}${password ? `?p=${encodeURIComponent(password)}` : ""}`;

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/friends");
        setFriends(data.friends || []);
      } catch {}
    })();
  }, []);

  const copy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  };

  const sendInvite = async () => {
    if (!pickFriend) return toast.error("Pick a friend first");
    if (!password) return toast.error("Enter the room password to confirm");
    setSending(true);
    try {
      await api.post(`/rooms/${roomId}/invite`, { friend_id: pickFriend, password });
      toast.success("Invite sent");
      setPickFriend("");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border border-[#6a14ff]/30 bg-white p-6" data-testid="invite-panel">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus size={16} className="text-[#6a14ff]" />
        <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#6a14ff]">Invite friends</span>
      </div>
      <h3 className="font-head text-2xl uppercase mb-4">Call the crew</h3>

      <div className="space-y-3">
        <div>
          <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc] block mb-2">Room password (confirm)</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="retype your room password"
            data-testid="invite-password-input"
            className="w-full bg-[#2a2a2a] border border-[#6a14ff]/30 focus:border-[#ffd100] px-3 py-2 font-body text-sm text-[#ffffff]"
          />
        </div>

        {friends.length > 0 ? (
          <div>
            <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc] block mb-2">Pick a friend</label>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {friends.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPickFriend(f.id)}
                  data-testid={`invite-friend-${f.id}`}
                  className={`w-full flex items-center gap-2 px-2 py-2 border text-left text-sm ${
                    pickFriend === f.id
                      ? "border-[#6a14ff] bg-[#6a14ff]/10"
                      : "border-[#6a14ff]/20 hover:border-[#6a14ff]/50"
                  }`}
                >
                  <div className="w-7 h-7 bg-[#f0e6ff] border border-[#6a14ff]/30 flex items-center justify-center font-head text-xs">
                    {f.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#ffffff] truncate">{f.name}</div>
                    <div className="font-mono text-[10px] text-[#cccccc] truncate">{f.unique_id}</div>
                  </div>
                  {pickFriend === f.id && <Check size={14} className="text-[#6a14ff]" />}
                </button>
              ))}
            </div>
            <button
              onClick={sendInvite}
              disabled={sending || !pickFriend || !password}
              data-testid="invite-send-button"
              className="mt-3 w-full bg-[#6a14ff] text-[#ffffff] font-mono tracking-[0.2em] uppercase text-xs px-4 py-3 hover:bg-[#5a0fd6] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={13} /> {sending ? "Sending…" : "Send invite"}
            </button>
          </div>
        ) : (
          <div className="text-xs text-[#cccccc] font-mono tracking-widest uppercase">
            Add friends first to invite them directly.
          </div>
        )}

        <div className="pt-3 border-t border-[#6a14ff]/20">
          <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc] block mb-2">Or share outside</label>
          <div className="flex gap-2 items-stretch">
            <div className="flex-1 font-mono text-xs px-3 py-2 bg-[#2a2a2a] border border-[#6a14ff]/30 truncate text-[#ffffff]" data-testid="invite-link-display">
              {inviteUrl}
            </div>
            <button
              onClick={() => copy(inviteUrl, "link")}
              disabled={!password}
              data-testid="invite-copy-link-button"
              className="border border-[#6a14ff]/40 px-3 py-2 font-mono text-xs tracking-widest uppercase hover:border-[#6a14ff] hover:bg-[#6a14ff]/10 disabled:opacity-50 flex items-center gap-2"
            >
              {copied === "link" ? <Check size={13} /> : <Link2 size={13} />}
              Link
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => copy(roomId, "id")}
              data-testid="invite-copy-id-button"
              className="flex-1 border border-[#6a14ff]/40 px-3 py-2 font-mono text-xs tracking-widest uppercase hover:border-[#6a14ff] hover:bg-[#6a14ff]/10 flex items-center justify-center gap-2"
            >
              {copied === "id" ? <Check size={13} /> : <Copy size={13} />}
              Copy room ID
            </button>
            <button
              onClick={() => copy(password, "pwd")}
              disabled={!password}
              data-testid="invite-copy-password-button"
              className="flex-1 border border-[#6a14ff]/40 px-3 py-2 font-mono text-xs tracking-widest uppercase hover:border-[#6a14ff] hover:bg-[#6a14ff]/10 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {copied === "pwd" ? <Check size={13} /> : <Copy size={13} />}
              Copy password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Lobby() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(false);
  const { user, formatApiError } = useAuth();
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await api.get(`/rooms/${roomId}`);
      setRoom(data.room);
      setMembers(data.members || []);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
      navigate("/dashboard");
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [roomId]);

  const copyId = async () => {
    await navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const leave = async () => {
    try { await api.post(`/rooms/${roomId}/leave`); } catch {}
    navigate("/dashboard");
  };

  const toggleCohost = async (targetId, promote) => {
    try {
      const path = promote ? "promote" : "demote";
      const { data } = await api.post(`/rooms/${roomId}/${path}`, { user_id: targetId });
      setRoom(data.room);
      toast.success(promote ? "Promoted to co-host" : "Demoted");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  if (!room) {
    return (
      <div>
        <Navbar />
        <div className="p-10 font-mono text-xs tracking-[0.3em] uppercase text-[#cccccc]" data-testid="lobby-loading">
          Loading room…
        </div>
      </div>
    );
  }

  const isHost = room.host_id === user.id;

  return (
    <div>
      <Navbar />
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#6a14ff] mb-3">Lobby</div>
            <h1 className="font-head text-4xl sm:text-5xl uppercase" data-testid="lobby-room-name">{room.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyId}
              data-testid="lobby-copy-room-id"
              className="inline-flex items-center gap-2 px-3 py-2 bg-[#6a14ff]/10 border border-dashed border-[#6a14ff]/50 text-[#6a14ff] font-mono text-xs tracking-widest hover:bg-[#6a14ff]/20"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} Room ID: {roomId}
            </button>
            <button
              onClick={leave}
              data-testid="lobby-leave-button"
              className="border border-[#6a14ff]/40 font-mono text-xs tracking-widest uppercase px-4 py-2 hover:border-[#ffd100] hover:text-[#ffd100]"
            >
              Leave
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-[#6a14ff]/30 bg-white p-8 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Clapperboard size={16} className="text-[#6a14ff]" />
                <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#6a14ff]">Platform</span>
              </div>
              <div className="flex items-center gap-5 mb-6">
                <PlatformLogo platform={room.platform} size={96} rounded="lg" showRing />
                <div className="min-w-0">
                  <h2 className="font-head text-3xl uppercase leading-none">{PLATFORM_LABEL[room.platform] || "Custom"}</h2>
                  <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc] mt-2">Streaming partner</div>
                </div>
              </div>
              <p className="text-[#cccccc] mb-6">
                Each viewer must log into their own {PLATFORM_LABEL[room.platform] || "streaming"} account in a
                separate browser tab, or use host screen-share inside the room.
              </p>
              <div className="mt-auto flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/room/${roomId}`)}
                  data-testid="lobby-enter-room-button"
                  className="bg-[#ffd100] text-black font-mono font-semibold tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#e8bd00]"
                >
                  {isHost ? "Open the curtain" : "Take your seat"}
                </button>
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
                    data-testid="lobby-open-platform-link"
                    className="border border-[#6a14ff]/40 font-mono tracking-[0.25em] uppercase text-xs px-6 py-4 hover:border-[#6a14ff] hover:text-[#6a14ff]"
                  >
                    Open {PLATFORM_LABEL[room.platform]} popup ↗
                  </button>
                )}
              </div>
            </div>

            <PosterCard roomId={roomId} room={room} />

            <QRCard roomId={roomId} room={room} />

            <InvitePanel roomId={roomId} isHost={isHost} />
          </div>

          <aside className="border border-[#6a14ff]/30 bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={14} className="text-[#6a14ff]" />
              <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#6a14ff]">Cast · {members.length}</span>
            </div>
            <ul className="space-y-3" data-testid="lobby-participants">
              {members.map((m) => {
                const mIsHost = m.id === room.host_id;
                const mIsCoHost = (room.co_hosts || []).includes(m.id);
                const meIsHost = room.host_id === user.id;
                return (
                  <li key={m.id} className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#2a2a2a] border border-[#6a14ff]/30 flex items-center justify-center font-head text-sm overflow-hidden shrink-0 rounded-sm">
                      {m.profile_image ? (
                        <img src={m.profile_image} alt="" className="w-full h-full object-cover" />
                      ) : (
                        m.name?.[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm truncate flex items-center gap-1.5">
                        <span className="truncate">{m.name}</span>
                        {mIsHost && <span className="text-[#6a14ff] font-mono text-[10px] tracking-widest uppercase shrink-0">Host</span>}
                        {mIsCoHost && !mIsHost && <span className="text-[#ffd100] font-mono text-[10px] tracking-widest uppercase shrink-0">Co-host</span>}
                      </div>
                      <div className="font-mono text-[10px] text-[#cccccc] truncate">{m.unique_id}</div>
                    </div>
                    {meIsHost && !mIsHost && (
                      mIsCoHost ? (
                        <button
                          onClick={() => toggleCohost(m.id, false)}
                          data-testid={`cohost-demote-${m.id}`}
                          className="text-[9px] font-mono tracking-widest uppercase border border-[#ffd100]/40 text-[#ffd100] px-2 py-1 rounded-sm hover:bg-[#ffd100]/10"
                          title="Remove co-host"
                        >
                          Demote
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleCohost(m.id, true)}
                          data-testid={`cohost-promote-${m.id}`}
                          className="text-[9px] font-mono tracking-widest uppercase border border-[#6a14ff]/40 text-[#6a14ff] px-2 py-1 rounded-sm hover:bg-[#6a14ff]/10"
                          title="Promote to co-host"
                        >
                          + Co-host
                        </button>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
