import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Film, User, LogOut, Users, LayoutDashboard } from "lucide-react";

const NavLink = ({ to, children, testid, mobileIcon }) => {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      data-testid={testid}
      className={`font-mono text-xs tracking-[0.2em] uppercase px-2 sm:px-3 py-2 transition-colors ${
        active ? "text-[#FACC15]" : "text-[#99958E] hover:text-[#F7F7F2]"
      }`}
    >
      <span className="hidden md:inline">{children}</span>
      <span className="md:hidden">{mobileIcon}</span>
    </Link>
  );
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/5 bg-[#0A0908]/85 backdrop-blur-xl"
      data-testid="top-navbar"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-10 h-16 flex items-center justify-between gap-2">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 sm:gap-3 group shrink-0" data-testid="logo-home-link">
          <div className="w-8 h-8 bg-[#FACC15] text-[#0A0908] flex items-center justify-center">
            <Film size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-head text-lg sm:text-xl tracking-wider uppercase">CinemaSync</span>
            <span className="font-mono text-[8px] sm:text-[9px] tracking-[0.3em] text-[#99958E] uppercase hidden sm:block">
              Watch · Party · Sync
            </span>
          </div>
        </Link>

        {user ? (
          <nav className="flex items-center gap-1">
            <div className="flex items-center">
              <NavLink to="/dashboard" testid="nav-dashboard-link" mobileIcon={<LayoutDashboard size={18} />}>
                <span className="inline-flex items-center gap-2"><LayoutDashboard size={14} /> Dashboard</span>
              </NavLink>
              <NavLink to="/friends" testid="nav-friends-link" mobileIcon={<Users size={18} />}>
                <span className="inline-flex items-center gap-2"><Users size={14} /> Friends</span>
              </NavLink>
              <NavLink to="/profile" testid="nav-profile-link" mobileIcon={<User size={18} />}>
                <span className="inline-flex items-center gap-2"><User size={14} /> Profile</span>
              </NavLink>
            </div>
            <button
              data-testid="logout-button"
              onClick={async () => { await logout(); navigate("/"); }}
              className="ml-2 sm:ml-3 border border-white/15 text-[#F7F7F2] hover:border-[#EF4444] hover:text-[#EF4444] font-mono tracking-[0.2em] uppercase text-xs px-2 sm:px-4 py-2 transition-colors flex items-center gap-2"
            >
              <LogOut size={13} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link
              to="/login"
              data-testid="nav-login-link"
              className="font-mono tracking-[0.2em] uppercase text-xs text-[#99958E] hover:text-[#F7F7F2] px-4 py-2"
            >
              Login
            </Link>
            <Link
              to="/register"
              data-testid="nav-register-link"
              className="bg-[#FACC15] text-[#0A0908] font-mono tracking-[0.2em] uppercase text-xs px-4 py-2 hover:bg-[#FDE047] transition-colors"
            >
              Get Started
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
