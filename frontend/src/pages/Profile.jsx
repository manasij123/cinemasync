import React, { useState } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import UniqueIdBadge from "../components/UniqueIdBadge";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function Profile() {
  const { user, refresh, formatApiError } = useAuth();
  const [name, setName] = useState(user.name || "");
  const [img, setImg] = useState(user.profile_image || "");
  const [loading, setLoading] = useState(false);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 800 * 1024) {
      toast.error("Image must be under 800KB");
      return;
    }
    const r = new FileReader();
    r.onload = () => setImg(r.result);
    r.readAsDataURL(f);
  };

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch("/profile", { name, profile_image: img });
      await refresh();
      toast.success("Profile updated");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Navbar />
      <main className="max-w-[1000px] mx-auto px-6 md:px-10 py-10">
        <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#E5A93C] mb-3">Your Ticket Stub</div>
        <h1 className="font-head text-4xl sm:text-5xl uppercase mb-8">Profile</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 border border-white/10 bg-[#141211] p-6 flex flex-col items-center text-center">
            <div className="w-32 h-32 bg-[#0A0908] border border-white/10 overflow-hidden mb-4 flex items-center justify-center">
              {img ? (
                <img src={img} alt="avatar" className="w-full h-full object-cover" data-testid="profile-avatar-image" />
              ) : (
                <span className="font-head text-6xl text-[#E5A93C]">{user.name?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#E5A93C] cursor-pointer hover:text-[#F0B955]">
              Upload frame
              <input type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="profile-upload-input" />
            </label>
            <div className="mt-6">
              <UniqueIdBadge value={user.unique_id} testid="profile-unique-id" />
            </div>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#99958E] mt-3">{user.email}</div>
          </div>

          <form onSubmit={save} className="md:col-span-2 border border-white/10 bg-[#141211] p-6 space-y-4">
            <div>
              <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#99958E] block mb-2">Display name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="profile-name-input"
                className="w-full bg-[#0A0908] border border-white/10 focus:border-[#E5A93C] px-4 py-3 font-body"
              />
              <p className="font-mono text-[10px] tracking-widest uppercase text-[#5C5A56] mt-2">
                Changing your name will regenerate your unique ID.
              </p>
            </div>
            <button
              disabled={loading}
              type="submit"
              data-testid="profile-save-button"
              className="bg-[#E5A93C] text-[#0A0908] font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#F0B955] disabled:opacity-60"
            >
              {loading ? "Developing film…" : "Save changes"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
