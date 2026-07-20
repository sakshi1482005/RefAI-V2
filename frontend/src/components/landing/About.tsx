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
            From resume evidence to a clear <em className="hero-serif-italic">referral decision</em>
          </h2>
          <p className="section-copy" style={{ margin: '14px auto 0' }}>
            This demo shows where each score comes from and how students and employees use the same evidence at different steps.
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
            <p>Upload a resume and job description to generate a match score, skill analysis, and role-specific feedback.</p>

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
                    <b style={{ fontSize: '13px' }}>Ananya_Rao_Atlassian_Resume.pdf</b>
                    <div className="card-label-mono" style={{ marginTop: '3px' }}>Sample resume · Demo</div>
                  </div>
                </div>
                <span className="score-pill">Complete</span>
              </div>
              <div className="mini-metric-grid">
                <div className="metric-card">
                  <div className="card-label-mono">Match</div>
                  <div className="score" style={{ color: '#0e9368' }}>88<span>%</span></div>
                  <div className="meter"><i style={{ width: '88%', background: '#111827' }}></i></div>
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
                  <div className="mini-caption"><span className="live-dot" style={{ width: '6px', height: '6px' }}></span>Review suggested</div>
                </div>
              </div>
              <p className="demo-score-why"><strong>Why 88%?</strong> Six of eight target skills are supported by role-aligned project and experience evidence; system design and cloud depth remain weaker.</p>
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
            <p>Generate an AI-powered summary that organizes role fit, resume evidence, and open questions for employee review.</p>

            <div className="product-panel" style={{ marginTop: '20px' }}>
              <div className="trust-person-row">
                <div className="avatar" style={{ background: '#eef2f7', color: 'var(--ink)' }}>AR</div>
                <div>
                  <b style={{ fontSize: '14px' }}>Ananya Rao · Atlassian Demo</b>
                  <div className="metric-label" style={{ marginTop: '2px' }}>Trust Score: 91</div>
                </div>
                <div className="score-ring">91</div>
              </div>
              <div className="stat-box-row">
                <div className="stat-box">
                  <span className="risk-stat-label">Resume Match</span>
                  <span className="risk-stat-value">88%</span>
                </div>
                <div className="stat-box">
                  <span className="risk-stat-label">ATS Score</span>
                  <span className="risk-stat-value">93</span>
                </div>
                <div className="stat-box">
                  <span className="risk-stat-label">Reviewer</span>
                  <span className="risk-stat-value">Meera</span>
                </div>
              </div>
              <p className="demo-score-why"><strong>Why 91?</strong> Strong project evidence, ATS-friendly formatting, leadership, and team collaboration outweigh the missing cloud certification.</p>
              <div className="panel-footnote">&#10003; AI-generated demo · Review the source evidence</div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
