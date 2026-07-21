import { Link } from 'react-router-dom'
import { useDemoMode } from '../../context/DemoModeContext'
import RefAILogo from '../branding/RefAILogo'

export default function Navbar() {
  const { enterDemoMode } = useDemoMode()
  return (
    <header className="nav-wrap">
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="RefAI home">
          <RefAILogo className="contents" markClassName="mark" />
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How It Works</a>
          <a href="#about">About</a>
          <a href="#faq">FAQ</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="nav-actions">
          <a className="btn btn-plain" href="/login">Login</a>
          <Link className="btn btn-primary" to="/dashboard" onClick={enterDemoMode}>Get Started</Link>
        </div>
      </nav>
    </header>

  )
}
