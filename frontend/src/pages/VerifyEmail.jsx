import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Check, XCircle, Mail } from "lucide-react";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [status, setStatus] = useState(token ? "loading" : "no-token");
  const [error, setError] = useState("");
  const { refresh } = useAuth();

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        await api.post("/auth/verify-email", { token });
        setStatus("ok");
        try { await refresh(); } catch {}
      } catch (err) {
        setStatus("error");
        setError(err.response?.data?.detail || err.message || "Verification failed");
      }
    })();
  }, [token, refresh]);

  return (
    <div>
      <Navbar />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="border border-[#7209b7]/30 bg-white p-8 text-center">
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#7209b7] mb-2">Act I · Confirmation</div>
            <h1 className="font-head text-3xl uppercase mb-6">Verify email</h1>

            {status === "loading" && (
              <div data-testid="verify-loading" className="font-mono text-xs tracking-widest uppercase text-[#6b5b84]">Confirming…</div>
            )}
            {status === "no-token" && (
              <div data-testid="verify-no-token" className="text-[#6b5b84]">
                <Mail className="mx-auto text-[#7209b7] mb-2" size={28} />
                <p>Open the verification link from your email to continue.</p>
              </div>
            )}
            {status === "ok" && (
              <div data-testid="verify-ok">
                <Check className="mx-auto text-[#7209b7] mb-2" size={32} />
                <div className="font-head text-xl uppercase mb-2">Email confirmed</div>
                <p className="text-sm text-[#6b5b84] mb-4">Your CinemaSync account is fully activated.</p>
                <Link to="/dashboard" className="inline-block bg-[#7209b7] text-white font-mono tracking-[0.25em] uppercase text-xs px-6 py-3 hover:bg-[#4a0580]" data-testid="verify-to-dashboard">
                  Enter the theatre
                </Link>
              </div>
            )}
            {status === "error" && (
              <div data-testid="verify-error">
                <XCircle className="mx-auto text-[#f72585] mb-2" size={32} />
                <div className="font-head text-xl uppercase mb-2">Couldn't verify</div>
                <p className="text-sm text-[#6b5b84] mb-4">{error}</p>
                <Link to="/profile" className="inline-block border-2 border-[#7209b7] text-[#7209b7] font-mono tracking-[0.25em] uppercase text-xs px-6 py-3 hover:bg-[#7209b7] hover:text-white" data-testid="verify-resend-from-profile">
                  Send new link from Profile
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
