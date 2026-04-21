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

function StatCard({ label, value, hint, icon: Icon, accent = "#6a14ff", testid }) {
  return (
    <div className="glass-card rounded-xl p-5" data-testid={testid}>
      <div className="flex items-start justify-between mb-3">
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc]">{label}</span>
        <Icon size={16} style={{ color: accent }} />
      </div>
      <div className="font-head text-4xl uppercase text-[#ffffff] leading-none">{value}</div>
      {hint != null && <div className="font-mono text-[10px] tracking-widest uppercase text-[#888888] mt-2">{hint}</div>}
    </div>
  );
}

function UsersTab({ stats }) {
  const { user: currentUser, formatApiError } = useAuth();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(() => new Set()); // persists across search
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const load = async () => {
    try { const { data } = await api.get("/admin/users"); setUsers(data.users || []); } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const isDeletable = (u) => !u.is_admin && u.id !== currentUser.id;

  const del = async (u) => {
    if (!window.confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      toast.success("User deleted");
      setSelected((s) => { const n = new Set(s); n.delete(u.id); return n; });
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };
  const promote = async (u) => {
    try {
      await api.post(`/admin/users/${u.id}/promote`);
      toast.success(`${u.name} promoted to admin`);
      setSelected((s) => { const n = new Set(s); n.delete(u.id); return n; });
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

  // Header checkbox reflects *visible, deletable* rows only. Selecting it
  // adds them to the persisted Set. Unselecting it only removes *visible*
  // rows from the Set — any previously selected user hidden by the current
  // search stays selected, per user's explicit requirement.
  const visibleDeletable = filtered.filter(isDeletable);
  const visibleSelectedCount = visibleDeletable.filter((u) => selected.has(u.id)).length;
  const headerState =
    visibleDeletable.length > 0 && visibleSelectedCount === visibleDeletable.length
      ? "all"
      : visibleSelectedCount > 0
      ? "some"
      : "none";

  const toggleOne = (id) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const toggleVisible = () => {
    setSelected((s) => {
      const n = new Set(s);
      if (headerState === "all") {
        visibleDeletable.forEach((u) => n.delete(u.id));
      } else {
        visibleDeletable.forEach((u) => n.add(u.id));
      }
      return n;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const { data } = await api.post("/admin/users/bulk-delete", {
        user_ids: Array.from(selected),
      });
      const msg = [`Deleted ${data.deleted}`];
      if (data.skipped_admins) msg.push(`skipped ${data.skipped_admins} admin(s)`);
      if (data.skipped_missing) msg.push(`${data.skipped_missing} missing`);
      toast.success(msg.join(" · "));
      if ((data.errors || []).length) toast.error(`${data.errors.length} errors`);
      setSelected(new Set());
      setBulkConfirmOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // Build a preview list of users (across all pages) currently in Set — so the
  // admin can see what they're about to delete even if filtered out.
  const selectedUsers = users.filter((u) => selected.has(u.id));

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc]">Directory</div>
          <h2 className="font-head text-2xl uppercase">Users · {users.length}</h2>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, name or unique id"
          data-testid="admin-users-search"
          className="bg-[#2a2a2a] border border-[#3a3a3a] focus:border-[#ffd100] rounded-lg px-3 py-2 text-sm w-80 max-w-full"
        />
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div
          data-testid="admin-bulk-bar"
          className="mb-4 flex items-center gap-3 flex-wrap rounded-lg border border-[#ffd100]/40 bg-[#fff5f9] px-4 py-3"
        >
          <span className="font-mono text-[11px] tracking-widest uppercase text-[#ffd100] font-semibold">
            {selected.size} selected
          </span>
          <span className="font-mono text-[10px] tracking-widest uppercase text-[#cccccc]">
            Selections persist across searches
          </span>
          <div className="ml-auto flex gap-2">
            <button
              onClick={clearSelection}
              data-testid="admin-bulk-clear"
              className="border border-[#6a14ff]/40 text-[#6a14ff] font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-md hover:bg-[#6a14ff]/10"
            >
              Clear
            </button>
            <button
              onClick={() => setBulkConfirmOpen(true)}
              data-testid="admin-bulk-delete-open"
              className="bg-[#ffd100] text-black font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-md hover:bg-[#d80d6f] inline-flex items-center gap-1"
            >
              <Trash2 size={11} /> Delete {selected.size}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[640px] text-sm" data-testid="admin-users-table">
          <thead>
            <tr className="text-left font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc] border-b border-[#3a3a3a]">
              <th className="py-2 pr-3 w-10">
                <input
                  type="checkbox"
                  ref={(el) => { if (el) el.indeterminate = headerState === "some"; }}
                  checked={headerState === "all"}
                  onChange={toggleVisible}
                  disabled={visibleDeletable.length === 0}
                  data-testid="admin-select-all-visible"
                  className="accent-[#6a14ff] w-4 h-4 cursor-pointer"
                  title={headerState === "all" ? "Unselect all visible" : "Select all visible"}
                />
              </th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">Unique ID</th>
              <th className="py-2 pr-3">Friends</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2 pr-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const deletable = isDeletable(u);
              const isSelected = selected.has(u.id);
              return (
                <tr
                  key={u.id}
                  className={
                    "border-b border-[#3a3a3a]/50 transition-colors " +
                    (isSelected ? "bg-[#fff5f9]" : "")
                  }
                  data-testid={`admin-user-row-${u.id}`}
                >
                  <td className="py-3 pr-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(u.id)}
                      disabled={!deletable}
                      data-testid={`admin-select-${u.id}`}
                      title={deletable ? (isSelected ? "Unselect" : "Select") : "Admins / yourself can't be deleted"}
                      className="accent-[#ffd100] w-4 h-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="py-3 pr-3 font-body text-[#ffffff]">{u.name}</td>
                  <td className="py-3 pr-3 font-mono text-[11px] text-[#cccccc]">{u.email}</td>
                  <td className="py-3 pr-3 font-mono text-[11px] text-[#cccccc] truncate max-w-[220px]">{u.unique_id}</td>
                  <td className="py-3 pr-3 font-mono text-[11px] text-[#cccccc]">{u.friends_count}</td>
                  <td className="py-3 pr-3">
                    {u.is_admin ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#6a14ff] text-white font-mono text-[10px] tracking-wider uppercase rounded-full">
                        <Crown size={10} /> Admin
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-[#888888] uppercase tracking-wider">User</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex justify-end gap-2">
                      {!u.is_admin && (
                        <button
                          onClick={() => promote(u)}
                          data-testid={`admin-promote-${u.id}`}
                          className="border border-[#6a14ff]/40 text-[#6a14ff] font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded hover:bg-[#6a14ff] hover:text-white"
                        >
                          Promote
                        </button>
                      )}
                      {u.is_admin && u.id !== currentUser.id && (
                        <button
                          onClick={() => demote(u)}
                          data-testid={`admin-demote-${u.id}`}
                          className="border border-[#cccccc]/40 text-[#cccccc] font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded hover:bg-[#cccccc] hover:text-white"
                        >
                          Demote
                        </button>
                      )}
                      {deletable && (
                        <button
                          onClick={() => del(u)}
                          data-testid={`admin-delete-user-${u.id}`}
                          className="border border-[#ffd100]/40 text-[#ffd100] font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded hover:bg-[#ffd100] hover:text-white inline-flex items-center gap-1"
                        >
                          <Trash2 size={10} /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-[#cccccc] text-sm">No users match "{q}"</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {bulkConfirmOpen && (
        <BulkDeleteModal
          count={selected.size}
          users={selectedUsers}
          loading={bulkLoading}
          onCancel={() => setBulkConfirmOpen(false)}
          onConfirm={bulkDelete}
        />
      )}
    </div>
  );
}

function BulkDeleteModal({ count, users, loading, onCancel, onConfirm }) {
  const [confirm, setConfirm] = useState("");
  const ok = confirm.trim().toUpperCase() === "DELETE";
  return (
    <div
      data-testid="admin-bulk-delete-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#ffffff]/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white border border-[#ffd100]/40 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 bg-[#ffd100] text-black">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-80">Destructive action</div>
          <div className="font-head text-2xl uppercase leading-tight">Delete {count} user{count !== 1 ? "s" : ""}?</div>
        </div>
        <div className="p-5">
          <p className="text-sm text-[#cccccc] mb-3">
            Every selected user will be wiped permanently — their rooms, chats, notifications, uploaded photos and friendships will all vanish. This can't be undone.
          </p>
          <div className="max-h-40 overflow-y-auto border border-[#3a3a3a] rounded-md divide-y divide-[#3a3a3a]/70">
            {users.slice(0, 50).map((u) => (
              <div key={u.id} className="px-3 py-2 text-[12px] flex justify-between gap-2" data-testid={`admin-bulk-preview-${u.id}`}>
                <span className="truncate">{u.name}</span>
                <span className="font-mono text-[11px] text-[#cccccc] truncate">{u.email}</span>
              </div>
            ))}
            {users.length > 50 && (
              <div className="px-3 py-2 text-[11px] text-[#cccccc]">…and {users.length - 50} more</div>
            )}
          </div>
          <label className="block mt-4 font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc]">
            Type <span className="text-[#ffd100] font-semibold">DELETE</span> to confirm
          </label>
          <input
            autoFocus
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            data-testid="admin-bulk-confirm-input"
            className="mt-2 w-full bg-white border border-[#ffd100]/40 focus:border-[#ffd100] px-3 py-2 rounded-md font-mono uppercase tracking-widest text-sm"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={onConfirm}
              disabled={!ok || loading}
              data-testid="admin-bulk-confirm-button"
              className="flex-1 bg-[#ffd100] text-black font-mono tracking-[0.25em] uppercase text-xs px-4 py-3 rounded-md hover:bg-[#d80d6f] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Trash2 size={13} /> {loading ? "Deleting…" : `Delete ${count}`}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              data-testid="admin-bulk-cancel-button"
              className="flex-1 border border-[#6a14ff]/40 text-[#6a14ff] font-mono tracking-[0.25em] uppercase text-xs px-4 py-3 rounded-md hover:bg-[#6a14ff]/10 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
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
        <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc]">Active & Past</div>
        <h2 className="font-head text-2xl uppercase">Rooms · {rooms.length}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="admin-rooms-table">
          <thead>
            <tr className="text-left font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc] border-b border-[#3a3a3a]">
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
              <tr key={r.id} className="border-b border-[#3a3a3a]/50" data-testid={`admin-room-row-${r.id}`}>
                <td className="py-3 pr-3 font-mono text-[11px] text-[#ffffff]">{r.id}</td>
                <td className="py-3 pr-3 font-body text-[#ffffff]">{r.name}</td>
                <td className="py-3 pr-3 font-mono text-[11px] text-[#cccccc] uppercase">{r.platform}</td>
                <td className="py-3 pr-3 font-mono text-[11px]">{r.participants?.length || 0}</td>
                <td className="py-3 pr-3 font-mono text-[10px] text-[#888888]">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                </td>
                <td className="py-3 pr-3 text-right">
                  <button
                    onClick={() => kill(r)}
                    data-testid={`admin-kill-room-${r.id}`}
                    className="border border-[#ffd100]/40 text-[#ffd100] font-mono text-[10px] tracking-widest uppercase px-2 py-1 rounded hover:bg-[#ffd100] hover:text-white inline-flex items-center gap-1"
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
        <Megaphone size={16} className="text-[#ffd100]" />
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#ffd100]">Announcement</span>
      </div>
      <h2 className="font-head text-2xl uppercase mb-4">Broadcast to all users</h2>
      <div className="space-y-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Scheduled maintenance)"
          data-testid="admin-broadcast-title"
          className="w-full bg-[#2a2a2a] border border-[#3a3a3a] focus:border-[#ffd100] rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message body…"
          rows={4}
          data-testid="admin-broadcast-body"
          className="w-full bg-[#2a2a2a] border border-[#3a3a3a] focus:border-[#ffd100] rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          data-testid="admin-broadcast-send"
          className="w-full bg-[#ffd100] text-black font-mono tracking-[0.2em] uppercase text-xs px-4 py-3 rounded-lg hover:shadow-[0_8px_20px_rgba(255,209,0,0.35)] disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send broadcast"}
        </button>
      </div>
      <p className="font-mono text-[10px] tracking-widest uppercase text-[#888888] mt-4">
        Creates a notification in every user's inbox. They can dismiss or read.
      </p>
    </form>
  );
}

function AlertsTab() {
  const { formatApiError } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/notifications");
      const onlyAlerts = (data.notifications || []).filter((n) => n.type === "admin-alert");
      setAlerts(onlyAlerts);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const dismiss = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setAlerts((c) => c.filter((n) => n.id !== id));
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };
  const dismissAll = async () => {
    if (!alerts.length) return;
    if (!window.confirm(`Dismiss all ${alerts.length} alerts?`)) return;
    for (const a of alerts) {
      try { await api.delete(`/notifications/${a.id}`); } catch {}
    }
    setAlerts([]);
    toast.success("All alerts cleared");
  };

  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <Bell size={16} className="text-[#ffd100]" />
        <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#ffd100]">System alerts</span>
        {alerts.length > 0 && (
          <button
            onClick={dismissAll}
            data-testid="admin-alerts-dismiss-all"
            className="ml-auto border border-[#3a3a3a] font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-md hover:border-[#ffd100] hover:text-[#ffd100]"
          >
            Dismiss all
          </button>
        )}
      </div>
      <h2 className="font-head text-2xl uppercase mb-4">Alerts · {alerts.length}</h2>
      {loading && alerts.length === 0 && (
        <div className="font-mono text-[10px] tracking-widest uppercase text-[#cccccc]">Loading…</div>
      )}
      {!loading && alerts.length === 0 && (
        <div className="font-mono text-[10px] tracking-widest uppercase text-[#cccccc]" data-testid="admin-alerts-empty">
          Nothing to review. All quiet on the host front.
        </div>
      )}
      <div className="space-y-3" data-testid="admin-alerts-list">
        {alerts.map((a) => {
          const when = a.created_at ? new Date(a.created_at) : null;
          const whenLabel = when ? when.toLocaleString() : "";
          return (
            <div
              key={a.id}
              className="border border-[#3a3a3a] bg-[#2a2a2a] rounded-lg p-4 flex items-start gap-3"
              data-testid={`admin-alert-${a.id}`}
            >
              <div className="w-9 h-9 rounded-full bg-[#ffd100]/15 text-[#ffd100] flex items-center justify-center shrink-0">
                <Trash2 size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[10px] tracking-widest uppercase text-[#cccccc] mb-1">
                  Room killed · {whenLabel}
                </div>
                <div className="font-body text-sm text-[#ffffff]">
                  Host <span className="text-[#6a14ff] font-semibold">{a.from_name || "Unknown"}</span> killed room{" "}
                  <span className="font-head uppercase">{a.room_name || a.room_id}</span>
                  {a.room_id && <span className="font-mono text-[11px] text-[#cccccc]"> · {a.room_id}</span>}
                </div>
              </div>
              <button
                onClick={() => dismiss(a.id)}
                data-testid={`admin-alert-ok-${a.id}`}
                className="bg-[#6a14ff] text-white font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-md hover:bg-[#5a0fd6]"
              >
                OK
              </button>
            </div>
          );
        })}
      </div>
    </div>
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
          <ShieldCheck size={32} className="text-[#ffd100] mx-auto mb-4" />
          <h2 className="font-head text-3xl uppercase mb-2">No entry</h2>
          <p className="text-[#cccccc]">You need admin privileges to view this page.</p>
        </div>
      </AppShell>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "rooms", label: "Rooms" },
    { id: "alerts", label: "Alerts" },
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
                ? "border-[#6a14ff] bg-[#6a14ff] text-white"
                : "border-[#3a3a3a] text-[#cccccc] hover:border-[#6a14ff]/60"
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
            <StatCard testid="admin-stat-users" label="Total Users" value={stats?.total_users ?? "—"} hint={`+${stats?.new_users_7d ?? 0} this week`} icon={Users} accent="#6a14ff" />
            <StatCard testid="admin-stat-rooms" label="Total Rooms" value={stats?.total_rooms ?? "—"} hint={`+${stats?.new_rooms_7d ?? 0} this week`} icon={Film} accent="#ffd100" />
            <StatCard testid="admin-stat-messages" label="Total Messages" value={stats?.total_messages ?? "—"} icon={MessageCircle} accent="#4cc9f0" />
            <StatCard testid="admin-stat-notifs" label="Notifications" value={stats?.total_notifications ?? "—"} icon={Bell} accent="#4361ee" />
          </section>
          <div className="glass-card rounded-xl p-5">
            <h3 className="font-head text-xl uppercase mb-3">Welcome, {user.name}</h3>
            <p className="text-[#cccccc] text-sm leading-relaxed">
              This is the control tower. Use the tabs above to browse users, kill runaway rooms, promote other admins,
              or broadcast an announcement to every signed-in member.
            </p>
          </div>
        </div>
      )}

      {tab === "users" && <UsersTab stats={stats} />}
      {tab === "rooms" && <RoomsTab />}
      {tab === "alerts" && <AlertsTab />}
      {tab === "broadcast" && <BroadcastTab />}
    </AppShell>
  );
}
