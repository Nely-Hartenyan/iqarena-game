export function BuzzerArt() {
  return (
    <div className="art art-rush" aria-hidden="true">
      <span className="rush-wave rush-wave-late" />
      <span className="rush-wave" />
      <svg className="rush-pad" viewBox="0 0 280 220">
        <ellipse cx="140" cy="178" rx="112" ry="20" fill="#0d1730" />
        <ellipse cx="140" cy="168" rx="104" ry="18" fill="#1c3f86" />
        <circle cx="140" cy="104" r="64" fill="#c49212" />
        <circle cx="140" cy="96" r="52" fill="#e8b931" />
        <circle cx="140" cy="90" r="34" fill="#f8e3a1" />
        <path d="M148 68l-28 34h18l-8 28 32-38h-18z" fill="#14284f" />
      </svg>
    </div>
  )
}
