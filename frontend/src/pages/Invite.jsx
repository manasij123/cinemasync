import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { TicketCheck } from "lucide-react";

export default function Invite() {
  const { roomId } = useParams();
  const [search] = useSearchParams();
  const password = search.get("p") || "";
  const { user, loading, formatApiError } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("init"); // init | joining | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      // Stash target and redirect to login
      localStorage.setItem("cs_post_login_redirect", `/invite/${roomId}?p=${encodeURIComponent(password)}`);
      navigate("/login");
      return;
    }
    (async () => {
      setStatus("joining");
      try {
        await api.post("/rooms/join", { room_id: roomId, password });
        toast.success("Joined — heading to the theatre");
        navigate(`/room/${roomId.toUpperCase()}`, { replace: true });
      } catch (e) {
        setError(formatApiError(e.response?.data?.detail) || e.message);
        setStatus("error");
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  return (
    <div>
      <Navbar />
      <main className="max-w-md mx-auto px-6 py-16 text-center" data-testid="invite-page">
        <TicketCheck size={48} className="text-[#7209b7] mx-auto mb-4" />
        <h1 className="font-head text-3xl uppercase mb-3">Your seat is reserved</h1>
        {status === "joining" && (
          <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#6b5b84]">Unrolling the carpet…</div>
        )}
        {status === "error" && (
          <>
            <div className="font-mono text-xs tracking-widest text-[#f72585] mb-4" data-testid="invite-error">{error}</div>
            <button
              onClick={() => navigate("/dashboard")}
              className="bg-[#7209b7] text-[#1a0b2e] font-mono tracking-[0.25em] uppercase text-sm px-6 py-3 hover:bg-[#4a0580]"
            >
              Back to dashboard
            </button>
          </>
        )}
      </main>
    </div>
  );
}
