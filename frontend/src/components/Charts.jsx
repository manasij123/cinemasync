import React from "react";

// --- Sparkline ---
export function Sparkline({ data, color = "#7209b7", width = 120, height = 36 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1 || 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="block">
      <defs>
        <linearGradient id={`sg-${color.slice(1)}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={areaPoints} fill={`url(#sg-${color.slice(1)})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// --- Line Chart (two series) ---
export function LineChart({ seriesA, seriesB, labels, colorA = "#7209b7", colorB = "#4cc9f0", height = 200 }) {
  const width = 800;
  const pad = { t: 20, r: 16, b: 30, l: 36 };
  const n = labels.length;
  const maxVal = Math.max(...seriesA, ...seriesB, 5);
  const xStep = (width - pad.l - pad.r) / Math.max(n - 1, 1);
  const yScale = (v) => pad.t + (1 - v / maxVal) * (height - pad.t - pad.b);
  const toPoints = (s) => s.map((v, i) => `${pad.l + i * xStep},${yScale(v)}`).join(" ");
  const gridLines = 4;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" className="block">
      <defs>
        <linearGradient id="lc-a" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colorA} stopOpacity="0.25" />
          <stop offset="100%" stopColor={colorA} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Gridlines */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = pad.t + (i / gridLines) * (height - pad.t - pad.b);
        const val = Math.round(maxVal - (i / gridLines) * maxVal);
        return (
          <g key={i}>
            <line x1={pad.l} y1={y} x2={width - pad.r} y2={y} stroke="#e7c6ff" strokeDasharray="4 4" />
            <text x={pad.l - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6b5b84" fontFamily="IBM Plex Mono">{val}</text>
          </g>
        );
      })}
      {/* Series A area */}
      <polygon
        points={`${pad.l},${height - pad.b} ${toPoints(seriesA)} ${pad.l + (n - 1) * xStep},${height - pad.b}`}
        fill="url(#lc-a)"
      />
      {/* Series A line */}
      <polyline points={toPoints(seriesA)} fill="none" stroke={colorA} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="draw-path" />
      {/* Series B line */}
      <polyline points={toPoints(seriesB)} fill="none" stroke={colorB} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 4" />
      {/* Dots on A */}
      {seriesA.map((v, i) => (
        <circle key={i} cx={pad.l + i * xStep} cy={yScale(v)} r="3.5" fill="#ffffff" stroke={colorA} strokeWidth="2" />
      ))}
      {/* X labels */}
      {labels.map((l, i) => (
        <text key={i} x={pad.l + i * xStep} y={height - 8} textAnchor="middle" fontSize="10" fill="#6b5b84" fontFamily="IBM Plex Mono">{l}</text>
      ))}
    </svg>
  );
}

// --- Doughnut ---
export function Doughnut({ segments, size = 160, strokeWidth = 28 }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0e6ff" strokeWidth={strokeWidth} />
      {segments.map((s, i) => {
        const len = (s.value / total) * c;
        const circle = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap="butt"
          />
        );
        offset += len;
        return circle;
      })}
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="28" fontWeight="700" fill="#1a0b2e" fontFamily="Anton">
        {total}
      </text>
      <text x={size / 2} y={size / 2 + 16} textAnchor="middle" fontSize="10" fill="#6b5b84" fontFamily="IBM Plex Mono" letterSpacing="1.5">
        TOTAL
      </text>
    </svg>
  );
}

// --- BarChart ---
export function BarChart({ bars, height = 180, accent = "#f72585", secondary = "#4361ee" }) {
  const width = 400;
  const pad = { t: 20, r: 12, b: 30, l: 30 };
  const maxVal = Math.max(...bars.map((b) => b.value), 5);
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const barW = (innerW / bars.length) * 0.55;
  const gap = (innerW / bars.length) * 0.45;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" className="block">
      <defs>
        <linearGradient id="bg-pink" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="1" />
          <stop offset="100%" stopColor={secondary} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t, i) => {
        const y = pad.t + t * innerH;
        return <line key={i} x1={pad.l} y1={y} x2={width - pad.r} y2={y} stroke="#e7c6ff" strokeDasharray="3 4" />;
      })}
      {bars.map((b, i) => {
        const x = pad.l + i * (barW + gap) + gap / 2;
        const h = (b.value / maxVal) * innerH;
        const y = pad.t + innerH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} fill="url(#bg-pink)" rx="4" />
            <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize="10" fill="#1a0b2e" fontFamily="IBM Plex Mono" fontWeight="600">{b.value}</text>
            <text x={x + barW / 2} y={height - 10} textAnchor="middle" fontSize="9" fill="#6b5b84" fontFamily="IBM Plex Mono">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
