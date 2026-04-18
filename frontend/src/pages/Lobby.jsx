import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Clapperboard, Copy, Check, Users, Send, Link2, UserPlus } from "lucide-react";
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
    <div className="border border-[#7209b7]/30 bg-white p-6" data-testid="invite-panel">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus size={16} className="text-[#7209b7]" />
        <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#7209b7]">Invite friends</span>
      </div>
      <h3 className="font-head text-2xl uppercase mb-4">Call the crew</h3>

      <div className="space-y-3">
        <div>
          <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] block mb-2">Room password (confirm)</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="retype your room password"
            data-testid="invite-password-input"
            className="w-full bg-[#fdf4ff] border border-[#7209b7]/30 focus:border-[#7209b7] px-3 py-2 font-body text-sm text-[#1a0b2e]"
          />
        </div>

        {friends.length > 0 ? (
          <div>
            <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] block mb-2">Pick a friend</label>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {friends.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setPickFriend(f.id)}
                  data-testid={`invite-friend-${f.id}`}
                  className={`w-full flex items-center gap-2 px-2 py-2 border text-left text-sm ${
                    pickFriend === f.id
                      ? "border-[#7209b7] bg-[#7209b7]/10"
                      : "border-[#7209b7]/20 hover:border-[#7209b7]/50"
                  }`}
                >
                  <div className="w-7 h-7 bg-[#f0e6ff] border border-[#7209b7]/30 flex items-center justify-center font-head text-xs">
                    {f.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#1a0b2e] truncate">{f.name}</div>
                    <div className="font-mono text-[10px] text-[#6b5b84] truncate">{f.unique_id}</div>
                  </div>
                  {pickFriend === f.id && <Check size={14} className="text-[#7209b7]" />}
                </button>
              ))}
            </div>
            <button
              onClick={sendInvite}
              disabled={sending || !pickFriend || !password}
              data-testid="invite-send-button"
              className="mt-3 w-full bg-[#7209b7] text-[#1a0b2e] font-mono tracking-[0.2em] uppercase text-xs px-4 py-3 hover:bg-[#4a0580] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send size={13} /> {sending ? "Sending…" : "Send invite"}
            </button>
          </div>
        ) : (
          <div className="text-xs text-[#6b5b84] font-mono tracking-widest uppercase">
            Add friends first to invite them directly.
          </div>
        )}

        <div className="pt-3 border-t border-[#7209b7]/20">
          <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] block mb-2">Or share outside</label>
          <div className="flex gap-2 items-stretch">
            <div className="flex-1 font-mono text-xs px-3 py-2 bg-[#fdf4ff] border border-[#7209b7]/30 truncate text-[#1a0b2e]" data-testid="invite-link-display">
              {inviteUrl}
            </div>
            <button
              onClick={() => copy(inviteUrl, "link")}
              disabled={!password}
              data-testid="invite-copy-link-button"
              className="border border-[#7209b7]/40 px-3 py-2 font-mono text-xs tracking-widest uppercase hover:border-[#7209b7] hover:bg-[#7209b7]/10 disabled:opacity-50 flex items-center gap-2"
            >
              {copied === "link" ? <Check size={13} /> : <Link2 size={13} />}
              Link
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => copy(roomId, "id")}
              data-testid="invite-copy-id-button"
              className="flex-1 border border-[#7209b7]/40 px-3 py-2 font-mono text-xs tracking-widest uppercase hover:border-[#7209b7] hover:bg-[#7209b7]/10 flex items-center justify-center gap-2"
            >
              {copied === "id" ? <Check size={13} /> : <Copy size={13} />}
              Copy room ID
            </button>
            <button
              onClick={() => copy(password, "pwd")}
              disabled={!password}
              data-testid="invite-copy-password-button"
              className="flex-1 border border-[#7209b7]/40 px-3 py-2 font-mono text-xs tracking-widest uppercase hover:border-[#7209b7] hover:bg-[#7209b7]/10 disabled:opacity-50 flex items-center justify-center gap-2"
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

  if (!room) {
    return (
      <div>
        <Navbar />
        <div className="p-10 font-mono text-xs tracking-[0.3em] uppercase text-[#6b5b84]" data-testid="lobby-loading">
          Loading room…
        </div>
      </div>
    );
  }

  const isHost = room.host_id === user.id;

  return (
    <div>
      <Navbar />
      <main className="max-w-[1200px] mx-auto px-6 md:px-10 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#7209b7] mb-3">Lobby</div>
            <h1 className="font-head text-4xl sm:text-5xl uppercase" data-testid="lobby-room-name">{room.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyId}
              data-testid="lobby-copy-room-id"
              className="inline-flex items-center gap-2 px-3 py-2 bg-[#7209b7]/10 border border-dashed border-[#7209b7]/50 text-[#7209b7] font-mono text-xs tracking-widest hover:bg-[#7209b7]/20"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} Room ID: {roomId}
            </button>
            <button
              onClick={leave}
              data-testid="lobby-leave-button"
              className="border border-[#7209b7]/40 font-mono text-xs tracking-widest uppercase px-4 py-2 hover:border-[#f72585] hover:text-[#f72585]"
            >
              Leave
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-[#7209b7]/30 bg-white p-8 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Clapperboard size={16} className="text-[#7209b7]" />
                <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#7209b7]">Platform</span>
              </div>
              <div className="flex items-center gap-5 mb-6">
                <PlatformLogo platform={room.platform} size={96} rounded="lg" showRing />
                <div className="min-w-0">
                  <h2 className="font-head text-3xl uppercase leading-none">{PLATFORM_LABEL[room.platform] || "Custom"}</h2>
                  <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] mt-2">Streaming partner</div>
                </div>
              </div>
              <p className="text-[#6b5b84] mb-6">
                Each viewer must log into their own {PLATFORM_LABEL[room.platform] || "streaming"} account in a
                separate browser tab, or use host screen-share inside the room.
              </p>
              <div className="mt-auto flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/room/${roomId}`)}
                  data-testid="lobby-enter-room-button"
                  className="bg-[#7209b7] text-[#1a0b2e] font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#4a0580]"
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
                    className="border border-[#7209b7]/40 font-mono tracking-[0.25em] uppercase text-xs px-6 py-4 hover:border-[#7209b7] hover:text-[#7209b7]"
                  >
                    Open {PLATFORM_LABEL[room.platform]} popup ↗
                  </button>
                )}
              </div>
            </div>

            <InvitePanel roomId={roomId} isHost={isHost} />
          </div>

          <aside className="border border-[#7209b7]/30 bg-white p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={14} className="text-[#7209b7]" />
              <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#7209b7]">Cast · {members.length}</span>
            </div>
            <ul className="space-y-3" data-testid="lobby-participants">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#fdf4ff] border border-[#7209b7]/30 flex items-center justify-center font-head text-sm">
                    {m.profile_image ? (
                      <img src={m.profile_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      m.name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-body text-sm truncate">{m.name}{m.id === room.host_id && <span className="ml-2 text-[#7209b7] font-mono text-[10px] tracking-widest uppercase">Host</span>}</div>
                    <div className="font-mono text-[10px] text-[#6b5b84] truncate">{m.unique_id}</div>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
