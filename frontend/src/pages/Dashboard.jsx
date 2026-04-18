import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import UniqueIdBadge from "../components/UniqueIdBadge";
import { toast } from "sonner";
import { Plus, DoorOpen, Users } from "lucide-react";

const PLATFORMS = [
  { id: "netflix", label: "Netflix", hint: "netflix.com", color: "#E50914" },
  { id: "prime", label: "Prime Video", hint: "primevideo.com", color: "#00A8E1" },
  { id: "hotstar", label: "Hotstar", hint: "hotstar.com", color: "#1F80E0" },
  { id: "hoichoi", label: "Hoichoi", hint: "hoichoi.tv", color: "#D90B4A" },
  { id: "addatimes", label: "Adda Times", hint: "addatimes.com", color: "#F4B400" },
  { id: "zee5", label: "ZEE5", hint: "zee5.com", color: "#7E2FAE" },
  { id: "custom", label: "Custom", hint: "any url", color: "#FACC15" },
];

function CreateRoom({ onCreated }) {
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
    <div className="border border-white/10 bg-[#141211] p-6" data-testid="create-room-card">
      <div className="flex items-center gap-2 mb-5">
        <Plus size={16} className="text-[#FACC15]" />
        <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#FACC15]">Host a screening</span>
      </div>
      <h2 className="font-head text-3xl uppercase mb-6">Create a new room</h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#99958E] block mb-2">Room name</label>
          <input
            value={name}
            required
            onChange={(e) => setName(e.target.value)}
            data-testid="create-room-name-input"
            className="w-full bg-[#0A0908] border border-white/10 focus:border-[#FACC15] px-4 py-3 font-body"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#99958E] block mb-2">Password</label>
          <input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="create-room-password-input"
            className="w-full bg-[#0A0908] border border-white/10 focus:border-[#FACC15] px-4 py-3 font-body"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#99958E] block mb-2">Platform</label>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {PLATFORMS.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setPlatform(p.id)}
                data-testid={`platform-pick-${p.id}`}
                className={`px-3 py-2 text-xs font-mono uppercase tracking-widest border transition-all ${
                  platform === p.id
                    ? "border-[#FACC15] text-[#FACC15] bg-[#FACC15]/10"
                    : "border-white/10 text-[#99958E] hover:border-white/30"
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
          className="w-full bg-[#FACC15] text-[#0A0908] font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#FDE047] disabled:opacity-60"
        >
          {loading ? "Rolling film…" : "Reserve the screen"}
        </button>
      </form>
    </div>
  );
}

function JoinRoom({ onJoined }) {
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
    <div className="border border-white/10 bg-[#141211] p-6" data-testid="join-room-card">
      <div className="flex items-center gap-2 mb-5">
        <DoorOpen size={16} className="text-[#FACC15]" />
        <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#FACC15]">Crash a screening</span>
      </div>
      <h2 className="font-head text-3xl uppercase mb-6">Join an existing room</h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#99958E] block mb-2">Room ID</label>
          <input
            required
            value={roomId}
            onChange={(e) => setRoomId(e.target.value.toUpperCase())}
            data-testid="join-room-id-input"
            className="w-full bg-[#0A0908] border border-white/10 focus:border-[#FACC15] px-4 py-3 font-mono tracking-widest uppercase"
          />
        </div>
        <div>
          <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#99958E] block mb-2">Password</label>
          <input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="join-room-password-input"
            className="w-full bg-[#0A0908] border border-white/10 focus:border-[#FACC15] px-4 py-3 font-body"
          />
        </div>
        <button
          disabled={loading}
          data-testid="join-room-submit-button"
          className="w-full border border-white/20 text-[#F7F7F2] font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:border-[#FACC15] hover:text-[#FACC15] disabled:opacity-60"
        >
          {loading ? "Tearing ticket…" : "Sneak in"}
        </button>
      </form>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [requestsIn, setRequestsIn] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/friends");
        setFriends(data.friends || []);
        setRequestsIn(data.requests_in || []);
      } catch {}
    })();
  }, []);

  const onEnterRoom = (room) => navigate(`/lobby/${room.id}`);

  return (
    <div>
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-6 md:px-10 py-10">
        {/* Greeting */}
        <section className="mb-10" data-testid="dashboard-greeting">
          <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#FACC15] mb-3">House Lights Dim</div>
          <h1 className="font-head text-4xl sm:text-5xl uppercase mb-4">Good evening, {user.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <UniqueIdBadge value={user.unique_id} testid="dashboard-unique-id" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#99958E]">
              Share this ID so friends can find you
            </span>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <CreateRoom onCreated={onEnterRoom} />
            <JoinRoom onJoined={onEnterRoom} />
          </div>

          <aside className="lg:col-span-4 space-y-6">
            <div className="border border-white/10 bg-[#141211] p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#FACC15]">Friends</span>
                <Link to="/friends" data-testid="dashboard-manage-friends-link" className="font-mono text-[10px] tracking-widest uppercase text-[#99958E] hover:text-[#FACC15]">Manage</Link>
              </div>
              <h3 className="font-head text-2xl uppercase mb-4">Your regulars</h3>
              {friends.length === 0 ? (
                <div className="text-sm text-[#99958E]">No friends yet. Share your unique ID.</div>
              ) : (
                <ul className="space-y-3" data-testid="dashboard-friends-list">
                  {friends.slice(0, 5).map((f) => (
                    <li key={f.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#FACC15]/20 border border-white/10 flex items-center justify-center font-head text-sm">
                        {f.name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-body text-sm truncate">{f.name}</div>
                        <div className="font-mono text-[10px] text-[#99958E] truncate">{f.unique_id}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border border-white/10 bg-[#141211] p-6">
              <div className="flex items-center gap-2 mb-2">
                <Users size={14} className="text-[#FACC15]" />
                <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#FACC15]">Requests</span>
              </div>
              <h3 className="font-head text-2xl uppercase mb-4">Incoming</h3>
              {requestsIn.length === 0 ? (
                <div className="text-sm text-[#99958E]">You're all caught up.</div>
              ) : (
                <div className="text-sm text-[#99958E]">{requestsIn.length} pending · visit Friends to respond</div>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
