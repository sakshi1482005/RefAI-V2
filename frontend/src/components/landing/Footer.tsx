'use client'
import RefAILogo from '../branding/RefAILogo'

export default function Footer() {
  return (
    <footer id="contact" className="site-footer">

      <div className="shell footer-grid">
        <div className="footer-brand">
          <a className="brand" href="#top" aria-label="RefAI home">
            <RefAILogo className="contents" markClassName="mark" />
          </a>
          <p className="footer-tagline">
            Turning resume claims into employee-ready referral evidence.
          </p>
        </div>

        <div className="footer-col">
          <div className="footer-heading">Product</div>
          <a href="#how-it-works">How It Works</a>
          <a href="#demo">AI Preview</a>
        </div>

        <div className="footer-col">
          <div className="footer-heading">Audience</div>
          <a href="/auth">For Students</a>
          <a href="/auth">For Employees</a>
          <a href="#about">Why RefAI</a>
        </div>

        <div className="footer-col">
          <div className="footer-heading">Contact & Get Started</div>
          <a href="/auth">Create Trust Card</a>
          <a id="login" href="/auth">Login</a>
          
        </div>
      </div>

      <div className="shell footer-bottom">
        <span>(c) {new Date().getFullYear()} RefAI. All rights reserved.</span>
        <div className="footer-social">
          <span aria-label="RefAI on LinkedIn">LinkedIn</span>
          <span aria-label="RefAI on GitHub">GitHub</span>
          <span aria-label="RefAI on X">X</span>
        </div>
      </div>
    </footer>
  )
}
