import React, { useRef, useState } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import UniqueIdBadge from "../components/UniqueIdBadge";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Mail, MailCheck, Trash2, ShieldAlert, ExternalLink } from "lucide-react";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export default function Profile() {
  const { user, refresh, formatApiError } = useAuth();
  const [name, setName] = useState(user.name || "");
  const [img, setImg] = useState(user.profile_image || "");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [verifyLink, setVerifyLink] = useState("");
  const [showDelete, setShowDelete] = useState(false);
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

  const sendVerify = async () => {
    try {
      const { data } = await api.post("/auth/send-verify-email");
      if (data.already_verified) return toast.success("Email already verified");
      if (data.delivered) return toast.success(data.message || "Verification email sent — check your inbox");
      // Sandbox / email-provider fallback — surface the link directly
      setVerifyLink(data.fallback_link || "");
      toast.info(data.message || "Email delivery unavailable — use the link shown below");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
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
            {user.email_verified ? (
              <div
                data-testid="profile-email-verified"
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono tracking-[0.25em] uppercase text-emerald-700 bg-emerald-100/70 border border-emerald-300/60 px-2 py-1 rounded-full"
              >
                <MailCheck size={11} /> Verified
              </div>
            ) : (
              <button
                type="button"
                onClick={sendVerify}
                data-testid="profile-send-verify-button"
                className="mt-2 inline-flex items-center gap-1 text-[10px] font-mono tracking-[0.25em] uppercase text-[#f72585] bg-[#f72585]/10 border border-[#f72585]/30 px-2 py-1 rounded-full hover:bg-[#f72585]/20"
              >
                <Mail size={11} /> Verify email
              </button>
            )}
            {verifyLink && !user.email_verified && (
              <div className="mt-3 w-full text-center" data-testid="profile-verify-fallback">
                <p className="text-[10px] font-mono tracking-widest uppercase text-[#6b5b84] mb-1">
                  Click to verify now
                </p>
                <a
                  href={verifyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-mono tracking-widest uppercase text-[#7209b7] underline break-all px-2"
                >
                  <ExternalLink size={10} /> Open verification link
                </a>
              </div>
            )}
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
      {!user.is_admin && <DeleteAccountSection />}
    </AppShell>
  );
}

function DeleteAccountSection() {
  const { logout, formatApiError } = useAuth();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const canSubmit = pw.length > 0 && confirmText.trim() === "DELETE MY ACCOUNT";

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await api.delete("/account", { data: { password: pw, confirm: confirmText.trim() } });
      toast.success("Account permanently deleted");
      try { await logout(); } catch {}
      // Force a hard redirect so all in-memory state is cleared
      window.location.href = "/";
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
      setLoading(false);
    }
  };

  return (
    <section className="max-w-[1000px] mt-8" data-testid="danger-zone">
      <div className="border border-[#f72585]/40 bg-[#fff5f9] rounded-md p-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert size={16} className="text-[#f72585]" />
          <span className="font-mono text-xs tracking-[0.3em] uppercase text-[#f72585]">Danger zone</span>
        </div>
        <h2 className="font-head text-2xl uppercase mb-2">Permanently delete account</h2>
        <p className="text-sm text-[#6b5b84] mb-4">
          Removes your profile, friends, rooms, chats, notifications, uploaded photos and watch history from our servers.
          This action is irreversible.
        </p>
        <p className="text-[11px] font-mono tracking-widest uppercase text-[#6b5b84] mb-4">
          Heads up · Inactive accounts are also auto-deleted after <strong>30 days</strong> of not logging in.
        </p>

        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid="delete-account-open-button"
            className="inline-flex items-center gap-2 border-2 border-[#f72585] text-[#f72585] font-mono tracking-[0.25em] uppercase text-xs px-4 py-3 rounded-md hover:bg-[#f72585] hover:text-white"
          >
            <Trash2 size={14} /> Delete my account
          </button>
        ) : (
          <form onSubmit={submit} className="space-y-3" data-testid="delete-account-form">
            <div>
              <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] block mb-1">
                Confirm your password
              </label>
              <input
                type="password"
                required
                autoFocus
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                data-testid="delete-account-password"
                className="w-full bg-white border border-[#f72585]/40 focus:border-[#f72585] px-3 py-2 rounded-md font-body"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#6b5b84] block mb-1">
                Type <span className="text-[#f72585] font-semibold">DELETE MY ACCOUNT</span> to proceed
              </label>
              <input
                type="text"
                required
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                data-testid="delete-account-confirm"
                placeholder="DELETE MY ACCOUNT"
                className="w-full bg-white border border-[#f72585]/40 focus:border-[#f72585] px-3 py-2 rounded-md font-mono uppercase tracking-widest text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!canSubmit || loading}
                data-testid="delete-account-submit"
                className="flex-1 min-w-[160px] bg-[#f72585] text-white font-mono tracking-[0.25em] uppercase text-xs px-4 py-3 rounded-md hover:bg-[#d80d6f] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Trash2 size={13} /> {loading ? "Deleting…" : "Delete forever"}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setPw(""); setConfirmText(""); }}
                disabled={loading}
                data-testid="delete-account-cancel"
                className="flex-1 min-w-[160px] border border-[#7209b7]/40 text-[#7209b7] font-mono tracking-[0.25em] uppercase text-xs px-4 py-3 rounded-md hover:bg-[#7209b7]/10 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
