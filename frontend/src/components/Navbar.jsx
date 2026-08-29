import { Link } from "react-router-dom"
import { ShieldCheck } from "lucide-react"

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070b14]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2.5 font-display text-lg font-semibold tracking-[-0.03em] text-[#edf3ff]">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#7eaaff]/30 bg-[#1c345e] text-[#dbe9ff]"><ShieldCheck className="h-4 w-4" /></span>
          Voice Shield
        </Link>
        <nav aria-label="Primary navigation" className="flex items-center gap-3 sm:gap-6">
          <Link to="/dashboard" className="hidden text-sm font-medium text-[#aab7cc] transition hover:text-white sm:block">
            Checks
          </Link>
          <Link to="/enroll" className="text-sm font-medium text-[#aab7cc] transition hover:text-white">
            Trusted voices
          </Link>
        </nav>
      </div>
    </header>
  )
}

export default Navbar
