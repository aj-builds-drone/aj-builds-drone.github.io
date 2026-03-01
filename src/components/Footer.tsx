import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border-dim bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="font-mono text-sm tracking-widest text-accent-green mb-3">
              AJ//DRONE<span className="text-accent-orange">_SYS</span>
            </div>
            <p className="text-text-secondary text-base leading-relaxed">
              FAA Part 107 Certified Drone Pilot & Private Pilot Student.
              MS in ECE from Mississippi State University. Sr. FPGA Systems Engineer.
              Building drone systems from the silicon up.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-4">
              // NAVIGATION
            </h3>
            <div className="space-y-2">
              {[
                { href: "/", label: "Home" },
                { href: "/projects", label: "Hangar" },
                { href: "/services", label: "Services" },
                { href: "/contact", label: "Request Quote" },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block text-text-secondary hover:text-accent-orange text-sm transition-colors font-mono"
                >
                  → {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-mono text-xs tracking-widest text-accent-orange mb-4">
              // CONTACT
            </h3>
            <div className="space-y-2 text-sm text-text-secondary font-mono">
              <p>Austin, TX — Available Worldwide</p>
              <div className="space-y-1 mt-2">
                <a href="https://github.com/ajayadahal" target="_blank" rel="noopener noreferrer" className="block hover:text-accent-orange transition-colors">→ GitHub</a>
                <a href="https://www.linkedin.com/in/ajaya-dahal-137b94108/" target="_blank" rel="noopener noreferrer" className="block hover:text-accent-orange transition-colors">→ LinkedIn</a>
                <a href="https://www.youtube.com/@ajayadahal6160" target="_blank" rel="noopener noreferrer" className="block hover:text-accent-orange transition-colors">→ YouTube</a>
                <a href="https://www.hackster.io/ajayadahal" target="_blank" rel="noopener noreferrer" className="block hover:text-accent-orange transition-colors">→ Hackster.io</a>
                <a href="https://ajayadahal.github.io" target="_blank" rel="noopener noreferrer" className="block hover:text-accent-orange transition-colors">→ Portfolio</a>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-green pulse-green" />
                <span className="text-accent-green text-xs">
                  ACCEPTING CONTRACTS
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border-dim flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-text-secondary text-xs font-mono">
            © {year} AJ DAHAL // DRONE SYSTEMS DIVISION. ALL FREQUENCIES RESERVED.
          </p>
          <div className="flex items-center gap-4 text-xs font-mono text-text-secondary">
            <span>AUSTIN, TX</span>
            <span className="text-border-bright">|</span>
            <span>FAA PART 107</span>
            <span className="text-border-bright">|</span>
            <span>UPLINK: STABLE</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
