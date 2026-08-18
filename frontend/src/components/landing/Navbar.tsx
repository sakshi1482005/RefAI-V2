import { Link } from 'react-router-dom'
import { HOW_IT_WORKS_PATH, HOW_IT_WORKS_SECTION_ID, scrollToLandingSection } from '../../lib/landingNavigation'
import RefAILogo from '../branding/RefAILogo'

export default function Navbar() {
  return (
    <header className="nav-wrap">
      <nav className="nav shell" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="RefAI home">
          <RefAILogo className="contents" markClassName="mark" />
        </a>
        <div className="nav-links">
          <Link to={HOW_IT_WORKS_PATH} aria-controls={HOW_IT_WORKS_SECTION_ID} onClick={() => scrollToLandingSection(HOW_IT_WORKS_SECTION_ID)}>How It Works</Link>
          <a href="#about">About</a>
          <a href="#faq">FAQ</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="nav-actions">
          <a className="btn btn-plain" href="/login">Login</a>
          <Link className="btn btn-primary" to="/auth">Get Started</Link>
        </div>
      </nav>
    </header>

  )
}
