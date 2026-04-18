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
        active ? "text-[#7209b7]" : "text-[#6b5b84] hover:text-[#1a0b2e]"
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
      className="sticky top-0 z-40 border-b border-[#7209b7]/20 bg-[#ffffff]/85 backdrop-blur-xl"
      data-testid="top-navbar"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 md:px-10 h-16 flex items-center justify-between gap-2">
        <Link to={user ? "/dashboard" : "/"} className="flex items-center gap-2 sm:gap-3 group shrink-0" data-testid="logo-home-link">
          <div className="w-9 h-9 overflow-hidden border border-[#7209b7]/40 bg-white shrink-0">
            <img src="/logo.jpg" alt="CinemaSync" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-head text-lg sm:text-xl tracking-wider uppercase">CinemaSync</span>
            <span className="font-mono text-[8px] sm:text-[9px] tracking-[0.3em] text-[#6b5b84] uppercase hidden sm:block">
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
              className="ml-2 sm:ml-3 border border-[#7209b7]/35 text-[#1a0b2e] hover:border-[#f72585] hover:text-[#f72585] font-mono tracking-[0.2em] uppercase text-xs px-2 sm:px-4 py-2 transition-colors flex items-center gap-2"
            >
              <LogOut size={13} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link
              to="/login"
              data-testid="nav-login-link"
              className="font-mono tracking-[0.2em] uppercase text-xs text-[#6b5b84] hover:text-[#1a0b2e] px-4 py-2"
            >
              Login
            </Link>
            <Link
              to="/register"
              data-testid="nav-register-link"
              className="bg-[#7209b7] text-[#1a0b2e] font-mono tracking-[0.2em] uppercase text-xs px-4 py-2 hover:bg-[#4a0580] transition-colors"
            >
              Get Started
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
