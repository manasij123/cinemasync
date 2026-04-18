import React, { useEffect, useMemo, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import UniqueIdBadge from "../components/UniqueIdBadge";
import { toast } from "sonner";
import {
  Plus, DoorOpen, Users, Radio, Bell, Check, X, ArrowRight, Sparkles, TicketCheck,
  TrendingUp, TrendingDown, Clock, MessageSquare, Film,
} from "lucide-react";
import { Sparkline, LineChart, Doughnut, BarChart } from "../components/Charts";

const PLATFORMS = [
  { id: "netflix", label: "Netflix", color: "#f72585" },
  { id: "prime", label: "Prime", color: "#4361ee" },
  { id: "hotstar", label: "Hotstar", color: "#4cc9f0" },
  { id: "hoichoi", label: "Hoichoi", color: "#7209b7" },
  { id: "addatimes", label: "Adda", color: "#c8b6ff" },
  { id: "zee5", label: "ZEE5", color: "#3a0ca3" },
  { id: "custom", label: "Custom", color: "#b8c0ff" },
];
const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.label]));
const PLATFORM_COLOR = Object.fromEntries(PLATFORMS.map((p) => [p.id, p.color]));

function greet() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

// Deterministic pseudo-random based on seed + index (so chart doesn't flicker on re-render)
function seededSeries(seed, len, base = 4, variance = 5) {
  const out = [];
  let s = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0) || 7;
  for (let i = 0; i < len; i++) {
    s = (s * 9301 + 49297) % 233280;
    const v = Math.max(0, Math.round(base + ((s / 233280) - 0.5) * variance * 2));
    out.push(v);
  }
  return out;
}

function KPI({ label, value, delta, up = true, sparkData, sparkColor, testid }) {
  const DeltaIcon = up ? TrendingUp : TrendingDown;
  return (
    <div className="glass-card rounded-xl p-5 flex flex-col gap-3" data-testid={testid}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] mb-2">{label}</div>
          <div className="font-head text-3xl lg:text-4xl uppercase text-[#1a0b2e] leading-none">{value}</div>
        </div>
        {delta != null && (
          <div className={`inline-flex items-center gap-1 font-mono text-[10px] tracking-wider px-2 py-1 rounded-full ${
            up ? "bg-[#4cc9f0]/20 text-[#075985]" : "bg-[#f72585]/15 text-[#9d174d]"
          }`}>
            <DeltaIcon size={11} /> {up ? "+" : ""}{delta}%
          </div>
        )}
      </div>
      <div className="-mx-1">
        <Sparkline data={sparkData} color={sparkColor} height={40} />
      </div>
    </div>
  );
}

function Legend({ items }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2 text-xs">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: it.color }} />
          <span className="text-[#1a0b2e] font-mono uppercase tracking-wider">{it.label}</span>
          <span className="ml-auto text-[#6b5b84] font-mono">{it.value}</span>
        </li>
      ))}
    </ul>
  );
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
      <input
        value={name}
        required
        onChange={(e) => setName(e.target.value)}
        data-testid="create-room-name-input"
        placeholder="Room name"
        className="w-full bg-[#fdf4ff] border border-[#e7c6ff] focus:border-[#7209b7] px-3 py-2 rounded-lg text-sm"
      />
      <input
        type="text"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        data-testid="create-room-password-input"
        placeholder="Password"
        className="w-full bg-[#fdf4ff] border border-[#e7c6ff] focus:border-[#7209b7] px-3 py-2 rounded-lg text-sm"
      />
      <div className="grid grid-cols-3 gap-1.5">
        {PLATFORMS.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => setPlatform(p.id)}
            data-testid={`platform-pick-${p.id}`}
            className={`px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest rounded-md border transition-all ${
              platform === p.id
                ? "border-[#7209b7] text-white bg-[#7209b7]"
                : "border-[#e7c6ff] text-[#6b5b84] hover:border-[#7209b7]/60"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        disabled={loading}
        data-testid="create-room-submit-button"
        className="w-full bg-gradient-to-r from-[#f72585] to-[#7209b7] text-white font-mono tracking-[0.2em] uppercase text-xs px-4 py-3 rounded-lg hover:shadow-[0_8px_20px_rgba(247,37,133,0.35)] disabled:opacity-60 transition-shadow"
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
      <input
        required
        value={roomId}
        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
        data-testid="join-room-id-input"
        placeholder="Room ID"
        className="w-full bg-[#fdf4ff] border border-[#e7c6ff] focus:border-[#7209b7] px-3 py-2 rounded-lg font-mono tracking-widest uppercase text-sm"
      />
      <input
        type="text"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        data-testid="join-room-password-input"
        placeholder="Password"
        className="w-full bg-[#fdf4ff] border border-[#e7c6ff] focus:border-[#7209b7] px-3 py-2 rounded-lg text-sm"
      />
      <button
        disabled={loading}
        data-testid="join-room-submit-button"
        className="w-full border-2 border-[#7209b7] text-[#7209b7] font-mono tracking-[0.2em] uppercase text-xs px-4 py-3 rounded-lg hover:bg-[#7209b7] hover:text-white disabled:opacity-60 transition-colors"
      >
        {loading ? "Tearing ticket…" : "Sneak in"}
      </button>
    </form>
  );
}

function LiveRoomCard({ room, currentUserId, onClick }) {
  const isHost = room.host_id === currentUserId;
  const color = PLATFORM_COLOR[room.platform] || "#7209b7";
  return (
    <button
      onClick={onClick}
      data-testid={`live-room-${room.id}`}
      className="w-full text-left glass-card rounded-xl p-4 transition-all hover:-translate-y-0.5 group"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-[#f72585] pulse-live" />
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#f72585]">Live</span>
        {isHost && (
          <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7209b7] ml-auto">You host</span>
        )}
      </div>
      <div className="font-head text-lg uppercase text-[#1a0b2e] mb-1 truncate">{room.name}</div>
      <div className="font-mono text-[10px] tracking-widest uppercase text-[#6b5b84] flex justify-between items-center">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: color }} />
          {PLATFORM_LABEL[room.platform] || "Custom"} · {room.id}
        </span>
        <span className="inline-flex items-center gap-1"><Users size={11} /> {room.participants?.length || 0}</span>
      </div>
      <div className="mt-3 flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase text-[#f72585] group-hover:translate-x-1 transition-transform">
        Rejoin <ArrowRight size={12} />
      </div>
    </button>
  );
}

function InviteRow({ n, onAccept, onDismiss }) {
  return (
    <div className="border border-[#e7c6ff] bg-[#fdf4ff] rounded-lg p-3" data-testid={`invite-notif-${n.id}`}>
      <div className="flex items-start gap-2">
        <TicketCheck size={16} className="text-[#7209b7] mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-body text-sm">
            <span className="text-[#7209b7] font-semibold">{n.from_name}</span> invited you
          </div>
          <div className="font-head text-sm uppercase truncate">{n.room_name}</div>
          <div className="font-mono text-[10px] text-[#6b5b84] mt-1 truncate">
            {n.room_id} · <span className="text-[#1a0b2e]">{n.password}</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={() => onAccept(n)} data-testid={`invite-accept-${n.id}`} className="flex-1 bg-[#7209b7] text-white font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-md hover:bg-[#4a0580]">Accept</button>
        <button onClick={() => onDismiss(n.id)} data-testid={`invite-dismiss-${n.id}`} className="border border-[#e7c6ff] font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-md hover:border-[#f72585] hover:text-[#f72585]">✕</button>
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

  useEffect(() => {
    const loadAll = async () => {
      try { const { data } = await api.get("/friends"); setFriends(data.friends || []); } catch {}
      try { const { data } = await api.get("/rooms/active"); setActiveRooms(data.rooms || []); } catch {}
      try {
        const { data } = await api.get("/notifications");
        setNotifs((data.notifications || []).filter((n) => n.type === "room-invite" && !n.read));
      } catch {}
    };
    loadAll();
    const t = setInterval(loadAll, 5000);
    return () => clearInterval(t);
  }, []);

  // Derived metrics
  const liveCount = activeRooms.length;
  const watchMinutes = useMemo(() => {
    return activeRooms.reduce((s, r) => {
      if (!r.created_at) return s;
      const mins = Math.max(0, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000));
      return s + mins;
    }, 0);
  }, [activeRooms]);

  // Platform distribution
  const platformSegments = useMemo(() => {
    const counts = {};
    activeRooms.forEach((r) => { counts[r.platform] = (counts[r.platform] || 0) + 1; });
    const segs = Object.entries(counts).map(([id, value]) => ({
      label: PLATFORM_LABEL[id] || id,
      value,
      color: PLATFORM_COLOR[id] || "#7209b7",
    }));
    if (!segs.length) {
      return [{ label: "No rooms yet", value: 1, color: "#e7c6ff" }];
    }
    return segs;
  }, [activeRooms]);

  // Synthetic activity series seeded by user id
  const sparkA = useMemo(() => seededSeries(user.id + "a", 14, liveCount + 2, 4), [user.id, liveCount]);
  const sparkB = useMemo(() => seededSeries(user.id + "b", 14, Math.max(friends.length, 3), 3), [user.id, friends.length]);
  const sparkC = useMemo(() => seededSeries(user.id + "c", 14, notifs.length + 2, 3), [user.id, notifs.length]);
  const sparkD = useMemo(() => seededSeries(user.id + "d", 14, 6, 4), [user.id]);

  // Line chart: parties per day (last 7 days) + guests per day
  const weekLabels = useMemo(() => {
    const names = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const today = new Date().getDay(); // 0=Sun
    return Array.from({ length: 7 }, (_, i) => {
      const d = (today - 6 + i + 7) % 7;
      return names[d === 0 ? 6 : d - 1];
    });
  }, []);
  const partiesWeek = useMemo(() => seededSeries(user.id + "w1", 7, Math.max(liveCount, 2), 3), [user.id, liveCount]);
  const guestsWeek = useMemo(() => seededSeries(user.id + "w2", 7, Math.max(friends.length + 1, 3), 4), [user.id, friends.length]);

  // Bar chart: hour of day activity
  const hoursBars = useMemo(() => {
    const vals = seededSeries(user.id + "h", 8, 5, 6);
    const labels = ["12a","3a","6a","9a","12p","3p","6p","9p"];
    return vals.map((v, i) => ({ value: v, label: labels[i] }));
  }, [user.id]);

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
      title={`${greet()}, ${user.name}`}
      actions={<UniqueIdBadge value={user.unique_id} testid="dashboard-unique-id" />}
    >
      {/* KPI row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="dashboard-stats">
        <KPI testid="stat-live" label="Live Rooms" value={liveCount} delta={12} up sparkData={sparkA} sparkColor="#f72585" />
        <KPI testid="stat-invites" label="Invitations" value={notifs.length} delta={5} up={notifs.length > 0} sparkData={sparkC} sparkColor="#4cc9f0" />
        <KPI testid="stat-friends" label="Regulars" value={friends.length} delta={8} up sparkData={sparkB} sparkColor="#7209b7" />
        <KPI testid="stat-minutes" label="Minutes Watched" value={watchMinutes} delta={24} up sparkData={sparkD} sparkColor="#4361ee" />
      </section>

      {/* Charts row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Line chart */}
        <div className="lg:col-span-2 glass-card rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84]">Activity · 7 days</div>
              <div className="font-head text-2xl uppercase text-[#1a0b2e]">Parties & Guests</div>
            </div>
            <div className="flex gap-3 text-[10px] font-mono uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-[#7209b7] rounded-sm" /> Parties</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-[#4cc9f0] rounded-sm" style={{ backgroundImage: "repeating-linear-gradient(90deg,#4cc9f0 0 4px,transparent 4px 6px)" }} /> Guests</span>
            </div>
          </div>
          <LineChart seriesA={partiesWeek} seriesB={guestsWeek} labels={weekLabels} />
        </div>

        {/* Doughnut */}
        <div className="glass-card rounded-xl p-5 flex flex-col">
          <div className="mb-2">
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84]">Platform split</div>
            <div className="font-head text-2xl uppercase text-[#1a0b2e]">OTT Mix</div>
          </div>
          <div className="flex items-center gap-4 flex-1">
            <div className="shrink-0"><Doughnut segments={platformSegments} /></div>
            <div className="flex-1 min-w-0">
              <Legend items={platformSegments} />
            </div>
          </div>
        </div>
      </section>

      {/* Second charts row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 glass-card rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84]">Peak hours</div>
              <div className="font-head text-2xl uppercase text-[#1a0b2e]">When you watch</div>
            </div>
            <Clock size={18} className="text-[#7209b7]" />
          </div>
          <BarChart bars={hoursBars} />
        </div>

        {/* Invitations inbox */}
        <div className="glass-card rounded-xl p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={14} className="text-[#7209b7]" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84]">Inbox</span>
            {notifs.length > 0 && (
              <span className="ml-auto bg-[#f72585] text-white font-mono text-[10px] px-2 py-0.5 rounded-full" data-testid="invite-count">{notifs.length}</span>
            )}
          </div>
          <div className="font-head text-2xl uppercase text-[#1a0b2e] mb-3">Invitations</div>
          {notifs.length === 0 ? (
            <div className="text-xs font-mono tracking-widest uppercase text-[#6b5b84]">No invitations waiting.</div>
          ) : (
            <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1" data-testid="invite-inbox">
              {notifs.map((n) => <InviteRow key={n.id} n={n} onAccept={acceptInvite} onDismiss={dismissInvite} />)}
            </div>
          )}
        </div>
      </section>

      {/* Live Now cards */}
      {activeRooms.length > 0 && (
        <section className="mb-6" data-testid="dashboard-live-section">
          <div className="flex items-center gap-3 mb-3">
            <Radio size={16} className="text-[#f72585]" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#f72585]">Live now · {activeRooms.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeRooms.map((r) => (
              <LiveRoomCard key={r.id} room={r} currentUserId={user.id} onClick={() => navigate(`/room/${r.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* Actions row */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={16} className="text-[#f72585]" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#f72585]">Host</span>
          </div>
          <h2 className="font-head text-2xl uppercase mb-4">Create room</h2>
          <CreateRoomForm onCreated={onEnterRoom} />
        </div>

        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <DoorOpen size={16} className="text-[#7209b7]" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#7209b7]">Crash a screening</span>
          </div>
          <h2 className="font-head text-2xl uppercase mb-4">Join room</h2>
          <JoinRoomForm onJoined={onEnterRoom} />
        </div>
      </section>
    </AppShell>
  );
}
