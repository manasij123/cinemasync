import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Web Speech API wrapper for voice commands.
 *
 * Pass a `handlers` map like:
 *   {
 *     play:    () => void,
 *     pause:   () => void,
 *     reset:   () => void,
 *     forward: (seconds) => void,
 *     back:    (seconds) => void,
 *   }
 *
 * Returns:
 *   - listening (bool)
 *   - supported (bool)
 *   - toggle()
 *   - transcript (last recognised phrase)
 *   - lastCommand ('play'|'pause'|'forward-30'|...)
 */
export default function useVoiceCommands({ handlers = {}, enabled = true }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastCommand, setLastCommand] = useState("");
  const recRef = useRef(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const SpeechRecognition =
    typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  const supported = !!SpeechRecognition;

  const parse = useCallback((raw) => {
    const t = (raw || "").toLowerCase().trim();
    if (!t) return null;

    // Wake-word aware matching ("cinemasync pause" or just "pause")
    const stripped = t.replace(/^(cinemasync|cinema sync|sync)\s*/, "").trim();

    const hasAny = (words) => words.some((w) => stripped.includes(w));

    if (hasAny(["play", "resume", "start"])) return { cmd: "play" };
    if (hasAny(["pause", "stop", "hold"])) return { cmd: "pause" };
    if (hasAny(["reset", "restart", "rewind to start", "beginning"])) return { cmd: "reset" };
    if (hasAny(["mute"])) return { cmd: "mute" };
    if (hasAny(["unmute"])) return { cmd: "unmute" };

    // "forward 30" / "skip forward 30 seconds" / "ahead 10"
    const fw = stripped.match(/(forward|ahead|skip(?:\s*ahead)?)\s*(\d{1,3})?/);
    if (fw) return { cmd: "forward", seconds: parseInt(fw[2] || "10", 10) };

    // "back 10" / "rewind 20 seconds" / "go back 15"
    const bk = stripped.match(/(back|rewind|behind)\s*(\d{1,3})?/);
    if (bk) return { cmd: "back", seconds: parseInt(bk[2] || "10", 10) };

    return null;
  }, []);

  useEffect(() => {
    if (!supported || !enabled) return;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    recRef.current = rec;

    rec.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      const text = final || interim;
      setTranscript(text);
      if (final) {
        const parsed = parse(final);
        if (parsed) {
          const h = handlersRef.current;
          const key = parsed.seconds ? `${parsed.cmd}-${parsed.seconds}` : parsed.cmd;
          setLastCommand(key);
          try {
            if (parsed.cmd === "play") h.play?.();
            else if (parsed.cmd === "pause") h.pause?.();
            else if (parsed.cmd === "reset") h.reset?.();
            else if (parsed.cmd === "mute") h.mute?.();
            else if (parsed.cmd === "unmute") h.unmute?.();
            else if (parsed.cmd === "forward") h.forward?.(parsed.seconds);
            else if (parsed.cmd === "back") h.back?.(parsed.seconds);
          } catch {}
        }
      }
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      // Auto-restart if user still has listening=true (browser throttles to ~60s)
      if (recRef.current && recRef.current._wantOn) {
        try { recRef.current.start(); } catch {}
      } else {
        setListening(false);
      }
    };
    return () => {
      try { rec.stop(); } catch {}
      recRef.current = null;
    };
  }, [supported, enabled, parse, SpeechRecognition]);

  const toggle = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec._wantOn = false;
      try { rec.stop(); } catch {}
      setListening(false);
    } else {
      rec._wantOn = true;
      try { rec.start(); setListening(true); } catch { setListening(false); }
    }
  }, [listening]);

  return { supported, listening, toggle, transcript, lastCommand };
}
