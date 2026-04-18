import React from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { Film, Users, MessageCircleMore, PlayCircle, Cast, ShieldCheck } from "lucide-react";

const HERO_IMG =
  "https://images.unsplash.com/photo-1774719810790-a52472f74d9a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzV8MHwxfHNlYXJjaHwxfHx2aW50YWdlJTIwY2luZW1hJTIwbWFycXVlZXxlbnwwfHx8fDE3NzY0OTA0NjZ8MA&ixlib=rb-4.1.0&q=85";

const CONTEXT_IMG =
  "https://images.unsplash.com/photo-1749372517971-9961bea2209a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODd8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwd2F0Y2hpbmclMjB0diUyMGRhcmslMjByb29tfGVufDB8fHx8MTc3NjQ5MDQ2Nnww&ixlib=rb-4.1.0&q=85";

const Feature = ({ icon: Icon, title, copy, testid }) => (
  <div
    data-testid={testid}
    className="border border-white/5 bg-[#141211] p-6 hover:border-[#FACC15]/70 transition-all group"
  >
    <Icon size={22} className="text-[#FACC15] mb-4" />
    <h3 className="font-head text-xl uppercase tracking-wide mb-2 group-hover:text-[#FACC15]">{title}</h3>
    <p className="text-[#99958E] text-sm leading-relaxed">{copy}</p>
  </div>
);

const MARQUEE_TEXT = "NOW SHOWING · CINEMASYNC · WATCH TOGETHER · LIVE · REEL · BUTTERED POPCORN · SCREEN #1 · ";

export default function Landing() {
  return (
    <div>
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-[85vh] sm:min-h-[90vh] overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${HERO_IMG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0908]/70 via-[#0A0908]/85 to-[#0A0908]" />

        {/* Marquee strip */}
        <div className="absolute top-16 left-0 right-0 overflow-hidden border-y border-[#FACC15]/40 bg-[#FACC15]/5 py-2">
          <div className="marquee-track whitespace-nowrap flex gap-12">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className="font-head text-base sm:text-xl uppercase tracking-[0.3em] text-[#FACC15] flicker">
                {MARQUEE_TEXT}
              </span>
            ))}
          </div>
        </div>

        <div className="relative max-w-[1400px] mx-auto px-6 md:px-10 pt-32 sm:pt-40 pb-16 sm:pb-24">
          <div className="max-w-3xl reveal">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-[#FACC15]/40 bg-[#FACC15]/5 text-[#FACC15] font-mono text-[10px] sm:text-[11px] tracking-[0.3em] uppercase mb-6">
              <span className="w-2 h-2 bg-[#EF4444] pulse-live" /> Live Watch Parties · Nightly
            </div>
            <h1 className="font-head text-4xl sm:text-6xl lg:text-7xl uppercase leading-[0.95] text-[#F7F7F2] mb-6 break-words">
              The theatre you
              <br />
              <span className="text-[#FACC15]">carry in your browser.</span>
            </h1>
            <p className="text-[#99958E] text-base sm:text-lg max-w-xl mb-8 sm:mb-10 leading-relaxed">
              Host a synchronized watch party with your crew. Play, pause, and seek on every screen at
              once — with chat, emojis, and optional screen share. Your subscription stays yours.
            </p>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <Link
                to="/register"
                data-testid="hero-cta-register"
                className="bg-[#FACC15] text-[#0A0908] font-mono tracking-[0.2em] sm:tracking-[0.25em] uppercase text-xs sm:text-sm px-5 sm:px-7 py-3 sm:py-4 hover:bg-[#FDE047] hover:shadow-[0_0_25px_rgba(250,204,21,0.35)] transition-all"
              >
                Book your seat
              </Link>
              <Link
                to="/login"
                data-testid="hero-cta-login"
                className="border border-white/20 text-[#F7F7F2] font-mono tracking-[0.25em] uppercase text-xs sm:text-sm px-5 sm:px-7 py-3 sm:py-4 hover:border-[#3B82F6] hover:text-[#3B82F6] transition-all"
              >
                Take me to my balcony
              </Link>
            </div>

            <div className="mt-10 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-6 max-w-xl">
              {[
                { k: "01", v: "Sync to ±50ms" },
                { k: "02", v: "No credential sharing" },
                { k: "03", v: "6 OTT platforms" },
              ].map((s) => (
                <div key={s.k}>
                  <div className="font-mono text-[10px] tracking-[0.3em] text-[#FACC15]">{s.k}</div>
                  <div className="font-head text-xs sm:text-sm uppercase text-[#F7F7F2] mt-1">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-12 sm:py-20">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-8 sm:mb-12">
          <div>
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#FACC15] mb-3">Feature Reel</div>
            <h2 className="font-head text-3xl sm:text-5xl uppercase">What's on the programme</h2>
          </div>
          <p className="text-[#99958E] max-w-md text-sm sm:text-base">
            Sync without streaming someone else's Netflix. Your app, your rules, your friends, one timestamp.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Feature testid="feature-sync" icon={PlayCircle} title="Playback Sync" copy="Host controls play, pause, and seek — every screen lines up in real time via WebSocket." />
          <Feature testid="feature-chat" icon={MessageCircleMore} title="Live Chat" copy="Drop reactions, jokes, and emoji spam without leaving the cinema." />
          <Feature testid="feature-friends" icon={Users} title="Friend System" copy="Search by Unique ID, send requests, keep your regulars close." />
          <Feature testid="feature-ott" icon={Film} title="OTT Launcher" copy="One-click openers for Netflix, Prime, Hotstar, Hoichoi, Adda Times, ZEE5." />
          <Feature testid="feature-screenshare" icon={Cast} title="Screen Share" copy="WebRTC peer-to-peer screenshare for the host — no servers in the middle." />
          <Feature testid="feature-security" icon={ShieldCheck} title="No Credential Sharing" copy="Every user signs into their own OTT. We sync the reel, not the password." />
        </div>
      </section>

      {/* Context */}
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-12 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="relative h-[280px] sm:h-[420px]">
            <img src={CONTEXT_IMG} alt="Friends watching" className="w-full h-full object-cover grayscale-[30%]" />
            <div className="absolute -bottom-4 -left-4 bg-[#FACC15] text-[#0A0908] font-head text-lg sm:text-xl uppercase tracking-wider px-4 py-2">
              Reel #42
            </div>
          </div>
          <div>
            <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#FACC15] mb-3">Intermission</div>
            <h2 className="font-head text-3xl sm:text-5xl uppercase leading-tight mb-6">
              Distance is just bad editing.
            </h2>
            <p className="text-[#99958E] text-base sm:text-lg leading-relaxed mb-6">
              CinemaSync stitches the timeline between you and your people. Same scene. Same second.
              Same laughs.
            </p>
            <Link
              to="/register"
              data-testid="context-cta-register"
              className="inline-block bg-[#FACC15] text-[#0A0908] font-mono tracking-[0.25em] uppercase text-xs sm:text-sm px-5 sm:px-7 py-3 sm:py-4 hover:bg-[#FDE047] transition-all"
            >
              Start a private screening
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-10">
        <div className="max-w-[1400px] mx-auto px-6 md:px-10 py-10 flex flex-wrap gap-6 justify-between items-center">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#5C5A56]">
            © {new Date().getFullYear()} CinemaSync · A reel-time watch party
          </div>
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#5C5A56]">
            Built for friends · Not for piracy
          </div>
        </div>
      </footer>
    </div>
  );
}
