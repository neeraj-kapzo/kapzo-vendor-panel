import { KapzoLogo, FloatingPill } from './KapzoLogo'

const pills = [
  { w: 72, h: 26, r: -35, top: '8%',  left: '8%',  anim: 'animate-pill-float',  delay: '0s',    color1: '#21A053', color2: '#00326F' },
  { w: 52, h: 18, r:  20, top: '18%', left: '72%', anim: 'animate-pill-slow',   delay: '1.2s',  color1: '#00326F', color2: '#021830' },
  { w: 80, h: 28, r:  15, top: '38%', left: '60%', anim: 'animate-pill-drift',  delay: '0.6s',  color1: '#178040', color2: '#00326F' },
  { w: 48, h: 16, r: -55, top: '55%', left: '5%',  anim: 'animate-pill-float',  delay: '2s',    color1: '#21A053', color2: '#0045a0' },
  { w: 64, h: 22, r:  40, top: '68%', left: '65%', anim: 'animate-pill-slow',   delay: '0.4s',  color1: '#00326F', color2: '#022135' },
  { w: 44, h: 16, r: -20, top: '80%', left: '20%', anim: 'animate-pill-drift',  delay: '1.8s',  color1: '#21A053', color2: '#178040' },
  { w: 56, h: 20, r:  60, top: '88%', left: '55%', anim: 'animate-pill-float',  delay: '3s',    color1: '#00326F', color2: '#021830' },
  { w: 36, h: 14, r: -10, top: '28%', left: '2%',  anim: 'animate-pill-slow',   delay: '2.5s',  color1: '#178040', color2: '#21A053' },
]

interface AuthBrandPanelProps {
  heading?: React.ReactNode
  subheading?: string
}

export function AuthBrandPanel({
  heading = (<>Medicines Delivered<br /><span className="text-[#21A053]">in 30 Minutes.</span></>),
  subheading = 'Join Kapzo and reach thousands of customers in your area. Manage orders, inventory and earnings — all in one place.',
}: AuthBrandPanelProps) {
  return (
    <div className="hidden lg:flex lg:w-[52%] xl:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #21A053 0%, #00326F 50%, #022135 100%)' }}
    >
      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }}
      />

      {/* Radial glows */}
      <div className="absolute top-[-20%] right-[-15%] w-[500px] h-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(33,160,83,0.25) 0%, transparent 70%)' }}
      />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(0,50,111,0.4) 0%, transparent 70%)' }}
      />

      {/* Floating pills */}
      {pills.map((p, i) => (
        <div
          key={i}
          className={`absolute ${p.anim}`}
          style={{ top: p.top, left: p.left, animationDelay: p.delay, '--r': `${p.r}deg` } as React.CSSProperties}
        >
          <FloatingPill width={p.w} height={p.h} rotation={p.r} color1={p.color1} color2={p.color2} />
        </div>
      ))}

      {/* Logo */}
      <div className="relative z-10 flex items-center gap-3 animate-fade-in-up">
        <KapzoLogo size={44} />
        <div>
          <span className="text-white font-bold text-xl tracking-tight font-display">Kapzo</span>
          <p className="text-white/50 text-[11px] leading-none mt-0.5 font-sans">Vendor Portal</p>
        </div>
      </div>

      {/* Main copy */}
      <div className="relative z-10 space-y-5 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
        <h1 className="text-[2.6rem] font-bold text-white leading-tight tracking-tight font-display">
          {heading}
        </h1>
        <p className="text-white/60 text-base leading-relaxed max-w-xs">
          {subheading}
        </p>

        {/* Stats strip */}
        <div className="flex gap-6 pt-2">
          {[
            { value: '2,400+', label: 'Partner Pharmacies' },
            { value: '30 min', label: 'Avg. Delivery' },
            { value: '98%',    label: 'Order Accuracy' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-white font-bold text-xl">{s.value}</p>
              <p className="text-white/45 text-[11px] mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex gap-5 text-white/35 text-xs animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <span>© {new Date().getFullYear()} Kapzo</span>
        <span>Privacy Policy</span>
        <span>Terms of Service</span>
      </div>
    </div>
  )
}
