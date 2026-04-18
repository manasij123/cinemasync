import React, { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { Search, UserPlus, X, Check, UserMinus } from "lucide-react";

function Row({ u, actions }) {
  return (
    <div className="flex items-center justify-between p-3 border border-white/10 bg-[#1E1C1A] rounded-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 bg-[#E5A93C]/20 border border-white/10 flex items-center justify-center font-head">
          {u.profile_image ? (
            <img src={u.profile_image} alt="" className="w-full h-full object-cover" />
          ) : (
            u.name?.[0]?.toUpperCase()
          )}
        </div>
        <div className="min-w-0">
          <div className="font-body text-sm truncate">{u.name}</div>
          <div className="font-mono text-[10px] text-[#99958E] truncate">{u.unique_id}</div>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">{actions}</div>
    </div>
  );
}

export default function Friends() {
  const { formatApiError } = useAuth();
  const [query, setQuery] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [requestsIn, setRequestsIn] = useState([]);
  const [requestsOut, setRequestsOut] = useState([]);
  const [tab, setTab] = useState("friends");

  const load = async () => {
    try {
      const { data } = await api.get("/friends");
      setFriends(data.friends || []);
      setRequestsIn(data.requests_in || []);
      setRequestsOut(data.requests_out || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const doSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchLoading(true);
    setFoundUser(null);
    try {
      const { data } = await api.get("/friends/search", { params: { unique_id: query.trim() } });
      if (!data.user) toast.error("No user with that ID");
      setFoundUser(data.user);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSearchLoading(false);
    }
  };

  const sendRequest = async (unique_id) => {
    try {
      await api.post("/friends/request", { unique_id });
      toast.success("Request sent");
      load();
      setFoundUser(null);
      setQuery("");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const accept = async (user_id) => {
    try {
      await api.post("/friends/accept", { user_id });
      toast.success("You're friends");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const reject = async (user_id) => {
    try {
      await api.post("/friends/reject", { user_id });
      toast.success("Rejected");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const cancel = async (user_id) => {
    try {
      await api.post("/friends/cancel", { user_id });
      toast.success("Cancelled");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const remove = async (user_id) => {
    try {
      await api.post("/friends/remove", { user_id });
      toast.success("Removed");
      load();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    }
  };

  const tabBtn = (id, label, count) => (
    <button
      onClick={() => setTab(id)}
      data-testid={`friends-tab-${id}`}
      className={`px-4 py-2 font-mono tracking-[0.2em] uppercase text-xs border ${
        tab === id ? "border-[#E5A93C] text-[#E5A93C] bg-[#E5A93C]/10" : "border-white/10 text-[#99958E] hover:text-[#F7F7F2]"
      }`}
    >
      {label} <span className="ml-2 text-[#E5A93C]">{count}</span>
    </button>
  );

  return (
    <div>
      <Navbar />
      <main className="max-w-[1000px] mx-auto px-6 md:px-10 py-10">
        <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#E5A93C] mb-3">Your Crew</div>
        <h1 className="font-head text-4xl sm:text-5xl uppercase mb-8">Friends</h1>

        <form onSubmit={doSearch} className="flex gap-2 mb-8">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99958E]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Paste a unique ID e.g. CinemaSync_Name_DDMMYYYY"
              data-testid="friends-search-input"
              className="w-full bg-[#141211] border border-white/10 focus:border-[#E5A93C] pl-10 pr-4 py-3 font-mono text-xs tracking-widest"
            />
          </div>
          <button
            disabled={searchLoading}
            data-testid="friends-search-button"
            className="bg-[#E5A93C] text-[#0A0908] font-mono tracking-[0.2em] uppercase text-xs px-6 py-3 hover:bg-[#F0B955] disabled:opacity-60"
          >
            {searchLoading ? "…" : "Search"}
          </button>
        </form>

        {foundUser && (
          <div className="mb-8" data-testid="friends-search-result">
            <Row
              u={foundUser}
              actions={
                <button
                  onClick={() => sendRequest(foundUser.unique_id)}
                  data-testid="friends-send-request-button"
                  className="flex items-center gap-2 border border-[#E5A93C] text-[#E5A93C] px-3 py-2 text-xs font-mono tracking-widest uppercase hover:bg-[#E5A93C]/10"
                >
                  <UserPlus size={13} /> Add
                </button>
              }
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-5">
          {tabBtn("friends", "Regulars", friends.length)}
          {tabBtn("in", "Incoming", requestsIn.length)}
          {tabBtn("out", "Sent", requestsOut.length)}
        </div>

        <div className="space-y-3">
          {tab === "friends" &&
            (friends.length === 0 ? (
              <div className="font-mono text-xs tracking-widest text-[#99958E] uppercase">Empty row. Add someone.</div>
            ) : friends.map((f) => (
              <Row
                key={f.id}
                u={f}
                actions={
                  <button
                    onClick={() => remove(f.id)}
                    data-testid={`friends-remove-${f.id}`}
                    className="flex items-center gap-2 border border-white/20 text-[#F7F7F2] px-3 py-2 text-xs font-mono tracking-widest uppercase hover:border-[#FF3B00] hover:text-[#FF3B00]"
                  >
                    <UserMinus size={13} /> Remove
                  </button>
                }
              />
            )))}

          {tab === "in" &&
            (requestsIn.length === 0 ? (
              <div className="font-mono text-xs tracking-widest text-[#99958E] uppercase">No incoming requests.</div>
            ) : requestsIn.map((f) => (
              <Row
                key={f.id}
                u={f}
                actions={
                  <>
                    <button
                      onClick={() => accept(f.id)}
                      data-testid={`friends-accept-${f.id}`}
                      className="flex items-center gap-2 border border-[#E5A93C] text-[#E5A93C] px-3 py-2 text-xs font-mono tracking-widest uppercase hover:bg-[#E5A93C]/10"
                    >
                      <Check size={13} /> Accept
                    </button>
                    <button
                      onClick={() => reject(f.id)}
                      data-testid={`friends-reject-${f.id}`}
                      className="flex items-center gap-2 border border-white/20 text-[#F7F7F2] px-3 py-2 text-xs font-mono tracking-widest uppercase hover:border-[#FF3B00] hover:text-[#FF3B00]"
                    >
                      <X size={13} /> Reject
                    </button>
                  </>
                }
              />
            )))}

          {tab === "out" &&
            (requestsOut.length === 0 ? (
              <div className="font-mono text-xs tracking-widest text-[#99958E] uppercase">Nothing in the mail.</div>
            ) : requestsOut.map((f) => (
              <Row
                key={f.id}
                u={f}
                actions={
                  <button
                    onClick={() => cancel(f.id)}
                    data-testid={`friends-cancel-${f.id}`}
                    className="flex items-center gap-2 border border-white/20 text-[#F7F7F2] px-3 py-2 text-xs font-mono tracking-widest uppercase hover:border-[#FF3B00] hover:text-[#FF3B00]"
                  >
                    <X size={13} /> Cancel
                  </button>
                }
              />
            )))}
        </div>
      </main>
    </div>
  );
}
