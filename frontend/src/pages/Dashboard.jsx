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
import PlatformLogo, { PLATFORM_LIST, platformLabel } from "../components/PlatformLogo";
import QRCodeCard from "../components/QRCodeCard";
import OnboardingChecklist from "../components/OnboardingChecklist";

// Chart colour accents per platform (purely for charts/doughnut)
const PLATFORM_CHART_COLOR = {
  netflix: "#E50914", prime: "#00A8E1", hotstar: "#1A6AFF",
  hoichoi: "#f72585", addatimes: "#ffcc00", zee5: "#9333ea", custom: "#b8c0ff",
};
const PLATFORMS = PLATFORM_LIST.map((p) => ({
  id: p.id, label: p.short, color: PLATFORM_CHART_COLOR[p.id] || "#7209b7",
}));
const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.id, platformLabel(p.id)]));
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

function CreateRoomForm({ onCreated, friendCount }) {
  const [name, setName] = useState("Friday Night Reel");
  const [password, setPassword] = useState("");
  const [platform, setPlatform] = useState("custom");
  const [notifyFriends, setNotifyFriends] = useState(true);
  const [loading, setLoading] = useState(false);
  const { formatApiError } = useAuth();
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/rooms", { name, password, platform });
      toast.success(`Room ${data.room.id} created`);
      if (notifyFriends && friendCount > 0) {
        try {
          const res = await api.post(`/rooms/${data.room.id}/broadcast`, { password });
          const n = res.data?.sent || 0;
          if (n > 0) toast.success(`Invite sent to ${n} friend${n > 1 ? "s" : ""}`);
        } catch {}
      }
      onCreated(data.room, { password });
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
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
        {PLATFORMS.map((p) => {
          const active = platform === p.id;
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => setPlatform(p.id)}
              data-testid={`platform-pick-${p.id}`}
              title={p.label}
              className={`group relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                active
                  ? "border-[#7209b7] bg-gradient-to-br from-[#fdf4ff] to-[#f0e5ff] shadow-[0_10px_28px_rgba(114,9,183,0.28)] -translate-y-1"
                  : "border-[#e7c6ff] hover:border-[#7209b7]/60 hover:bg-[#fdf4ff] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(114,9,183,0.12)]"
              }`}
            >
              <PlatformLogo
                platform={p.id}
                size={72}
                rounded="lg"
                showRing={active}
                className={active ? "" : "group-hover:scale-105 transition-transform"}
              />
              <span className={`font-mono text-[10px] tracking-[0.2em] uppercase truncate w-full text-center ${
                active ? "text-[#7209b7] font-semibold" : "text-[#6b5b84]"
              }`}>
                {p.label}
              </span>
              {active && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#f72585] shadow-[0_0_0_3px_#fff] flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={notifyFriends}
          onChange={(e) => setNotifyFriends(e.target.checked)}
          data-testid="create-room-notify-friends"
          className="accent-[#7209b7] w-4 h-4"
        />
        <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#6b5b84]">
          Notify my friends{friendCount > 0 ? ` · ${friendCount}` : ""}
        </span>
      </label>
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
      <div className="flex items-start gap-3 mb-3">
        <PlatformLogo platform={room.platform} size={44} rounded="md" showRing />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#f72585] pulse-live" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#f72585]">Live</span>
            {isHost && (
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7209b7] ml-auto">You host</span>
            )}
          </div>
          <div className="font-head text-lg uppercase text-[#1a0b2e] truncate">{room.name}</div>
        </div>
      </div>
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

function HistoryCard({ row, onClick }) {
  const when = row.last_joined_at ? new Date(row.last_joined_at) : null;
  const whenLabel = when
    ? `${Math.max(0, Math.round((Date.now() - when.getTime()) / 60000))}m ago`
    : "";
  return (
    <button
      onClick={onClick}
      data-testid={`history-card-${row.room_id}`}
      className="w-full text-left glass-card rounded-xl p-4 transition-all hover:-translate-y-0.5 group"
    >
      <div className="flex items-start gap-3 mb-2">
        <PlatformLogo platform={row.platform} size={40} rounded="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {row.is_active ? (
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#f72585] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#f72585] pulse-live" /> Live
              </span>
            ) : (
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84]">Ended</span>
            )}
            <span className="ml-auto font-mono text-[9px] tracking-widest uppercase text-[#6b5b84]">{whenLabel}</span>
          </div>
          <div className="font-head text-base uppercase text-[#1a0b2e] truncate">{row.room_name}</div>
        </div>
      </div>
      <div className="font-mono text-[10px] tracking-widest uppercase text-[#6b5b84] flex justify-between">
        <span className="truncate">{PLATFORM_LABEL[row.platform] || "Custom"} · {row.room_id}</span>
        <span>{row.visit_count}× visited</span>
      </div>
    </button>
  );
}

function InvitationsInbox({ notifs, onAccept, onDismiss }) {
  return (
    <div className="glass-card rounded-xl p-5 flex flex-col" data-testid="invitations-inbox-card">
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
          {notifs.map((n) => <InviteRow key={n.id} n={n} onAccept={onAccept} onDismiss={onDismiss} />)}
        </div>
      )}
    </div>
  );
}

function UserStat({ label, value, icon: Icon, accent = "#7209b7", testid }) {
  return (
    <div
      className="glass-card rounded-xl p-5 flex items-center gap-4"
      data-testid={testid}
      style={{ borderColor: `${accent}33` }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
        style={{ background: `${accent}15`, color: accent }}
      >
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <div className="font-head text-3xl uppercase text-[#1a0b2e] leading-none">{value}</div>
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-[#6b5b84] mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function UserSummary({ user, friendCount, invitationCount, liveRoomCount, historyCount }) {
  return (
    <section className="mb-6" data-testid="dashboard-user-summary">
      <div className="glass-card rounded-xl p-5 md:p-6 mb-4 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-[#f72585]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-[#7209b7]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Film size={14} className="text-[#7209b7]" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7209b7]">Your CineStub</span>
          </div>
          <h3 className="font-head text-2xl md:text-3xl uppercase leading-none">
            {greetLine(user, friendCount, invitationCount, liveRoomCount, historyCount)}
          </h3>
          <p className="text-sm text-[#6b5b84] mt-2 max-w-2xl">
            {invitationCount > 0
              ? `${invitationCount} fresh invite${invitationCount > 1 ? "s" : ""} below — tap accept to join the party.`
              : liveRoomCount > 0
              ? `There ${liveRoomCount === 1 ? "is" : "are"} ${liveRoomCount} live room${liveRoomCount === 1 ? "" : "s"} buzzing. Rejoin from the list below.`
              : "Kick things off — host a room or ping a friend to start a watch party."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="dashboard-user-stats">
        <UserStat testid="user-stat-invites" label="New invitations" value={invitationCount} icon={Bell} accent="#f72585" />
        <UserStat testid="user-stat-live" label="Live rooms" value={liveRoomCount} icon={Film} accent="#7209b7" />
        <UserStat testid="user-stat-friends" label="Friends" value={friendCount} icon={Users} accent="#4361ee" />
        <UserStat testid="user-stat-history" label="Past rooms" value={historyCount} icon={Clock} accent="#4cc9f0" />
      </div>
    </section>
  );
}

function greetLine(user, friends, invites, live, history) {
  if (invites > 0) return `Hey ${user.name?.split(" ")[0] || "there"}, someone's waiting for you.`;
  if (live > 0) return `${live} party${live === 1 ? "" : " ies"} happening right now.`;
  if (friends === 0) return "Let's build your first movie circle.";
  if (history === 0) return "Time for your first CinemaSync room.";
  return `Welcome back, ${user.name?.split(" ")[0] || "friend"}.`;
}

function RoomCreatedModal({ room, password, friendCount, onClose }) {
  return (
    <div
      data-testid="room-created-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1a0b2e]/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white border border-[#7209b7]/30 overflow-hidden shadow-[0_30px_80px_rgba(26,11,46,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-gradient-to-r from-[#7209b7] to-[#f72585] text-white">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-80">Room created</div>
          <div className="font-head text-2xl uppercase leading-tight truncate">{room.name}</div>
          <div className="font-mono text-[11px] tracking-widest mt-1 opacity-90">
            ID: {room.id} · {friendCount > 0 ? `Friends notified` : "No friends yet"}
          </div>
        </div>
        <div className="p-5">
          <QRCodeCard roomId={room.id} password={password} roomName={room.name} size={200} testid="room-created-qr" />
          <p className="text-xs text-[#6b5b84] mt-3 text-center">
            Your friends can point Google Lens or any QR app at this code — it will reveal the Room ID and Password instantly.
          </p>
          <button
            onClick={onClose}
            data-testid="room-created-enter-button"
            className="mt-4 w-full bg-[#7209b7] text-white font-mono tracking-[0.25em] uppercase text-xs px-4 py-3 rounded-lg hover:bg-[#4a0580]"
          >
            Enter the lobby
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, formatApiError } = useAuth();
  const [friends, setFriends] = useState([]);
  const [activeRooms, setActiveRooms] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [history, setHistory] = useState([]);
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
    const loadHistory = async () => {
      try { const { data } = await api.get("/rooms/history?limit=20"); setHistory(data.history || []); } catch {}
    };
    loadAll();
    loadHistory();
    const t = setInterval(loadAll, 5000);
    const h = setInterval(loadHistory, 30000);
    return () => { clearInterval(t); clearInterval(h); };
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

  const [justCreated, setJustCreated] = useState(null); // { room, password }
  const onEnterRoom = (room, extras) => {
    if (extras?.password) {
      setJustCreated({ room, password: extras.password });
    } else {
      navigate(`/lobby/${room.id}`);
    }
  };
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
      actions={<UniqueIdBadge value={user.unique_id} user={user} testid="dashboard-unique-id" />}
    >
      <OnboardingChecklist
        user={user}
        friendCount={friends.length}
        roomCount={history.length}
        hasInvited={history.length > 0}
      />

      {/* Admin-only analytics: KPI row + charts */}
      {user.is_admin && (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="dashboard-stats">
            <KPI testid="stat-live" label="Live Rooms" value={liveCount} delta={12} up sparkData={sparkA} sparkColor="#f72585" />
            <KPI testid="stat-invites" label="Invitations" value={notifs.length} delta={5} up={notifs.length > 0} sparkData={sparkC} sparkColor="#4cc9f0" />
            <KPI testid="stat-friends" label="Regulars" value={friends.length} delta={8} up sparkData={sparkB} sparkColor="#7209b7" />
            <KPI testid="stat-minutes" label="Minutes Watched" value={watchMinutes} delta={24} up sparkData={sparkD} sparkColor="#4361ee" />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6" data-testid="dashboard-charts-row-1">
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

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6" data-testid="dashboard-charts-row-2">
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

            {/* Admin inbox sits beside the bar chart */}
            <InvitationsInbox notifs={notifs} onAccept={acceptInvite} onDismiss={dismissInvite} />
          </section>
        </>
      )}

      {/* Non-admin summary strip (replaces the analytics section for regular users) */}
      {!user.is_admin && (
        <UserSummary
          user={user}
          friendCount={friends.length}
          invitationCount={notifs.length}
          liveRoomCount={liveCount}
          historyCount={history.length}
        />
      )}

      {/* Invitations inbox for regular users (admins see it inside charts row) */}
      {!user.is_admin && (
        <section className="mb-6" data-testid="dashboard-user-inbox">
          <InvitationsInbox notifs={notifs} onAccept={acceptInvite} onDismiss={dismissInvite} />
        </section>
      )}

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

      {/* Room history */}
      {history.length > 0 && (
        <section className="mb-6" data-testid="dashboard-history-section">
          <div className="flex items-center gap-3 mb-3">
            <Film size={16} className="text-[#7209b7]" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#7209b7]">Recent rooms · {history.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="dashboard-history-list">
            {history.slice(0, 9).map((h) => (
              <HistoryCard
                key={`${h.room_id}-${h.last_joined_at}`}
                row={h}
                onClick={() => {
                  if (h.is_active) navigate(`/room/${h.room_id}`);
                  else toast.info("This room has ended. Ask the host to create a new one.");
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Actions row — stacked: Host creates room on top, Join room below */}
      <section className="space-y-4">
        <div id="create-room" className="glass-card rounded-xl p-5 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={16} className="text-[#f72585]" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#f72585]">Host</span>
          </div>
          <h2 className="font-head text-2xl md:text-3xl uppercase mb-5">Create room</h2>
          <CreateRoomForm onCreated={onEnterRoom} friendCount={friends.length} />
        </div>

        <div className="glass-card rounded-xl p-5 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <DoorOpen size={16} className="text-[#7209b7]" />
            <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#7209b7]">Crash a screening</span>
          </div>
          <h2 className="font-head text-2xl md:text-3xl uppercase mb-5">Join room</h2>
          <div className="max-w-xl">
            <JoinRoomForm onJoined={onEnterRoom} />
          </div>
        </div>
      </section>

      {justCreated && (
        <RoomCreatedModal
          room={justCreated.room}
          password={justCreated.password}
          friendCount={friends.length}
          onClose={() => {
            const room = justCreated.room;
            setJustCreated(null);
            navigate(`/lobby/${room.id}`);
          }}
        />
      )}
    </AppShell>
  );
}
