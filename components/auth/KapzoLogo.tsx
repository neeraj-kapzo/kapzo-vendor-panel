export function KapzoLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Pill body */}
      <rect x="4" y="14" width="32" height="12" rx="6" fill="url(#pill-grad)" />
      {/* Centre divider */}
      <line x1="20" y1="14" x2="20" y2="26" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      {/* K letter */}
      <text x="8.5" y="24.5" fontFamily="'DM Sans', sans-serif" fontWeight="700" fontSize="10" fill="white">K</text>
      {/* Plus icon on right half */}
      <line x1="26.5" y1="18" x2="26.5" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="24.5" y1="20" x2="28.5" y2="20" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <defs>
        <linearGradient id="pill-grad" x1="4" y1="14" x2="36" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#21A053" />
          <stop offset="1" stopColor="#00326F" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Floating decorative pill — used in brand panel */
export function FloatingPill({
  width = 56,
  height = 20,
  rotation = 0,
  color1 = '#21A053',
  color2 = '#00326F',
  className = '',
}: {
  width?: number
  height?: number
  rotation?: number
  color1?: string
  color2?: string
  className?: string
}) {
  const id = `fp-${rotation}-${width}`
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      style={{ '--r': `${rotation}deg` } as React.CSSProperties}
      className={className}
    >
      <rect x="1" y="1" width={width - 2} height={height - 2} rx={height / 2 - 1} fill={`url(#${id})`} />
      <line x1={width / 2} y1="3" x2={width / 2} y2={height - 3} stroke="white" strokeWidth="1" strokeOpacity="0.3" />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2={width} y2={height} gradientUnits="userSpaceOnUse">
          <stop stopColor={color1} />
          <stop offset="1" stopColor={color2} />
        </linearGradient>
      </defs>
    </svg>
  )
}
