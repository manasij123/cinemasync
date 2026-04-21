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
      <Link to="/dashboard" onClick={onNavigate} data-testid="sidebar-logo" className="flex items-center gap-3 px-5 py-5 border-b border-[#6a14ff]/30">
        <div className="w-14 h-14 shrink-0 rounded-md bg-white border border-[#6a14ff]/30 overflow-hidden flex items-center justify-center">
          <img src="/cinemasync-logo.svg" alt="CinemaSync" className="w-[92%] h-[92%] object-contain" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-head text-xl tracking-wider uppercase">CinemaSync</span>
          <span className="font-mono text-[9px] tracking-[0.3em] text-[#cccccc] uppercase">Watch · Party · Sync</span>
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
                  ? "bg-[#ffd100] text-black"
                  : "text-[#cccccc] hover:bg-[#6a14ff]/15 hover:text-[#ffffff]"
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
      <div className="border-t border-[#6a14ff]/30 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#6a14ff]/20 border border-[#6a14ff]/30 flex items-center justify-center font-head overflow-hidden shrink-0">
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              user?.name?.[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-body text-sm truncate text-[#ffffff]">{user?.name}</div>
            <div className="font-mono text-[9px] text-[#cccccc] truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={async () => { await logout(); navigate("/"); if (onNavigate) onNavigate(); }}
          data-testid="sidebar-logout"
          className="w-full flex items-center justify-center gap-2 border border-[#6a14ff]/45 text-[#ffffff] font-mono tracking-[0.2em] uppercase text-[10px] px-3 py-2 hover:border-[#ffd100] hover:text-[#ffd100]"
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
    <div className="min-h-screen bg-[#202020] flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-white/10 bg-[#1a1a1a] flex-col sticky top-0 h-screen">
        <SideBody />
      </aside>

      {/* Mobile sidebar drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-[#1a1a1a] border-r border-white/10 shadow-2xl">
            <SideBody onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-[#202020]/85 backdrop-blur-md">
          <div className="flex items-center gap-4 h-16 px-4 md:px-8">
            <button
              onClick={() => setOpen(true)}
              data-testid="sidebar-open-button"
              className="md:hidden p-2 border border-white/20 text-white"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0 flex-1">
              {subtitle && (
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#ffd100] truncate">{subtitle}</div>
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

        <main className="flex-1 min-w-0 max-w-full p-4 md:p-8 lg:p-10 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
