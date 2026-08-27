import { ShieldCheck } from "lucide-react"

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-[#07080c]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10">
            <ShieldCheck size={20} className="text-cyan-300" />
          </div>

          <span className="text-lg font-semibold tracking-tight">
            Voice<span className="text-cyan-300">Guard</span>
          </span>
        </div>

        {/* Navigation */}
        <div className="hidden items-center gap-8 text-sm text-white/50 md:flex">
          <a href="#technology" className="transition-colors hover:text-white">
            Technology
          </a>

          <a href="#analysis" className="transition-colors hover:text-white">
            Analysis
          </a>

          <a href="#security" className="transition-colors hover:text-white">
            Security
          </a>
        </div>

        {/* Login */}
        <button className="rounded-full border border-white/15 px-5 py-2 text-sm text-white transition-all hover:border-cyan-300/40 hover:bg-white/5">
          Sign in
        </button>

      </div>
    </nav>
  )
}

export default Navbar