import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, formatApiError } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success("Your ticket has been printed");
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
          <div className="border border-[#d4a373]/30 bg-[#faedcd] p-8">
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#d4a373] mb-2">Prologue</div>
            <h1 className="font-head text-4xl uppercase mb-2">Claim your seat</h1>
            <p className="font-mono text-xs tracking-widest text-[#7a6a55] mb-8 uppercase">Free forever · No card · No popcorn yet</p>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55] block mb-2">Display name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="register-name-input"
                  className="w-full bg-[#fefae0] border border-[#d4a373]/30 focus:border-[#d4a373] px-4 py-3 text-[#2b2118] font-body"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55] block mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="register-email-input"
                  className="w-full bg-[#fefae0] border border-[#d4a373]/30 focus:border-[#d4a373] px-4 py-3 text-[#2b2118] font-body"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55] block mb-2">Password · min 6</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="register-password-input"
                  className="w-full bg-[#fefae0] border border-[#d4a373]/30 focus:border-[#d4a373] px-4 py-3 text-[#2b2118] font-body"
                />
              </div>
              {err && <div data-testid="register-error" className="text-[#a04a2f] font-mono text-xs">{err}</div>}
              <button
                type="submit"
                disabled={loading}
                data-testid="register-submit-button"
                className="w-full bg-[#d4a373] text-[#2b2118] font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#c08456] disabled:opacity-60 transition-all"
              >
                {loading ? "Printing ticket…" : "Roll the credits"}
              </button>
            </form>
            <div className="mt-6 text-center font-mono text-xs tracking-widest text-[#7a6a55]">
              Already a regular?{" "}
              <Link to="/login" className="text-[#d4a373] hover:text-[#c08456]" data-testid="register-to-login-link">
                Walk right in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
