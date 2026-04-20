import React, { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
      toast.success("If the email exists, a reset link is on its way");
    } catch (err) {
      const msg = err.response?.data?.detail || err.message;
      toast.error(typeof msg === "string" ? msg : "Request failed");
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
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#6a14ff] mb-2">Act I · Recovery</div>
            <h1 className="font-head text-3xl uppercase mb-2">Forgot password?</h1>
            <p className="text-[#cccccc] text-sm mb-6">
              We'll email a reset link that expires in 30 minutes. Links only arrive if the address is registered.
            </p>

            {sent ? (
              <div data-testid="forgot-sent" className="border border-[#6a14ff]/30 bg-[#2a2a2a] p-5 text-center">
                <Mail className="mx-auto text-[#6a14ff] mb-2" size={28} />
                <div className="font-head text-xl uppercase mb-1">Check your inbox</div>
                <p className="text-sm text-[#cccccc]">
                  If <span className="text-[#ffffff] font-semibold">{email}</span> is registered, a reset link is on its way.
                </p>
                <Link to="/login" data-testid="forgot-back-login" className="inline-block mt-4 font-mono text-xs tracking-widest uppercase text-[#6a14ff] hover:text-[#5a0fd6]">
                  ← Back to login
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc] block mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="forgot-email-input"
                    className="w-full bg-[#2a2a2a] border border-[#6a14ff]/30 focus:border-[#ffd100] px-4 py-3 text-[#ffffff] font-body"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  data-testid="forgot-submit-button"
                  className="w-full bg-[#ffd100] text-black font-mono font-semibold tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#e8bd00] disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
                <div className="text-center font-mono text-xs tracking-widest text-[#cccccc]">
                  Remembered it?{" "}
                  <Link to="/login" className="text-[#6a14ff] hover:text-[#5a0fd6]" data-testid="forgot-to-login-link">
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
