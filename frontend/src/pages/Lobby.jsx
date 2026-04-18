import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Clapperboard, Copy, Check, Users } from "lucide-react";

const PLATFORM_LABEL = {
  netflix: "Netflix", prime: "Prime Video", hotstar: "Hotstar",
  hoichoi: "Hoichoi", addatimes: "Adda Times", zee5: "ZEE5", custom: "Custom",
};

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
        <div className="p-10 font-mono text-xs tracking-[0.3em] uppercase text-[#99958E]" data-testid="lobby-loading">
          Loading room…
        </div>
      </div>
    );
  }

  const isHost = room.host_id === user.id;

  return (
    <div>
      <Navbar />
      <main className="max-w-[1100px] mx-auto px-6 md:px-10 py-10">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
          <div>
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#E5A93C] mb-3">Lobby</div>
            <h1 className="font-head text-4xl sm:text-5xl uppercase" data-testid="lobby-room-name">{room.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyId}
              data-testid="lobby-copy-room-id"
              className="inline-flex items-center gap-2 px-3 py-2 bg-[#E5A93C]/10 border border-dashed border-[#E5A93C]/50 text-[#E5A93C] font-mono text-xs tracking-widest hover:bg-[#E5A93C]/20"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} Room ID: {roomId}
            </button>
            <button
              onClick={leave}
              data-testid="lobby-leave-button"
              className="border border-white/20 font-mono text-xs tracking-widest uppercase px-4 py-2 hover:border-[#FF3B00] hover:text-[#FF3B00]"
            >
              Leave
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-white/10 bg-[#141211] p-8 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Clapperboard size={16} className="text-[#E5A93C]" />
              <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#E5A93C]">Platform</span>
            </div>
            <h2 className="font-head text-3xl uppercase mb-6">{PLATFORM_LABEL[room.platform] || "Custom"}</h2>
            <p className="text-[#99958E] mb-6">
              Each viewer must log into their own {PLATFORM_LABEL[room.platform] || "streaming"} account in a
              separate browser tab, or use host screen-share inside the room.
            </p>
            <div className="mt-auto flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/room/${roomId}`)}
                data-testid="lobby-enter-room-button"
                className="bg-[#E5A93C] text-[#0A0908] font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#F0B955]"
              >
                {isHost ? "Open the curtain" : "Take your seat"}
              </button>
              {room.platform !== "custom" && (
                <a
                  href={getPlatformUrl(room.platform)}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="lobby-open-platform-link"
                  className="border border-white/20 font-mono tracking-[0.25em] uppercase text-xs px-6 py-4 hover:border-[#E5A93C] hover:text-[#E5A93C]"
                >
                  Open {PLATFORM_LABEL[room.platform]} ↗
                </a>
              )}
            </div>
          </div>

          <aside className="border border-white/10 bg-[#141211] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users size={14} className="text-[#E5A93C]" />
              <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#E5A93C]">Cast · {members.length}</span>
            </div>
            <ul className="space-y-3" data-testid="lobby-participants">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#0A0908] border border-white/10 flex items-center justify-center font-head text-sm">
                    {m.profile_image ? (
                      <img src={m.profile_image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      m.name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-body text-sm truncate">{m.name}{m.id === room.host_id && <span className="ml-2 text-[#E5A93C] font-mono text-[10px] tracking-widest uppercase">Host</span>}</div>
                    <div className="font-mono text-[10px] text-[#99958E] truncate">{m.unique_id}</div>
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

function getPlatformUrl(p) {
  const map = {
    netflix: "https://www.netflix.com/",
    prime: "https://www.primevideo.com/",
    hotstar: "https://www.hotstar.com/",
    hoichoi: "https://www.hoichoi.tv/",
    addatimes: "https://www.addatimes.com/",
    zee5: "https://www.zee5.com/",
  };
  return map[p] || "#";
}
