'use client'

import { useEffect, useRef, useState } from 'react'

function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -80px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`hiw-reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}

export default function Journey() {
  return (
    <section id="how-it-works">
      <div className="shell">
        <div className="section-head center fade">
          <h2>
            How RefAI <em className="hero-serif-italic">Works</em>
          </h2>
          <p className="section-copy" style={{ margin: '14px auto 0' }}>
            From resume upload to referral approval in six simple steps.
          </p>
        </div>

        <div className="hiw-track">
          <div className="hiw-line"></div>

          {/* STEP 01 — text left, panel right */}
          <div className="hiw-row">
            <Reveal className="hiw-text">
              <span className="hiw-step-num">STEP 01</span>
              <h3 className="hiw-step-title">Upload Resume</h3>
              <p className="hiw-step-desc">Upload your resume in PDF format.</p>
            </Reveal>
            <span className="hiw-dot"></span>
            <Reveal className="hiw-visual" delay={100}>
              <div className="hiw-panel">
                <div className="hiw-file-row">
                  <span className="hiw-file-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-7-6Z"></path>
                      <path d="M13 2v6h6"></path>
                    </svg>
                  </span>
                  <div>
                    <b>resume_alex_morgan.pdf</b>
                    <span className="hiw-muted">248 KB · PDF</span>
                  </div>
                  <span className="hiw-uploaded-pill">✓ Uploaded</span>
                </div>
                <div className="hiw-dropzone">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5"></path>
                    <path d="m5 12 7-7 7 7"></path>
                  </svg>
                  <span>Drop file or browse</span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* STEP 02 — panel left, text right */}
          <div className="hiw-row hiw-row--reverse">
            <Reveal className="hiw-text">
              <span className="hiw-step-num">STEP 02</span>
              <h3 className="hiw-step-title">Paste Job Description</h3>
              <p className="hiw-step-desc">Choose your target company and paste the job description.</p>
            </Reveal>
            <span className="hiw-dot"></span>
            <Reveal className="hiw-visual" delay={100}>
              <div className="hiw-panel">
                <div className="hiw-panel-head">
                  <span className="hiw-step-num">TARGET ROLE</span>
                  <span className="hiw-muted">JD #4821</span>
                </div>
                <div className="hiw-role-box">
                  <b>Senior Frontend Engineer</b>
                  <span className="hiw-muted">Helix Labs · Remote · Full-time</span>
                </div>
                <div className="hiw-jd-box">
                  <span className="hiw-step-num">JOB DESCRIPTION</span>
                  <p>
                    We&apos;re looking for a senior frontend engineer with 5+ years of experience in
                    React, TypeScript, and system design. Experience with GraphQL and testing
                    frameworks is a plus...
                  </p>
                </div>
                <div className="hiw-jd-actions">
                  <button className="hiw-btn hiw-btn-dark">Paste JD</button>
                  <button className="hiw-btn hiw-btn-light">Import URL</button>
                </div>
              </div>
            </Reveal>
          </div>

          {/* STEP 03 — text left, panel right */}
          <div className="hiw-row">
            <Reveal className="hiw-text">
              <span className="hiw-step-num">STEP 03</span>
              <h3 className="hiw-step-title">AI Resume Analysis</h3>
              <p className="hiw-step-desc">
                RefAI analyzes your resume, compares skills, identifies gaps, and calculates your
                Match Score.
              </p>
            </Reveal>
            <span className="hiw-dot"></span>
            <Reveal className="hiw-visual" delay={100}>
              <div className="hiw-panel">
                <div className="hiw-panel-head">
                  <span className="hiw-analyzing">
                    <span className="hiw-live-dot"></span>Analyzing
                  </span>
                  <span className="hiw-muted">AI Engine v2.4</span>
                </div>
                <ul className="hiw-checklist">
                  <li className="done"><span className="hiw-check">✓</span>Parsing resume structure</li>
                  <li className="done"><span className="hiw-check">✓</span>Extracting skills &amp; experience</li>
                  <li className="done"><span className="hiw-check">✓</span>Comparing against JD</li>
                  <li className="active"><span className="hiw-radio"></span>Calculating match score...</li>
                </ul>
                <div className="hiw-progress"><i style={{ width: '78%' }}></i></div>
              </div>
            </Reveal>
          </div>

          {/* STEP 04 — panel left, text right */}
          <div className="hiw-row hiw-row--reverse">
            <Reveal className="hiw-text">
              <span className="hiw-step-num">STEP 04</span>
              <h3 className="hiw-step-title">Generate Candidate Trust Card</h3>
              <p className="hiw-step-desc">
                AI creates a concise Candidate Trust Card with Match Score, Top Skills, Referral
                Risk, and Readiness Summary.
              </p>
            </Reveal>
            <span className="hiw-dot"></span>
            <Reveal className="hiw-visual" delay={100}>
              <div className="hiw-panel">
                <div className="hiw-panel-head">
                  <span className="hiw-step-num">TRUST CARD</span>
                  <span className="hiw-uploaded-pill">Generated</span>
                </div>
                <div className="hiw-trust-row">
                  <div className="hiw-avatar">AM</div>
                  <div>
                    <b>Alex Morgan</b>
                    <span className="hiw-muted">Stanford · Computer Eng.</span>
                  </div>
                  <div className="hiw-ring">87</div>
                </div>
                <div className="hiw-stat-row">
                  <div className="hiw-stat">
                    <span className="hiw-muted">MATCH</span>
                    <b>87%</b>
                  </div>
                  <div className="hiw-stat">
                    <span className="hiw-muted">RISK</span>
                    <b className="green">Low</b>
                  </div>
                  <div className="hiw-stat">
                    <span className="hiw-muted">SKILLS</span>
                    <b>6/8</b>
                  </div>
                </div>
                <div className="hiw-footnote">✓ Verifiable · Signed by RefAI</div>
              </div>
            </Reveal>
          </div>

          {/* STEP 05 — text left, panel right */}
          <div className="hiw-row">
            <Reveal className="hiw-text">
              <span className="hiw-step-num">STEP 05</span>
              <h3 className="hiw-step-title">Request Referral</h3>
              <p className="hiw-step-desc">
                If your Match Score is 70 or above, generate an AI-powered referral message and
                send a referral request.
              </p>
            </Reveal>
            <span className="hiw-dot"></span>
            <Reveal className="hiw-visual" delay={100}>
              <div className="hiw-panel">
                <div className="hiw-panel-head">
                  <span className="hiw-step-num">REFERRAL MESSAGE</span>
                  <span className="hiw-muted">AI-generated</span>
                </div>
                <div className="hiw-msg-box">
                  &quot;Hi Sarah, I&apos;d like to refer <b>Alex Morgan</b> for the Senior Frontend
                  Engineer role at Helix Labs. Their trust score is <b>87%</b> with strong React &amp;
                  TypeScript skills and low referral risk...&quot;
                </div>
                <div className="hiw-jd-actions">
                  <button className="hiw-btn hiw-btn-dark">➤ Send Request</button>
                  <button className="hiw-btn hiw-btn-light">Edit</button>
                  <button className="hiw-btn hiw-btn-light">Copy</button>
                </div>
                <div className="hiw-inline-note">
                  <span className="hiw-live-dot"></span>Score 87% ≥ 70% threshold — referral unlocked
                </div>
              </div>
            </Reveal>
          </div>

          {/* STEP 06 — panel left, text right */}
          <div className="hiw-row hiw-row--reverse">
            <Reveal className="hiw-text">
              <span className="hiw-step-num">STEP 06</span>
              <h3 className="hiw-step-title">Employee Reviews</h3>
              <p className="hiw-step-desc">
                Employees review the Candidate Trust Card and confidently accept or decline the
                referral request.
              </p>
            </Reveal>
            <span className="hiw-dot"></span>
            <Reveal className="hiw-visual" delay={100}>
              <div className="hiw-panel">
                <div className="hiw-panel-head">
                  <span className="hiw-step-num">EMPLOYEE VIEW</span>
                  <span className="hiw-muted">Dashboard</span>
                </div>
                <div className="hiw-trust-row">
                  <div className="hiw-avatar">AM</div>
                  <div>
                    <b>Alex Morgan</b>
                    <span className="hiw-muted">Sr. Frontend Engineer · Referral</span>
                  </div>
                  <b className="hiw-score-num">87%</b>
                </div>
                <div className="hiw-stat-row">
                  <div className="hiw-stat">
                    <span className="hiw-muted">RISK</span>
                    <b className="green">Low</b>
                  </div>
                  <div className="hiw-stat">
                    <span className="hiw-muted">SKILLS</span>
                    <b>6/8</b>
                  </div>
                  <div className="hiw-stat">
                    <span className="hiw-muted">FIT</span>
                    <b>High</b>
                  </div>
                </div>
                <div className="hiw-jd-actions">
                  <button className="hiw-btn hiw-btn-accept">Accept Referral</button>
                  <button className="hiw-btn hiw-btn-light">Decline</button>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}