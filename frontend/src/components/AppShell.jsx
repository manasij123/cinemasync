import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, User, Bell, Radio, LogOut, Menu, X, Film,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "side-dashboard" },
  { to: "/friends", label: "Friends", icon: Users, testid: "side-friends" },
  { to: "/profile", label: "Profile", icon: User, testid: "side-profile" },
];

function SideBody({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <Link to="/dashboard" onClick={onNavigate} data-testid="sidebar-logo" className="flex items-center gap-3 px-5 py-5 border-b border-[#d4a373]/30">
        <div className="w-10 h-10 overflow-hidden border border-[#d4a373]/40 bg-[#fefae0] shrink-0">
          <img src="/logo.jpg" alt="CinemaSync" className="w-full h-full object-cover" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-head text-xl tracking-wider uppercase">CinemaSync</span>
          <span className="font-mono text-[9px] tracking-[0.3em] text-[#7a6a55] uppercase">Watch · Party · Sync</span>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 py-6 px-3 space-y-1">
        {NAV.map((item) => {
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
                  ? "bg-[#d4a373] text-[#2b2118]"
                  : "text-[#7a6a55] hover:bg-[#d4a373]/10 hover:text-[#2b2118]"
              }`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t border-[#d4a373]/30 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#d4a373]/20 border border-[#d4a373]/30 flex items-center justify-center font-head overflow-hidden shrink-0">
            {user?.profile_image ? (
              <img src={user.profile_image} alt="" className="w-full h-full object-cover" />
            ) : (
              user?.name?.[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-body text-sm truncate text-[#2b2118]">{user?.name}</div>
            <div className="font-mono text-[9px] text-[#7a6a55] truncate">{user?.email}</div>
          </div>
        </div>
        <button
          onClick={async () => { await logout(); navigate("/"); if (onNavigate) onNavigate(); }}
          data-testid="sidebar-logout"
          className="w-full flex items-center justify-center gap-2 border border-[#d4a373]/45 text-[#2b2118] font-mono tracking-[0.2em] uppercase text-[10px] px-3 py-2 hover:border-[#a04a2f] hover:text-[#a04a2f]"
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
    <div className="min-h-screen bg-[#fefae0] flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-[#d4a373]/30 bg-[#faedcd] flex-col sticky top-0 h-screen">
        <SideBody />
      </aside>

      {/* Mobile sidebar drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-[#faedcd] border-r border-[#d4a373]/30 shadow-2xl">
            <SideBody onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-[#d4a373]/25 bg-[#fefae0]/85 backdrop-blur-md">
          <div className="flex items-center gap-4 h-16 px-4 md:px-8">
            <button
              onClick={() => setOpen(true)}
              data-testid="sidebar-open-button"
              className="md:hidden p-2 border border-[#d4a373]/40 text-[#2b2118]"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0 flex-1">
              {subtitle && (
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#d4a373] truncate">{subtitle}</div>
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
