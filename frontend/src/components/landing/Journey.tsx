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
            Start with a resume, verify the analysis, generate a Trust Card, request a referral, and record the employee decision.
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
                    <b>Ananya_Rao_Atlassian_Resume.pdf</b>
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
                  <b>Associate Software Engineer</b>
                  <span className="hiw-muted">Atlassian · Product Platform</span>
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
                  <span className="hiw-btn hiw-btn-dark">Paste JD</span>
                  <span className="hiw-btn hiw-btn-light">Import URL</span>
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
                  <span className="hiw-muted">AI Engine · Demo</span>
                </div>
                <ul className="hiw-checklist">
                  <li className="done"><span className="hiw-check">✓</span>Parsing resume structure</li>
                  <li className="done"><span className="hiw-check">✓</span>Extracting skills &amp; experience</li>
                  <li className="done"><span className="hiw-check">✓</span>Comparing against JD</li>
                  <li className="active"><span className="hiw-radio"></span>Calculating match score...</li>
                </ul>
                <div className="hiw-progress"><i style={{ width: '88%' }}></i></div>
              </div>
            </Reveal>
          </div>

          {/* STEP 04 — panel left, text right */}
          <div className="hiw-row hiw-row--reverse">
            <Reveal className="hiw-text">
              <span className="hiw-step-num">STEP 04</span>
              <h3 className="hiw-step-title">Generate Candidate Trust Card</h3>
              <p className="hiw-step-desc">
                AI creates a concise Candidate Trust Card with a Match Score, skills found,
                supporting evidence, and a readiness summary for human review.
              </p>
            </Reveal>
            <span className="hiw-dot"></span>
            <Reveal className="hiw-visual" delay={100}>
              <div className="hiw-panel">
                <div className="hiw-panel-head">
                  <span className="hiw-step-num">TRUST CARD · DEMO</span>
                  <span className="hiw-uploaded-pill">Generated</span>
                </div>
                <div className="hiw-trust-row">
                  <div className="hiw-avatar">AR</div>
                  <div>
                    <b>Ananya Rao</b>
                    <span className="hiw-muted">Associate Software Engineer · Atlassian</span>
                  </div>
                  <div className="hiw-ring">91</div>
                </div>
                <div className="hiw-stat-row">
                  <div className="hiw-stat">
                    <span className="hiw-muted">MATCH</span>
                    <b>88%</b>
                  </div>
                  <div className="hiw-stat">
                    <span className="hiw-muted">EVIDENCE</span>
                    <b className="green">Strong</b>
                  </div>
                  <div className="hiw-stat">
                    <span className="hiw-muted">SKILLS</span>
                    <b>8 found</b>
                  </div>
                </div>
                <p className="demo-score-why"><strong>Why 91?</strong> The sample has strong React, FastAPI, SQL, leadership, and project evidence, with a smaller cloud-certification gap.</p>
                <div className="hiw-footnote">✓ AI-generated demo · Source evidence shown</div>
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
                  <span className="hiw-step-num">REFERRAL MESSAGE · DEMO</span>
                  <span className="hiw-muted">AI-generated</span>
                </div>
                <div className="hiw-msg-box">
                  Hi Meera, I’m applying for the Associate Software Engineer role at Atlassian. My demo profile shows an 88% Resume Match, 93 ATS Score, and 91 Trust Score, supported by React, FastAPI, SQL, and collaboration examples. Would you be open to reviewing my Trust Card?
                </div>
                <div className="hiw-jd-actions">
                  <span className="hiw-btn hiw-btn-dark">➤ Send Request</span>
                  <span className="hiw-btn hiw-btn-light">Edit</span>
                  <span className="hiw-btn hiw-btn-light">Copy</span>
                </div>
                <div className="hiw-inline-note">
                  <span className="hiw-live-dot"></span>Referral gate unlocked · Trust score 91
                </div>
                <p className="demo-score-why"><strong>Why unlocked?</strong> The 88% role match and repeated evidence exceed the sample referral-readiness threshold.</p>
              </div>
            </Reveal>
          </div>

          {/* STEP 06 — panel left, text right */}
          <div className="hiw-row hiw-row--reverse">
            <Reveal className="hiw-text">
              <span className="hiw-step-num">STEP 06</span>
              <h3 className="hiw-step-title">Employee Reviews</h3>
              <p className="hiw-step-desc">
                Employees review the Candidate Trust Card, inspect its supporting resume evidence,
                and then accept or decline the referral request.
              </p>
            </Reveal>
            <span className="hiw-dot"></span>
            <Reveal className="hiw-visual" delay={100}>
              <div className="hiw-panel">
                <div className="hiw-panel-head">
                  <span className="hiw-step-num">EMPLOYEE VIEW · DEMO</span>
                  <span className="hiw-muted">Dashboard</span>
                </div>
                <div className="hiw-trust-row">
                  <div className="hiw-avatar">AR</div>
                  <div>
                    <b>Ananya Rao</b>
                    <span className="hiw-muted">Associate Software Engineer · Atlassian</span>
                  </div>
                  <b className="hiw-score-num">91</b>
                </div>
                <div className="hiw-stat-row">
                  <div className="hiw-stat">
                    <span className="hiw-muted">EVIDENCE</span>
                    <b className="green">Strong</b>
                  </div>
                  <div className="hiw-stat">
                    <span className="hiw-muted">SKILLS</span>
                    <b>8 found</b>
                  </div>
                  <div className="hiw-stat">
                    <span className="hiw-muted">FIT</span>
                    <b>88%</b>
                  </div>
                </div>
                <p className="demo-score-why"><strong>Why 91?</strong> Role-aligned skills and measurable delivery evidence are strong; the remaining gaps are non-blocking for this sample role.</p>
                <div className="hiw-jd-actions">
                  <span className="hiw-btn hiw-btn-accept">Accept Referral</span>
                  <span className="hiw-btn hiw-btn-light">Decline</span>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}
