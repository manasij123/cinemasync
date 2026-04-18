import React, { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  ShieldCheck, Users, Film, MessageCircle, Bell, Trash2, Megaphone, UserCog, Crown,
} from "lucide-react";
import { Sparkline } from "../components/Charts";

function StatCard({ label, value, hint, icon: Icon, accent = "#7209b7", testid }) {
  return (
    <div className="glass-card rounded-xl p-5" data-testid={testid}>
      <div className="flex items-start justify-between mb-3">
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84]">{label}</span>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <div className="font-head text-4xl uppercase text-[#1a0b2e] leading-none">{value}</div>
      {hint != null && <div className="font-mono text-[10px] tracking-widest uppercase text-[#a597c4] mt-2">{hint}</div>}
    </div>
  );
}

function UsersTab({ stats }) {
  const { user: currentUser, formatApiError } = useAuth();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");

  const load = async () => {
    try { const { data } = await api.get("/admin/users"); setUsers(data.users || []); } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const del = async (u) => {
    if (!window.confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success("User deleted");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };
  const promote = async (u) => {
    try {
      await api.post(`/admin/users/${u.id}/promote`);
      toast.success(`${u.name} promoted to admin`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };
  const demote = async (u) => {
    try {
      await api.post(`/admin/users/${u.id}/demote`);
      toast.success(`${u.name} demoted`);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const filtered = users.filter((u) => {
    const s = q.toLowerCase();
    return !s || u.email.toLowerCase().includes(s) || u.name.toLowerCase().includes(s) || u.unique_id.toLowerCase().includes(s);
  });

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84]">Directory</div>
          <h2 className="font-head text-2xl uppercase">Users · {users.length}</h2>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, name or unique id"
          data-testid="admin-users-search"
          className="bg-[#fdf4ff] border border-[#e7c6ff] focus:border-[#7209b7] rounded-lg px-3 py-2 text-sm w-80 max-w-full"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="admin-users-table">
          <thead>
            <tr className="text-left font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] border-b border-[#e7c6ff]">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Unique ID</th>
              <th className="py-2 pr-3">Friends</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-[#e7c6ff]/50" data-testid={`admin-user-row-${u.id}`}>
                <td className="py-3 pr-3 font-body text-[#1a0b2e]">{u.name}</td>
                <td className="py-3 pr-3 font-mono text-[11px] text-[#6b5b84]">{u.email}</td>
                <td className="py-3 pr-3 font-mono text-[11px] text-[#6b5b84] truncate max-w-[220px]">{u.unique_id}</td>
                <td className="py-3 pr-3 font-mono text-[11px] text-[#6b5b84]">{u.friends_count}</td>
                <td className="py-3 pr-3">
                  {u.is_admin ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#7209b7] text-white font-mono text-[10px] tracking-wider uppercase rounded-full">
                      <Crown size={10} /> Admin
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-[#a597c4] uppercase tracking-wider">User</span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  <div className="flex justify-end gap-2">
                    {!u.is_admin && (
                      <button
                        onClick={() => promote(u)}
                        data-testid={`admin-promote-${u.id}`}
                        className="border border-[#7209b7]/40 text-[#7209b7] font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded hover:bg-[#7209b7] hover:text-white"
                      >
                        Promote
                      </button>
                    )}
                    {u.is_admin && u.id !== currentUser.id && (
                      <button
                        onClick={() => demote(u)}
                        data-testid={`admin-demote-${u.id}`}
                        className="border border-[#6b5b84]/40 text-[#6b5b84] font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded hover:bg-[#6b5b84] hover:text-white"
                      >
                        Demote
                      </button>
                    )}
                    {!u.is_admin && u.id !== currentUser.id && (
                      <button
                        onClick={() => del(u)}
                        data-testid={`admin-delete-user-${u.id}`}
                        className="border border-[#f72585]/40 text-[#f72585] font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded hover:bg-[#f72585] hover:text-white inline-flex items-center gap-1"
                      >
                        <Trash2 size={10} /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoomsTab() {
  const { formatApiError } = useAuth();
  const [rooms, setRooms] = useState([]);
  const load = async () => {
    try { const { data } = await api.get("/admin/rooms"); setRooms(data.rooms || []); } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };
  useEffect(() => { load(); }, []);
  const kill = async (r) => {
    if (!window.confirm(`Kill room ${r.id}? All messages will be removed.`)) return;
    try {
      await api.delete(`/admin/rooms/${r.id}`);
      toast.success("Room deleted");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="mb-4">
        <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84]">Active & Past</div>
        <h2 className="font-head text-2xl uppercase">Rooms · {rooms.length}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="admin-rooms-table">
          <thead>
            <tr className="text-left font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] border-b border-[#e7c6ff]">
              <th className="py-2 pr-3">Room ID</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Platform</th>
              <th className="py-2 pr-3">Participants</th>
              <th className="py-2 pr-3">Created</th>
              <th className="py-2 pr-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id} className="border-b border-[#e7c6ff]/50" data-testid={`admin-room-row-${r.id}`}>
                <td className="py-3 pr-3 font-mono text-[11px] text-[#1a0b2e]">{r.id}</td>
                <td className="py-3 pr-3 font-body text-[#1a0b2e]">{r.name}</td>
                <td className="py-3 pr-3 font-mono text-[11px] text-[#6b5b84] uppercase">{r.platform}</td>
                <td className="py-3 pr-3 font-mono text-[11px]">{r.participants?.length || 0}</td>
                <td className="py-3 pr-3 font-mono text-[10px] text-[#a597c4]">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                </td>
                <td className="py-3 pr-3 text-right">
                  <button
                    onClick={() => kill(r)}
                    data-testid={`admin-kill-room-${r.id}`}
                    className="border border-[#f72585]/40 text-[#f72585] font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded hover:bg-[#f72585] hover:text-white inline-flex items-center gap-1"
                  >
                    <Trash2 size={10} /> Kill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BroadcastTab() {
  const { formatApiError } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!title || !body) return toast.error("Title and body required");
    if (!window.confirm(`Send this broadcast to ALL users?`)) return;
    setLoading(true);
    try {
      const { data } = await api.post("/admin/broadcast", { title, body });
      toast.success(`Sent to ${data.sent_to} users`);
      setTitle(""); setBody("");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={send} className="glass-card rounded-xl p-5 max-w-xl">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone size={16} className="text-[#f72585]" />
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#f72585]">Announcement</span>
      </div>
      <h2 className="font-head text-2xl uppercase mb-4">Broadcast to all users</h2>
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Scheduled maintenance)"
          data-testid="admin-broadcast-title"
          className="w-full bg-[#fdf4ff] border border-[#e7c6ff] focus:border-[#7209b7] rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message body…"
          rows={4}
          data-testid="admin-broadcast-body"
          className="w-full bg-[#fdf4ff] border border-[#e7c6ff] focus:border-[#7209b7] rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          data-testid="admin-broadcast-send"
          className="w-full bg-gradient-to-r from-[#f72585] to-[#7209b7] text-white font-mono tracking-[0.2em] uppercase text-xs px-4 py-3 rounded-lg hover:shadow-[0_8px_20px_rgba(247,37,133,0.35)] disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send broadcast"}
        </button>
      </div>
      <p className="font-mono text-[10px] tracking-widest uppercase text-[#a597c4] mt-4">
        Creates a notification in every user's inbox. They can dismiss or read.
      </p>
    </form>
  );
}

export default function Admin() {
  const { user, loading } = useAuth();
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const { formatApiError } = useAuth();

  useEffect(() => {
    if (!user || !user.is_admin) return;
    (async () => {
      try { const { data } = await api.get("/admin/stats"); setStats(data); } catch (e) {
        toast.error(formatApiError(e.response?.data?.detail) || e.message);
      }
    })();
  }, [user]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.is_admin) {
    return (
      <AppShell subtitle="Forbidden" title="Admin Panel">
        <div className="glass-card rounded-xl p-10 text-center" data-testid="admin-forbidden">
          <ShieldCheck size={32} className="text-[#f72585] mx-auto mb-4" />
          <h2 className="font-head text-3xl uppercase mb-2">No entry</h2>
          <p className="text-[#6b5b84]">You need admin privileges to view this page.</p>
        </div>
      </AppShell>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "rooms", label: "Rooms" },
    { id: "broadcast", label: "Broadcast" },
  ];

  return (
    <AppShell subtitle="Control Tower" title="Admin Panel">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6" data-testid="admin-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`admin-tab-${t.id}`}
            className={`px-4 py-2 font-mono tracking-[0.2em] uppercase text-xs rounded-lg border transition-all ${
              tab === t.id
                ? "border-[#7209b7] bg-[#7209b7] text-white"
                : "border-[#e7c6ff] text-[#6b5b84] hover:border-[#7209b7]/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-6">
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="admin-overview">
            <StatCard testid="admin-stat-users" label="Total Users" value={stats?.total_users ?? "—"} hint={`+${stats?.new_users_7d ?? 0} this week`} icon={Users} accent="#7209b7" />
            <StatCard testid="admin-stat-rooms" label="Total Rooms" value={stats?.total_rooms ?? "—"} hint={`+${stats?.new_rooms_7d ?? 0} this week`} icon={Film} accent="#f72585" />
            <StatCard testid="admin-stat-messages" label="Total Messages" value={stats?.total_messages ?? "—"} icon={MessageCircle} accent="#4cc9f0" />
            <StatCard testid="admin-stat-notifs" label="Notifications" value={stats?.total_notifications ?? "—"} icon={Bell} accent="#4361ee" />
          </section>
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-head text-xl uppercase mb-3">Welcome, {user.name}</h3>
            <p className="text-[#6b5b84] text-sm leading-relaxed">
              This is the control tower. Use the tabs above to browse users, kill runaway rooms, promote other admins,
              or broadcast an announcement to every signed-in member.
            </p>
          </div>
        </div>
      )}

      {tab === "users" && <UsersTab stats={stats} />}
      {tab === "rooms" && <RoomsTab />}
      {tab === "broadcast" && <BroadcastTab />}
    </AppShell>
  );
}
