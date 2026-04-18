import React, { useRef, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import UniqueIdBadge from "../components/UniqueIdBadge";
import { api } from "../lib/api";
import { toast } from "sonner";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export default function Profile() {
  const { user, refresh, formatApiError } = useAuth();
  const [name, setName] = useState(user.name || "");
  const [img, setImg] = useState(user.profile_image || "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow same-file re-select
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast.error("Image must be under 10MB");
      return;
    }
    const form = new FormData();
    form.append("file", f);
    setUploading(true);
    setProgress(0);
    try {
      const { data } = await api.post("/profile/picture", form, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });
      setImg(data.url);
      await refresh();
      const mb = (data.size / (1024 * 1024)).toFixed(2);
      toast.success(`Profile picture updated (${mb} MB)`);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch("/profile", { name });
      await refresh();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell subtitle="Your Ticket Stub" title="Profile">
      <div className="max-w-[1000px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 border border-[#7209b7]/30 bg-white p-6 flex flex-col items-center text-center">
            <div className="relative w-32 h-32 bg-[#fdf4ff] border border-[#7209b7]/30 overflow-hidden mb-4 flex items-center justify-center rounded-md">
              {img ? (
                <img src={img} alt="avatar" className="w-full h-full object-cover" data-testid="profile-avatar-image" />
              ) : (
                <span className="font-head text-6xl text-[#7209b7]">{user.name?.[0]?.toUpperCase()}</span>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                  <div className="font-mono text-[10px] tracking-widest uppercase text-white mb-1">Uploading</div>
                  <div className="font-head text-2xl text-white">{progress}%</div>
                </div>
              )}
            </div>
            <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7209b7] cursor-pointer hover:text-[#4a0580]">
              {uploading ? "Uploading…" : img ? "Change frame" : "Upload frame"}
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={onFile}
                disabled={uploading}
                data-testid="profile-upload-input"
              />
            </label>
            <p className="font-mono text-[9px] tracking-widest uppercase text-[#a597c4] mt-2">Max 10 MB · JPG / PNG / WEBP</p>
            <div className="mt-6 w-full">
              <UniqueIdBadge value={user.unique_id} testid="profile-unique-id" multiline />
            </div>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] mt-3">{user.email}</div>
          </div>

          <form onSubmit={save} className="md:col-span-2 border border-[#7209b7]/30 bg-white p-6 space-y-4">
            <div>
              <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] block mb-2">Display name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="profile-name-input"
                className="w-full bg-[#fdf4ff] border border-[#7209b7]/30 focus:border-[#7209b7] px-4 py-3 font-body"
              />
              <p className="font-mono text-[10px] tracking-widest uppercase text-[#a597c4] mt-2">
                Changing your name will regenerate your unique ID.
              </p>
            </div>
            <button
              disabled={loading}
              type="submit"
              data-testid="profile-save-button"
              className="bg-[#7209b7] text-white font-mono tracking-[0.25em] uppercase text-sm px-6 py-4 hover:bg-[#4a0580] disabled:opacity-60"
            >
              {loading ? "Developing film…" : "Save changes"}
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
