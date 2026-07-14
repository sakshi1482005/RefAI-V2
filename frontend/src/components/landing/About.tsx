import Reveal from './Reveal'

export default function About() {
  return (
    <section id="about">
      <div className="shell">
        <Reveal as="div" className="section-head center">
          <div className="eyebrow" style={{ margin: '0 auto 16px' }}>
            <span className="eyebrow-spinner">&#10042;</span> Platform Features
          </div>
          <h2>
            Everything You Need to Earn Referrals With <em className="hero-serif-italic">Confidence</em>
          </h2>
          <p className="section-copy" style={{ margin: '14px auto 0' }}>
            RefAI combines AI-powered resume analysis, trust scoring, and referral workflows into one seamless platform.
          </p>
        </Reveal>

        <div className="card-grid card-grid-2">
          <Reveal as="article" delay={0} className="feature-card">
            <div className="feature-icon-outline">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-7-6Z"></path>
                <path d="M13 2v6h6"></path>
              </svg>
            </div>
            <h3>AI Resume Analyzer</h3>
            <p>Upload your resume and a job description to instantly receive a match score, skill analysis, and personalized feedback.</p>

            <div className="product-panel" style={{ marginTop: '20px' }}>
              <div className="panel-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className="panel-file-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-7-6Z"></path>
                      <path d="M13 2v6h6"></path>
                    </svg>
                  </span>
                  <div>
                    <b style={{ fontSize: '13px' }}>resume_alex_morgan.pdf</b>
                    <div className="card-label-mono" style={{ marginTop: '3px' }}>Analyzed 3s ago</div>
                  </div>
                </div>
                <span className="score-pill">Complete</span>
              </div>
              <div className="mini-metric-grid">
                <div className="metric-card">
                  <div className="card-label-mono">Match</div>
                  <div className="score" style={{ color: '#0e9368' }}>87<span>%</span></div>
                  <div className="meter"><i style={{ width: '87%', background: '#111827' }}></i></div>
                </div>
                <div className="metric-card">
                  <div className="card-label-mono">Skills</div>
                  <div className="score">6<span>/8</span></div>
                  <div className="segment-bar">
                    <i className="filled"></i><i className="filled"></i><i className="filled"></i>
                    <i className="filled"></i><i className="filled"></i><i className="filled"></i>
                    <i></i><i></i>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="card-label-mono">Risk</div>
                  <div className="score" style={{ color: '#0e9368' }}>Low</div>
                  <div className="mini-caption"><span className="live-dot" style={{ width: '6px', height: '6px' }}></span>Safe to refer</div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal as="article" delay={1} className="feature-card">
            <div className="feature-icon-outline">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 5.5v6c0 5 3.4 8.4 8 10.5 4.6-2.1 8-5.5 8-10.5v-6Z"></path>
                <path d="m9 12 2 2 4-4"></path>
              </svg>
            </div>
            <h3>Candidate Trust Card</h3>
            <p>Generate an AI-powered trust summary that helps employees evaluate candidates in under 30 seconds.</p>

            <div className="product-panel" style={{ marginTop: '20px' }}>
              <div className="trust-person-row">
                <div className="avatar" style={{ background: '#eef2f7', color: 'var(--ink)' }}>AM</div>
                <div>
                  <b style={{ fontSize: '14px' }}>Alex Morgan</b>
                  <div className="metric-label" style={{ marginTop: '2px' }}>Trust Score: 87%</div>
                </div>
                <div className="score-ring">87</div>
              </div>
              <div className="stat-box-row">
                <div className="stat-box">
                  <span className="risk-stat-label">Confidence</span>
                  <span className="risk-stat-value">94%</span>
                </div>
                <div className="stat-box">
                  <span className="risk-stat-label">Tenure</span>
                  <span className="risk-stat-value">High</span>
                </div>
                <div className="stat-box">
                  <span className="risk-stat-label">Culture</span>
                  <span className="risk-stat-value">Strong</span>
                </div>
              </div>
              <div className="panel-footnote">&#10003; Verifiable · Signed by RefAI</div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}