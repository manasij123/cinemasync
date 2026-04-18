import React, { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import UniqueIdBadge from "../components/UniqueIdBadge";
import { toast } from "sonner";
import {
  Plus, DoorOpen, Users, Radio, Bell, Check, X, ArrowRight, Sparkles, TicketCheck,
} from "lucide-react";

const PLATFORMS = [
  { id: "netflix", label: "Netflix" },
  { id: "prime", label: "Prime Video" },
  { id: "hotstar", label: "Hotstar" },
  { id: "hoichoi", label: "Hoichoi" },
  { id: "addatimes", label: "Adda Times" },
  { id: "zee5", label: "ZEE5" },
  { id: "custom", label: "Custom" },
];

const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.label]));

function greet() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

function CreateRoomForm({ onCreated }) {
  const [name, setName] = useState("Friday Night Reel");
  const [password, setPassword] = useState("");
  const [platform, setPlatform] = useState("custom");
  const [loading, setLoading] = useState(false);
  const { formatApiError } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/rooms", { name, password, platform });
      toast.success(`Room ${data.room.id} created`);
      onCreated(data.room);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3" data-testid="create-room-card">
      <div>
        <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55] block mb-1">Room name</label>
        <input
          value={name}
          required
          onChange={(e) => setName(e.target.value)}
          data-testid="create-room-name-input"
          className="w-full bg-[#fefae0] border border-[#d4a373]/30 focus:border-[#d4a373] px-3 py-2 font-body text-sm"
        />
      </div>
      <div>
        <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55] block mb-1">Password</label>
        <input
          type="text"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="create-room-password-input"
          className="w-full bg-[#fefae0] border border-[#d4a373]/30 focus:border-[#d4a373] px-3 py-2 font-body text-sm"
        />
      </div>
      <div>
        <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55] block mb-1">Platform</label>
        <div className="grid grid-cols-3 gap-1.5">
          {PLATFORMS.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setPlatform(p.id)}
              data-testid={`platform-pick-${p.id}`}
              className={`px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest border transition-all ${
                platform === p.id
                  ? "border-[#d4a373] text-[#d4a373] bg-[#d4a373]/10"
                  : "border-[#d4a373]/30 text-[#7a6a55] hover:border-[#d4a373]/60"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <button
        disabled={loading}
        data-testid="create-room-submit-button"
        className="w-full bg-[#d4a373] text-[#2b2118] font-mono tracking-[0.25em] uppercase text-xs px-4 py-3 hover:bg-[#c08456] disabled:opacity-60"
      >
        {loading ? "Rolling film…" : "Reserve the screen"}
      </button>
    </form>
  );
}

function JoinRoomForm({ onJoined }) {
  const [roomId, setRoomId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { formatApiError } = useAuth();
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/rooms/join", { room_id: roomId.trim().toUpperCase(), password });
      toast.success(`Joined ${data.room.name}`);
      onJoined(data.room);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3" data-testid="join-room-card">
      <div>
        <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55] block mb-1">Room ID</label>
        <input
          required
          value={roomId}
          onChange={(e) => setRoomId(e.target.value.toUpperCase())}
          data-testid="join-room-id-input"
          className="w-full bg-[#fefae0] border border-[#d4a373]/30 focus:border-[#d4a373] px-3 py-2 font-mono tracking-widest uppercase text-sm"
        />
      </div>
      <div>
        <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55] block mb-1">Password</label>
        <input
          type="text"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          data-testid="join-room-password-input"
          className="w-full bg-[#fefae0] border border-[#d4a373]/30 focus:border-[#d4a373] px-3 py-2 font-body text-sm"
        />
      </div>
      <button
        disabled={loading}
        data-testid="join-room-submit-button"
        className="w-full border border-[#d4a373]/45 text-[#2b2118] font-mono tracking-[0.25em] uppercase text-xs px-4 py-3 hover:border-[#d4a373] hover:text-[#d4a373] disabled:opacity-60"
      >
        {loading ? "Tearing ticket…" : "Sneak in"}
      </button>
    </form>
  );
}

function Stat({ label, value, hint, icon: Icon, accent, testid }) {
  return (
    <div className="border border-[#d4a373]/30 bg-[#faedcd] p-5" data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55]">{label}</span>
        <Icon size={16} className={accent === "red" ? "text-[#a04a2f]" : "text-[#d4a373]"} />
      </div>
      <div className={`font-head text-4xl uppercase ${accent === "red" ? "text-[#a04a2f]" : "text-[#2b2118]"}`}>{value}</div>
      {hint && <div className="font-mono text-[10px] tracking-widest uppercase text-[#a89578] mt-2">{hint}</div>}
    </div>
  );
}

function LiveRoomCard({ room, currentUserId, onClick }) {
  const isHost = room.host_id === currentUserId;
  return (
    <button
      onClick={onClick}
      data-testid={`live-room-${room.id}`}
      className="w-full text-left relative border border-[#d4a373]/40 bg-[#faedcd] hover:bg-[#d4a373]/10 hover:border-[#d4a373] p-4 transition-all group"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 bg-[#a04a2f] pulse-live" />
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#a04a2f]">Live</span>
        {isHost && (
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#d4a373] ml-auto">You host</span>
        )}
      </div>
      <div className="font-head text-xl uppercase text-[#2b2118] mb-1 truncate">{room.name}</div>
      <div className="font-mono text-[10px] tracking-widest uppercase text-[#7a6a55] flex justify-between items-center">
        <span>Room {room.id} · {PLATFORM_LABEL[room.platform] || "Custom"}</span>
        <span className="inline-flex items-center gap-1"><Users size={11} /> {room.participants?.length || 0}</span>
      </div>
      <div className="mt-3 flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase text-[#d4a373] group-hover:translate-x-1 transition-transform">
        Rejoin <ArrowRight size={12} />
      </div>
    </button>
  );
}

function InviteRow({ n, onAccept, onDismiss }) {
  return (
    <div className="border border-[#d4a373]/30 bg-[#fefae0] p-3" data-testid={`invite-notif-${n.id}`}>
      <div className="flex items-start gap-3">
        <TicketCheck size={16} className="text-[#d4a373] mt-1 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-body text-sm text-[#2b2118]">
            <span className="text-[#d4a373]">{n.from_name}</span> invited you
          </div>
          <div className="font-head text-base uppercase truncate">{n.room_name}</div>
          <div className="font-mono text-[10px] text-[#7a6a55] mt-1">
            Room {n.room_id} · pwd: <span className="text-[#2b2118]">{n.password}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onAccept(n)}
          data-testid={`invite-accept-${n.id}`}
          className="flex-1 bg-[#d4a373] text-[#2b2118] font-mono text-[10px] tracking-widest uppercase px-3 py-2 hover:bg-[#c08456] flex items-center justify-center gap-1"
        >
          <Check size={12} /> Accept
        </button>
        <button
          onClick={() => onDismiss(n.id)}
          data-testid={`invite-dismiss-${n.id}`}
          className="border border-[#d4a373]/45 font-mono text-[10px] tracking-widest uppercase px-3 py-2 hover:border-[#a04a2f] hover:text-[#a04a2f]"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, formatApiError } = useAuth();
  const [friends, setFriends] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const navigate = useNavigate();
  const [greeting] = useState(greet());

  const loadFriends = async () => {
    try { const { data } = await api.get("/friends"); setFriends(data.friends || []); } catch {}
  };
  const loadActive = async () => {
    try { const { data } = await api.get("/rooms/active"); setActiveRooms(data.rooms || []); } catch {}
  };
  const loadNotifs = async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifs((data.notifications || []).filter((n) => n.type === "room-invite" && !n.read));
    } catch {}
  };

  useEffect(() => {
    loadFriends();
    loadActive();
    loadNotifs();
    const t = setInterval(() => { loadActive(); loadNotifs(); }, 5000);
    return () => clearInterval(t);
  }, []);

  const onEnterRoom = (room) => navigate(`/lobby/${room.id}`);

  const acceptInvite = async (n) => {
    try {
      await api.post("/rooms/join", { room_id: n.room_id, password: n.password });
      await api.post(`/notifications/${n.id}/read`);
      toast.success(`Joining ${n.room_name}`);
      navigate(`/room/${n.room_id}`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };
  const dismissInvite = async (id) => {
    try { await api.delete(`/notifications/${id}`); setNotifs((c) => c.filter((n) => n.id !== id)); } catch {}
  };

  return (
    <AppShell
      subtitle="House Lights Dim"
      title={`${greeting}, ${user.name}`}
      actions={<UniqueIdBadge value={user.unique_id} testid="dashboard-unique-id" />}
    >
      {/* Stats row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" data-testid="dashboard-stats">
        <Stat testid="stat-live" label="Live Rooms" value={activeRooms.length} hint="You can rejoin" icon={Radio} accent="red" />
        <Stat testid="stat-invites" label="Invitations" value={notifs.length} hint="Awaiting response" icon={Bell} />
        <Stat testid="stat-friends" label="Regulars" value={friends.length} hint="In your circle" icon={Users} />
        <Stat testid="stat-platforms" label="OTT Support" value="6" hint="Netflix · Prime · more" icon={Sparkles} />
      </section>

      {/* Live now cards */}
      {activeRooms.length > 0 && (
        <section className="mb-8" data-testid="dashboard-live-section">
          <div className="flex items-center gap-3 mb-4">
            <Radio size={16} className="text-[#a04a2f]" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#a04a2f]">Live now · {activeRooms.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeRooms.map((r) => (
              <LiveRoomCard key={r.id} room={r} currentUserId={user.id} onClick={() => navigate(`/room/${r.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Actions grid */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Create */}
        <div className="border border-[#d4a373]/30 bg-[#faedcd] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={16} className="text-[#d4a373]" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#d4a373]">Host</span>
          </div>
          <h2 className="font-head text-2xl uppercase mb-4">Create room</h2>
          <CreateRoomForm onCreated={onEnterRoom} />
        </div>

        {/* Join */}
        <div className="border border-[#d4a373]/30 bg-[#faedcd] p-5">
          <div className="flex items-center gap-2 mb-3">
            <DoorOpen size={16} className="text-[#d4a373]" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#d4a373]">Crash a screening</span>
          </div>
          <h2 className="font-head text-2xl uppercase mb-4">Join room</h2>
          <JoinRoomForm onJoined={onEnterRoom} />
        </div>

        {/* Invitations */}
        <div className="border border-[#d4a373]/30 bg-[#faedcd] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={14} className="text-[#d4a373]" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#d4a373]">Inbox</span>
            {notifs.length > 0 && (
              <span className="ml-auto bg-[#a04a2f] text-[#fefae0] font-mono text-[10px] px-2 py-0.5" data-testid="invite-count">{notifs.length}</span>
            )}
          </div>
          <h2 className="font-head text-2xl uppercase mb-4">Invitations</h2>
          {notifs.length === 0 ? (
            <div className="text-xs font-mono tracking-widest uppercase text-[#7a6a55]">No invitations waiting.</div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1" data-testid="invite-inbox">
              {notifs.map((n) => <InviteRow key={n.id} n={n} onAccept={acceptInvite} onDismiss={dismissInvite} />)}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}
