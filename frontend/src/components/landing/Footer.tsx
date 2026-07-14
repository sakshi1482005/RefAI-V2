'use client'
import { useId } from 'react'

export default function Footer() {
  const maskId = useId()

  return (
    <footer className="site-footer">

      <div className="shell footer-grid">
        <div className="footer-brand">
          <a className="brand" href="#top" aria-label="RefAI home">
            <svg className="mark" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
                  <rect x="0" y="0" width="120" height="120" fill="#ffffff" />
                  <path d="M34,62 L52,80 L90,36" stroke="#000000" strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </mask>
              </defs>
              <circle cx="60" cy="60" r="52" fill="#161A2E" mask={`url(#${maskId})`} />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#1E8F6B" strokeWidth="4" />
            </svg>
            RefAI
          </a>
          <p className="footer-tagline">
            Turning resume claims into employee-ready referral evidence.
          </p>
        </div>

        <div className="footer-col">
          <div className="footer-heading">Product</div>
          <a href="#how">How It Works</a>
          <a href="#demo">AI Preview</a>
        </div>

        <div className="footer-col">
          <div className="footer-heading">Audience</div>
          <a href="#students">For Students</a>
          <a href="#employees">For Employees</a>
          <a href="#about">Why RefAI</a>
        </div>

        <div className="footer-col">
          <div className="footer-heading">Get Started</div>
          <a href="/dashboard">Create Trust Card</a>
          <a id="login" href="/login">Login</a>
          <a href="mailto:hello@refai.example">Contact Us</a>
        </div>
      </div>

      <div className="shell footer-bottom">
        <span>(c) {new Date().getFullYear()} RefAI. All rights reserved.</span>
        <div className="footer-social">
          <a href="#top" aria-label="RefAI on LinkedIn">LinkedIn</a>
          <a href="#top" aria-label="RefAI on GitHub">GitHub</a>
          <a href="#top" aria-label="RefAI on X">X</a>
        </div>
      </div>
    </footer>
  )
}