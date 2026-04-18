import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Film, User, LogOut, Users, LayoutDashboard } from "lucide-react";

const NavLink = ({ to, children, testid }) => {
  const { pathname } = useLocation();
  const active = pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      data-testid={testid}
      className={`font-mono text-xs tracking-[0.2em] uppercase px-3 py-2 transition-colors ${
        active ? "text-[#E5A93C]" : "text-[#99958E] hover:text-[#F7F7F2]"
      }`}
    >
      {children}
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
      <div className="max-w-[1400px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-3 group" data-testid="logo-home-link">
          <div className="w-8 h-8 bg-[#E5A93C] text-[#0A0908] flex items-center justify-center">
            <Film size={18} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-head text-xl tracking-wider uppercase">CinemaSync</span>
            <span className="font-mono text-[9px] tracking-[0.3em] text-[#99958E] uppercase">
              Watch · Party · Sync
            </span>
          </div>
        </Link>

        {user ? (
          <nav className="flex items-center gap-1">
            <div className="hidden md:flex items-center">
              <NavLink to="/dashboard" testid="nav-dashboard-link">
                <span className="inline-flex items-center gap-2"><LayoutDashboard size={14} /> Dashboard</span>
              </NavLink>
              <NavLink to="/friends" testid="nav-friends-link">
                <span className="inline-flex items-center gap-2"><Users size={14} /> Friends</span>
              </NavLink>
              <NavLink to="/profile" testid="nav-profile-link">
                <span className="inline-flex items-center gap-2"><User size={14} /> Profile</span>
              </NavLink>
            </div>
            <button
              data-testid="logout-button"
              onClick={async () => { await logout(); navigate("/"); }}
              className="ml-3 border border-white/15 text-[#F7F7F2] hover:border-[#FF3B00] hover:text-[#FF3B00] font-mono tracking-[0.2em] uppercase text-xs px-4 py-2 transition-colors flex items-center gap-2"
            >
              <LogOut size={13} /> Logout
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
              className="bg-[#E5A93C] text-[#0A0908] font-mono tracking-[0.2em] uppercase text-xs px-4 py-2 hover:bg-[#F0B955] transition-colors"
            >
              Get Started
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
