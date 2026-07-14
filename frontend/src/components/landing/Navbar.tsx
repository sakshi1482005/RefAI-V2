export default function Navbar() {
  return (
    <header className="nav-wrap">
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="RefAI home">
          <svg className="mark" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <mask id="signet-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
                <rect x="0" y="0" width="120" height="120" fill="#ffffff" />
                <path d="M34,62 L52,80 L90,36" stroke="#000000" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </mask>
            </defs>
            <circle cx="60" cy="60" r="52" fill="#161A2E" mask="url(#signet-cut)" />
            <circle cx="60" cy="60" r="52" fill="none" stroke="#1E8F6B" strokeWidth="4" />
          </svg>
          RefAI
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How It Works</a>
          <a href="#about">About</a>
          <a href="#faq">FAQ</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="nav-actions">
          <a className="btn btn-plain" href="/login">Login</a>
          <a className="btn btn-primary" href="/">Get Started</a>
        </div>
      </nav>
    </header>

  )
}
