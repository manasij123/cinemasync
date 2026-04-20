import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Lock, Check } from "lucide-react";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (pw.length < 6) return toast.error("Password must be at least 6 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    if (!token) return toast.error("Missing reset token — open the link from your email");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: pw });
      setDone(true);
      toast.success("Password updated. Log in with your new password.");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      toast.error(typeof msg === "string" ? msg : "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="border border-white/10 bg-[#2a2a2a] p-8">
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#6a14ff] mb-2">Act I · New Key</div>
            <h1 className="font-head text-3xl uppercase mb-6">Reset password</h1>

            {done ? (
              <div data-testid="reset-done" className="border border-[#6a14ff]/30 bg-[#2a2a2a] p-5 text-center">
                <Check className="mx-auto text-[#6a14ff] mb-2" size={28} />
                <div className="font-head text-xl uppercase mb-1">Password updated</div>
                <p className="text-sm text-[#cccccc]">Redirecting you to login…</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {!token && (
                  <div className="text-[#ffd100] text-xs font-mono tracking-widest uppercase">
                    No reset token in URL. Please open the link from your email.
                  </div>
                )}
                <div>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc] block mb-2">New password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    data-testid="reset-password-input"
                    className="w-full bg-[#2a2a2a] border border-[#6a14ff]/30 focus:border-[#ffd100] px-4 py-3 text-[#ffffff] font-body"
                  />
                </div>
                <div>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc] block mb-2">Confirm password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    data-testid="reset-password-confirm-input"
                    className="w-full bg-[#2a2a2a] border border-[#6a14ff]/30 focus:border-[#ffd100] px-4 py-3 text-[#ffffff] font-body"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !token}
                  data-testid="reset-submit-button"
                  className="w-full bg-[#ffd100] text-black font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:shadow-[0_10px_26px_rgba(255,209,0,0.35)] disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Lock size={14} /> {loading ? "Updating…" : "Update password"}
                </button>
                <div className="text-center font-mono text-xs tracking-widest text-[#cccccc]">
                  <Link to="/login" className="text-[#6a14ff] hover:text-[#5a0fd6]" data-testid="reset-to-login-link">
                    Back to login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
