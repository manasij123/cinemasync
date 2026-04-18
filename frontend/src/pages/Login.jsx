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
      const redirect = localStorage.getItem("cs_post_login_redirect");
      if (redirect) {
        localStorage.removeItem("cs_post_login_redirect");
        navigate(redirect);
      } else {
        navigate("/dashboard");
      }
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
          <div className="border border-[#7209b7]/30 bg-white p-8">
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#7209b7] mb-2">Act I · Entry</div>
            <h1 className="font-head text-4xl uppercase mb-8">Back to the balcony</h1>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] block mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="login-email-input"
                  className="w-full bg-[#fdf4ff] border border-[#7209b7]/30 focus:border-[#7209b7] px-4 py-3 text-[#1a0b2e] font-body"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] block mb-2">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="login-password-input"
                  className="w-full bg-[#fdf4ff] border border-[#7209b7]/30 focus:border-[#7209b7] px-4 py-3 text-[#1a0b2e] font-body"
                />
              </div>
              {err && <div data-testid="login-error" className="text-[#f72585] font-mono text-xs">{err}</div>}
              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-button"
                className="w-full bg-[#7209b7] text-[#1a0b2e] font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#4a0580] disabled:opacity-60 transition-all"
              >
                {loading ? "Dimming lights…" : "Enter theatre"}
              </button>
            </form>
            <div className="mt-6 text-center font-mono text-xs tracking-widest text-[#6b5b84]">
              New here?{" "}
              <Link to="/register" className="text-[#7209b7] hover:text-[#4a0580]" data-testid="login-to-register-link">
                Book a seat
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
