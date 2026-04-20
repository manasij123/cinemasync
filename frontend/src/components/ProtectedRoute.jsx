import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2a2a2a]" data-testid="auth-loading">
        <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#cccccc]">Loading reel…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
