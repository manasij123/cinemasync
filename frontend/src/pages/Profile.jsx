import React, { useState } from "react";
import AppShell from "../components/AppShell";
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
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10MB");
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
    <AppShell subtitle="Your Ticket Stub" title="Profile">
      <div className="max-w-[1000px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 border border-[#d4a373]/30 bg-[#faedcd] p-6 flex flex-col items-center text-center">
            <div className="w-32 h-32 bg-[#fefae0] border border-[#d4a373]/30 overflow-hidden mb-4 flex items-center justify-center">
              {img ? (
                <img src={img} alt="avatar" className="w-full h-full object-cover" data-testid="profile-avatar-image" />
              ) : (
                <span className="font-head text-6xl text-[#d4a373]">{user.name?.[0]?.toUpperCase()}</span>
              )}
            </div>
            <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#d4a373] cursor-pointer hover:text-[#c08456]">
              Upload frame
              <input type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="profile-upload-input" />
            </label>
            <div className="mt-6 w-full">
              <UniqueIdBadge value={user.unique_id} testid="profile-unique-id" multiline />
            </div>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55] mt-3">{user.email}</div>
          </div>

          <form onSubmit={save} className="md:col-span-2 border border-[#d4a373]/30 bg-[#faedcd] p-6 space-y-4">
            <div>
              <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7a6a55] block mb-2">Display name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="profile-name-input"
                className="w-full bg-[#fefae0] border border-[#d4a373]/30 focus:border-[#d4a373] px-4 py-3 font-body"
              />
              <p className="font-mono text-[10px] tracking-widest uppercase text-[#a89578] mt-2">
                Changing your name will regenerate your unique ID.
              </p>
            </div>
            <button
              disabled={loading}
              type="submit"
              data-testid="profile-save-button"
              className="bg-[#d4a373] text-[#2b2118] font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#c08456] disabled:opacity-60"
            >
              {loading ? "Developing film…" : "Save changes"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
