import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, formatApiError } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back to your row");
      navigate("/dashboard");
    } catch (e) {
      const msg = formatApiError(e.response?.data?.detail) || e.message;
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="border border-white/10 bg-[#141211] p-8">
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#E5A93C] mb-2">Act I · Entry</div>
            <h1 className="font-head text-4xl uppercase mb-8">Back to the balcony</h1>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#99958E] block mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  className="w-full bg-[#0A0908] border border-white/10 focus:border-[#E5A93C] px-4 py-3 text-[#F7F7F2] font-body"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#99958E] block mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  className="w-full bg-[#0A0908] border border-white/10 focus:border-[#E5A93C] px-4 py-3 text-[#F7F7F2] font-body"
                />
              </div>
              {err && <div data-testid="login-error" className="text-[#FF3B00] font-mono text-xs">{err}</div>}
              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-button"
                className="w-full bg-[#E5A93C] text-[#0A0908] font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#F0B955] disabled:opacity-60 transition-all"
              >
                {loading ? "Dimming lights…" : "Enter theatre"}
              </button>
            </form>
            <div className="mt-6 text-center font-mono text-xs tracking-widest text-[#99958E]">
              New here?{" "}
              <Link to="/register" className="text-[#E5A93C] hover:text-[#F0B955]" data-testid="login-to-register-link">
                Book a seat
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
