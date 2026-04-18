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
          <div className="border border-[#7209b7]/30 bg-white p-8">
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#7209b7] mb-2">Act I · Recovery</div>
            <h1 className="font-head text-3xl uppercase mb-2">Forgot password?</h1>
            <p className="text-[#6b5b84] text-sm mb-6">
              We'll email a reset link that expires in 30 minutes. Links only arrive if the address is registered.
            </p>

            {sent ? (
              <div data-testid="forgot-sent" className="border border-[#7209b7]/30 bg-[#fdf4ff] p-5 text-center">
                <Mail className="mx-auto text-[#7209b7] mb-2" size={28} />
                <div className="font-head text-xl uppercase mb-1">Check your inbox</div>
                <p className="text-sm text-[#6b5b84]">
                  If <span className="text-[#1a0b2e] font-semibold">{email}</span> is registered, a reset link is on its way.
                </p>
                <Link to="/login" data-testid="forgot-back-login" className="inline-block mt-4 font-mono text-xs tracking-widest uppercase text-[#7209b7] hover:text-[#4a0580]">
                  ← Back to login
                </Link>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] block mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="forgot-email-input"
                    className="w-full bg-[#fdf4ff] border border-[#7209b7]/30 focus:border-[#7209b7] px-4 py-3 text-[#1a0b2e] font-body"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  data-testid="forgot-submit-button"
                  className="w-full bg-[#7209b7] text-white font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#4a0580] disabled:opacity-60"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </button>
                <div className="text-center font-mono text-xs tracking-widest text-[#6b5b84]">
                  Remembered it?{" "}
                  <Link to="/login" className="text-[#7209b7] hover:text-[#4a0580]" data-testid="forgot-to-login-link">
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
