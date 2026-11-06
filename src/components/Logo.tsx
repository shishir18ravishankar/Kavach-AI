export function ShieldMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#0b1530" />
      <path d="M32 9 50 16v14c0 12.5-7.7 21.6-18 25-10.3-3.4-18-12.5-18-25V16z" fill="#1f3a8a" stroke="#8fb0ff" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="23" y="29" width="18" height="14" rx="3" fill="#fff" />
      <path d="M26.5 29v-4a5.5 5.5 0 0 1 11 0v4" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="32" cy="35.5" r="2.2" fill="#0b1530" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 font-bold tracking-tight text-ink">
      <ShieldMark className="h-8 w-8" />
      <span className="text-lg">
        Kavach <span className="text-brand">AI</span>
      </span>
    </span>
  );
}
