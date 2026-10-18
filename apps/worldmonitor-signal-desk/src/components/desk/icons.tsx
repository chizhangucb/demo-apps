import type { AgentId } from "@/lib/sim";

export function Galaxy({ className }: { className?: string }) {
  const arms = [0, 120, 240];
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="40%" stopColor="#cfe6ff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#6aa8ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="origin-center animate-[spin_24s_linear_infinite]" style={{ transformBox: "fill-box" }}>
        {arms.map((r) => (
          <path
            key={r}
            transform={`rotate(${r} 20 20)`}
            d="M20 20 C 26 16, 31 20, 30 26 C 29 31, 22 34, 15 32"
            fill="none"
            stroke="#e8eef8"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.85"
          />
        ))}
      </g>
      <circle cx="20" cy="20" r="7" fill="url(#core)" />
    </svg>
  );
}

const SHAPES: Record<AgentId, React.ReactNode> = {
  KETT: <path d="M12 3 21 12 12 21 3 12Z M12 8 16 12 12 16 8 12Z" fillRule="evenodd" />,
  BRAM: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" opacity="0.5" />
    </>
  ),
  ILSA: <path d="M12 3c5 0 9 3 8 8s-3 10-8 10-9-3-8-9 3-9 8-9Z M12 8a4 4 0 1 0 0.01 0Z" fillRule="evenodd" />,
  HOLT: <path d="M12 2 21 7v10l-9 5-9-5V7Z M12 7 16.5 9.5v5L12 17l-4.5-2.5v-5Z" fillRule="evenodd" />,
  TESS: <path d="M3 18 9 6l4 8 3-5 5 9Z" />,
  RIGO: <path d="M12 2 22 20H2Z M12 9 16.5 17h-9Z" fillRule="evenodd" />,
};

export function AgentGlyph({ id, className }: { id: AgentId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      {SHAPES[id]}
    </svg>
  );
}
