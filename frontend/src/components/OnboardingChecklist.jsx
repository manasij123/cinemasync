import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ArrowRight, X, Sparkles } from "lucide-react";

/**
 * Derives a 5-step checklist from the current user + their friends/history
 * and renders a dismissible welcome card. Client-side only (localStorage for dismiss).
 */
export default function OnboardingChecklist({ user, friendCount, roomCount, hasInvited }) {
  const storageKey = `cinemasync.onboarding.dismissed.${user?.id}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return !!localStorage.getItem(storageKey); } catch { return false; }
  });

  const steps = useMemo(() => [
    {
      id: "photo",
      label: "Upload a profile frame",
      done: !!user?.profile_image,
      href: "/profile",
      cta: "Upload",
    },
    {
      id: "verify",
      label: "Verify your email",
      done: !!user?.email_verified,
      href: "/profile",
      cta: "Verify",
    },
    {
      id: "friend",
      label: "Add your first friend",
      done: (friendCount || 0) > 0,
      href: "/friends",
      cta: "Find friends",
    },
    {
      id: "room",
      label: "Host your first room",
      done: (roomCount || 0) > 0,
      href: "#create-room",
      cta: "Create room",
    },
    {
      id: "invite",
      label: "Send an invite",
      done: !!hasInvited,
      href: "#create-room",
      cta: "Invite",
    },
  ], [user, friendCount, roomCount, hasInvited]);

  const completedCount = steps.filter((s) => s.done).length;
  const total = steps.length;
  const percent = Math.round((completedCount / total) * 100);
  const allDone = completedCount === total;

  if (dismissed || allDone) return null;

  const hide = () => {
    try { localStorage.setItem(storageKey, "1"); } catch {}
    setDismissed(true);
  };

  return (
    <section
      data-testid="onboarding-checklist"
      className="mb-6 rounded-xl p-5 md:p-6 bg-gradient-to-br from-[#fdf4ff] via-white to-[#fce4ff] border border-[#7209b7]/30 shadow-[0_10px_30px_rgba(114,9,183,0.08)] relative overflow-hidden"
    >
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#f72585]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-[#7209b7]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3 mb-4 relative">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-[#f72585]" />
            <span className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#f72585]">Welcome to CinemaSync</span>
          </div>
          <h3 className="font-head text-2xl md:text-3xl uppercase leading-none">Your first 5 scenes</h3>
          <p className="text-sm text-[#6b5b84] mt-2">Finish the checklist — each step unlocks a better watch party.</p>
        </div>
        <button
          onClick={hide}
          data-testid="onboarding-dismiss"
          title="Dismiss"
          className="p-1 text-[#6b5b84] hover:text-[#1a0b2e]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="relative mb-4">
        <div className="h-2 bg-[#7209b7]/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#7209b7] to-[#f72585] transition-all"
            style={{ width: `${percent}%` }}
            data-testid="onboarding-progress"
          />
        </div>
        <div className="font-mono text-[10px] tracking-widest uppercase text-[#6b5b84] mt-1.5">
          {completedCount} / {total} complete · {percent}%
        </div>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 relative">
        {steps.map((s) => (
          <li key={s.id} data-testid={`onboarding-step-${s.id}`}>
            {s.done ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#7209b7]/5 border border-[#7209b7]/20 text-[#7209b7]">
                <span className="w-6 h-6 rounded-full bg-[#7209b7] text-white flex items-center justify-center shrink-0">
                  <Check size={13} />
                </span>
                <span className="font-mono text-[11px] tracking-widest uppercase">{s.label}</span>
              </div>
            ) : s.href.startsWith("#") ? (
              <a
                href={s.href}
                className="flex items-center gap-2 p-3 rounded-lg bg-white border border-[#e7c6ff] hover:border-[#7209b7]/60 hover:-translate-y-0.5 transition-all group"
              >
                <span className="w-6 h-6 rounded-full border-2 border-dashed border-[#7209b7]/40 shrink-0" />
                <span className="flex-1 text-sm text-[#1a0b2e] truncate">{s.label}</span>
                <span className="font-mono text-[10px] tracking-widest uppercase text-[#7209b7] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  {s.cta} <ArrowRight size={11} />
                </span>
              </a>
            ) : (
              <Link
                to={s.href}
                className="flex items-center gap-2 p-3 rounded-lg bg-white border border-[#e7c6ff] hover:border-[#7209b7]/60 hover:-translate-y-0.5 transition-all group"
              >
                <span className="w-6 h-6 rounded-full border-2 border-dashed border-[#7209b7]/40 shrink-0" />
                <span className="flex-1 text-sm text-[#1a0b2e] truncate">{s.label}</span>
                <span className="font-mono text-[10px] tracking-widest uppercase text-[#7209b7] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  {s.cta} <ArrowRight size={11} />
                </span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
