import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, User, Bell, Radio, LogOut, Menu, X, Film, ShieldCheck,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "side-dashboard" },
  { to: "/friends", label: "Friends", icon: Users, testid: "side-friends" },
  { to: "/profile", label: "Profile", icon: User, testid: "side-profile" },
];

const ADMIN_NAV = { to: "/admin", label: "Admin", icon: ShieldCheck, testid: "side-admin" };

function SideBody({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link to="/dashboard" onClick={onNavigate} data-testid="sidebar-logo" className="flex items-center gap-3 px-5 py-5 border-b border-[#7209b7]/30">
        <div className="w-11 h-11 overflow-hidden rounded-md bg-white border border-[#7209b7]/30 shrink-0 flex items-center justify-center p-1">
          <img src="/cinemasync-logo.svg" alt="CinemaSync" className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-head text-xl tracking-wider uppercase">CinemaSync</span>
          <span className="font-mono text-[9px] tracking-[0.3em] text-[#6b5b84] uppercase">Watch · Party · Sync</span>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {[...NAV, ...(user?.is_admin ? [ADMIN_NAV] : [])].map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              data-testid={item.testid}
              className={`flex items-center gap-3 px-4 py-3 font-mono text-xs tracking-[0.2em] uppercase transition-all ${
                active
                  ? "bg-[#7209b7] text-white"
                  : "text-[#6b5b84] hover:bg-[#7209b7]/10 hover:text-[#1a0b2e]"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.to === "/admin" && <span className="ml-auto text-[10px]">★</span>}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t border-[#7209b7]/30 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#7209b7]/20 border border-[#7209b7]/30 flex items-center justify-center font-head overflow-hidden shrink-0">
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              user?.name?.[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-body text-sm truncate text-[#1a0b2e]">{user?.name}</div>
            <div className="font-mono text-[9px] text-[#6b5b84] truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={async () => { await logout(); navigate("/"); if (onNavigate) onNavigate(); }}
          data-testid="sidebar-logout"
          className="w-full flex items-center justify-center gap-2 border border-[#7209b7]/45 text-[#1a0b2e] font-mono tracking-[0.2em] uppercase text-[10px] px-3 py-2 hover:border-[#f72585] hover:text-[#f72585]"
        >
          <LogOut size={12} /> Logout
        </button>
      </div>
    </div>
  );
}

export default function AppShell({ children, title, subtitle, actions }) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-[#fdf4ff] flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-[#7209b7]/30 bg-white flex-col sticky top-0 h-screen">
        <SideBody />
      </aside>

      {/* Mobile sidebar drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white border-r border-[#7209b7]/30 shadow-2xl">
            <SideBody onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-[#7209b7]/25 bg-[#ffffff]/85 backdrop-blur-md">
          <div className="flex items-center gap-4 h-16 px-4 md:px-8">
            <button
              onClick={() => setOpen(true)}
              data-testid="sidebar-open-button"
              className="md:hidden p-2 border border-[#7209b7]/40 text-[#1a0b2e]"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0 flex-1">
              {subtitle && (
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#7209b7] truncate">{subtitle}</div>
              )}
              {title && (
                <h1 className="font-head text-xl md:text-2xl uppercase truncate">{title}</h1>
              )}
            </div>
            <div className="flex items-center gap-2">
              {actions}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 lg:p-10">{children}</main>
      </div>
    </div>
  );
}
