import { useEffect, useRef } from 'react'

const MAX_TILT = 14 // degrees
const MAX_LIFT = 10 // px
const RESET_TRANSFORM = 'perspective(1200px) rotateY(-6deg) rotateX(4deg) translate3d(0,0,0)'

const MARQUEE_COMPANIES = ['Northwind', 'Linearly', 'Atlas & Co.', 'Helix Labs', 'Meridian', 'Quillmark']

export default function Hero() {
  const stageRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const floaterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stage = stageRef.current
    const card = cardRef.current
    const floater = floaterRef.current
    if (!stage || !card) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let raf: number | null = null

    const applyTilt = (clientX: number, clientY: number) => {
      const rect = card.getBoundingClientRect()
      const px = (clientX - rect.left) / rect.width // 0 - 1
      const py = (clientY - rect.top) / rect.height // 0 - 1
      const rotateY = (px - 0.5) * MAX_TILT * 2
      const rotateX = (0.5 - py) * MAX_TILT * 2
      const liftX = (px - 0.5) * MAX_LIFT
      const liftY = (py - 0.5) * MAX_LIFT

      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        card.style.transform =
          `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) ` +
          `rotateY(${rotateY.toFixed(2)}deg) translate3d(${liftX.toFixed(1)}px, ${liftY.toFixed(1)}px, 12px)`
        if (floater) {
          floater.style.transform = `translate3d(${(liftX * 0.6).toFixed(1)}px, ${(liftY * 0.6).toFixed(1)}px, 0)`
        }
      })
      card.classList.add('is-tilting')
    }

    const onMouseMove = (e: MouseEvent) => applyTilt(e.clientX, e.clientY)

    const onTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) applyTilt(touch.clientX, touch.clientY)
    }

    const onLeave = () => {
      if (raf) cancelAnimationFrame(raf)
      card.style.transform = RESET_TRANSFORM
      if (floater) floater.style.transform = 'translate3d(0,0,0)'
      card.classList.remove('is-tilting')
    }

    stage.addEventListener('mousemove', onMouseMove)
    stage.addEventListener('mouseleave', onLeave)
    stage.addEventListener('touchmove', onTouchMove, { passive: true })
    stage.addEventListener('touchend', onLeave)

    return () => {
      stage.removeEventListener('mousemove', onMouseMove)
      stage.removeEventListener('mouseleave', onLeave)
      stage.removeEventListener('touchmove', onTouchMove)
      stage.removeEventListener('touchend', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const renderMarqueeSet = (keyPrefix: string) => (
    <>
      {MARQUEE_COMPANIES.map((name, i) => (
        <span key={`${keyPrefix}-${i}`} className="logo-marquee-pair">
          <span className="logo-marquee-item">{name}</span>
          <span className="logo-marquee-dot">&#9670;</span>
        </span>
      ))}
    </>
  )

  return (
    <section className="hero">
      <div className="shell hero-grid">
        <div>
          <div className="eyebrow fade"><i></i> AI referral intelligence for student talent</div>
          <h1 className="fade delay-1">
            Turn your resume into a <em className="hero-serif-italic">trusted</em> referral.
          </h1>
          <p className="hero-copy fade delay-2">RefAI reads resumes and job descriptions, explains the fit, and creates an AI Trust Card so students ask with proof and employees review with confidence.</p>
          <div className="hero-actions fade delay-3">
            <a className="btn btn-primary" href="/dashboard">Analyze my Resume</a>
            <a className="btn btn-secondary" href="#demo">See how it Works!</a>
          </div>
          <div className="trust-strip fade delay-3" aria-label="Trust indicators">
            <div className="avatar-stack">
              <span className="mini-avatar"></span>
              <span className="mini-avatar"></span>
              <span className="mini-avatar"></span>
              <span className="mini-avatar count-badge">+2k</span>
            </div>
            <span className="trust-strip-text">Trusted by 2,400+ candidates &amp; referrers</span>
            <span className="trust-divider"></span>
            <span className="live-dot"></span>
            <span className="trust-strip-text">Live analysis</span>
          </div>
          <div className="hero-proof-strip fade delay-3" aria-label="RefAI proof metrics">
            <div><strong>91%</strong><span>role-fit signal</span></div>
            <div><strong>2 min</strong><span>employee review</span></div>
            <div><strong>5</strong><span>proof points</span></div>
          </div>
        </div>

        <div className="mockup-stage fade delay-2" id="demo" ref={stageRef}>
          <div className="browser" aria-label="RefAI Candidate Trust Card dashboard preview, tilts on hover" ref={cardRef}>
            <div className="browser-bar">
              <span className="traffic"></span><span className="traffic"></span><span className="traffic"></span>
              <span className="address-text">refai.app / candidate / trust-card</span>
              <span className="analyzing-status"><i className="analyzing-dot"></i>Analyzing</span>
            </div>
            <div className="dash">
              <aside className="side">
                <div className="side-title">Workspace</div>
                <div className="side-item active"><span className="tiny-icon"></span> Trust Card</div>
                <div className="side-item"><span className="tiny-icon"></span> Resume Scan</div>
                <div className="side-item"><span className="tiny-icon"></span> Companies</div>
                <div className="side-item"><span className="tiny-icon"></span> Requests</div>
                <div className="side-title" style={{ marginTop: '20px' }}>Signals</div>
                <div className="side-item"><span className="tiny-icon"></span> Skills</div>
                <div className="side-item"><span className="tiny-icon"></span> Projects</div>
              </aside>
              <div className="dash-main">
                <div className="dash-head">
                  <div>
                    <div className="dash-kicker">AI Trust Card</div>
                    <div className="dash-title">Backend Engineer Intern</div>
                    <div className="metric-label" style={{ marginTop: '6px', color: '#8891a0' }}>Stanford University</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="score-pill">Referral ready</div>
                    <div className="metric-label" style={{ marginTop: '8px', color: '#0e9368' }}>&#10003; Resume Uploaded</div>
                  </div>
                </div>
                <div className="dash-grid">
                  <div className="metric-card">
                    <div className="card-label-mono">Referral Risk</div>
                    <div className="score-pill" style={{ marginTop: '9px', display: 'inline-flex' }}>Low</div>
                    <div className="risk-stats">
                      <div>
                        <span className="risk-stat-label">Confidence</span>
                        <span className="risk-stat-value">94%</span>
                      </div>
                      <div>
                        <span className="risk-stat-label">Tenure fit</span>
                        <span className="risk-stat-value">High</span>
                      </div>
                      <div>
                        <span className="risk-stat-label">Culture</span>
                        <span className="risk-stat-value">Strong</span>
                      </div>
                    </div>
                    <div className="risk-bar"><i style={{ width: '30%' }}></i></div>
                    <div className="risk-bar-labels"><span>Low</span><span>Medium</span><span>High</span></div>
                  </div>
                  <div className="metric-card">
                    <div className="card-label-mono">Top Skills · 6 matched</div>
                    <div className="skills">
                      <span className="skill skill-dark">React</span>
                      <span className="skill skill-dark">TypeScript</span>
                      <span className="skill skill-dark">System Design</span>
                      <span className="skill">GraphQL</span>
                      <span className="skill">Node.js</span>
                      <span className="skill">Testing</span>
                    </div>
                    <div className="metric-label" style={{ marginTop: '13px' }}>Skill coverage &nbsp;87/100</div>
                    <div className="meter" style={{ marginTop: '7px' }}><i style={{ width: '87%', background: '#111827' }}></i></div>
                  </div>
                  <div className="readiness">
                    <div className="metric-card">
                      <div className="card-label-mono">Missing Skills · 2 gaps</div>
                      <div className="missing-skill-row" style={{ marginTop: '13px' }}>
                        <div className="missing-skill-line"><span>Kubernetes</span><span className="missing-skill-tag">Critical</span></div>
                        <div className="mini-bar amber" style={{ width: '70px' }}></div>
                      </div>
                      <div className="missing-skill-row" style={{ marginTop: '14px' }}>
                        <div className="missing-skill-line"><span>AWS</span><span className="missing-skill-tag">Moderate</span></div>
                        <div className="mini-bar amber" style={{ width: '40px' }}></div>
                      </div>
                    </div>
                    <div className="summary-card trust-footer">
                      <div className="trust-footer-icon">&#10003;</div>
                      <div>
                        <div className="trust-card-title">Candidate Trust Card</div>
                        <p className="summary-text" style={{ margin: '4px 0 0' }}>Verifiable · Signed by RefAI · Updated 2m ago</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>


        </div>
      </div>
      <div className="shell logo-marquee-wrap fade delay-3" aria-label="Companies using RefAI">
        <div className="logo-marquee-label-row">
          <span className="logo-marquee-label">Powering referrals at</span>
          <span className="logo-marquee-line"></span>
        </div>
        <div className="logo-marquee">
          <div className="logo-marquee-track">
            {renderMarqueeSet('a')}
            {renderMarqueeSet('b')}
          </div>
        </div>
      </div>
    </section>
  )
}