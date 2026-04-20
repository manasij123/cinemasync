import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Copy, Check } from "lucide-react";
import { toast } from "sonner";

/**
 * Renders a QR code encoding a plain text payload like:
 *   CinemaSync Watch Party
 *   Room: ABC123
 *   Password: secret
 *   Invite: https://app.example.com/invite/ABC123?p=secret
 *
 * When scanned (Google Lens / any QR app), the user sees the room ID +
 * password directly, plus a tappable invite URL.
 */
export default function QRCodeCard({ roomId, password, roomName, size = 220, testid = "qr-code-card" }) {
  const canvasRef = useRef(null);
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const inviteUrl = `${window.location.origin}/invite/${roomId}${password ? `?p=${encodeURIComponent(password)}` : ""}`;
  const payload =
    `CinemaSync Watch Party\n` +
    (roomName ? `Room: ${roomName}\n` : "") +
    `ID: ${roomId}\n` +
    (password ? `Password: ${password}\n` : "") +
    `Invite: ${inviteUrl}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (canvasRef.current) {
          await QRCode.toCanvas(canvasRef.current, payload, {
            width: size,
            margin: 1,
            color: { dark: "#ffffff", light: "#2a2a2a" },
            errorCorrectionLevel: "M",
          });
        }
        const url = await QRCode.toDataURL(payload, {
          width: size * 2,
          margin: 2,
          color: { dark: "#ffffff", light: "#ffffff" },
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setDataUrl(url);
      } catch (e) {
        // QR rendering is best-effort; surface nothing
      }
    })();
    return () => { cancelled = true; };
  }, [payload, size]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success("Room details copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `cinemasync-${roomId}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div
      data-testid={testid}
      className="flex flex-col items-center gap-3 p-4 rounded-xl bg-[#2a2a2a] border border-[#6a14ff]/25"
    >
      <div className="rounded-lg p-2 bg-[#2a2a2a] shadow-[0_6px_18px_rgba(255,209,0,0.12)]">
        <canvas ref={canvasRef} data-testid={`${testid}-canvas`} />
      </div>
      <div className="text-center">
        <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#cccccc]">Scan to join</div>
        <div className="font-head text-lg uppercase text-[#ffffff] tracking-wide mt-0.5">{roomId}</div>
        {password && (
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#6a14ff]">pass: {password}</div>
        )}
      </div>
      <div className="flex gap-2 w-full">
        <button
          onClick={copyText}
          data-testid={`${testid}-copy`}
          className="flex-1 flex items-center justify-center gap-1.5 border border-[#6a14ff]/35 text-[#6a14ff] font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded-md hover:bg-[#6a14ff]/10"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={download}
          data-testid={`${testid}-download`}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[#6a14ff] text-white font-mono text-[10px] tracking-widest uppercase px-3 py-2 rounded-md hover:bg-[#5a0fd6]"
        >
          <Download size={12} /> PNG
        </button>
      </div>
    </div>
  );
}
