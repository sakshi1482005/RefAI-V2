import Reveal from './Reveal'

export default function Action() {
  return (
    <section id="see-in-action">
      <div className="shell">
        <Reveal as="div" className="section-head center">
          <h2>
            See RefAI in <em className="hero-serif-italic">Action</em>
          </h2>
          <p className="section-copy" style={{ margin: '14px auto 0' }}>
            Follow the sample outputs a student reviews before outreach and the evidence an employee checks before deciding.
          </p>
        </Reveal>

        <div className="card-grid card-grid-2">
          {/* Card 1 — AI Resume Analyzer */}
          <Reveal as="article" delay={0} className="feature-card action-card">
            <div className="action-card-head">
              <div className="feature-icon-outline">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-7-6Z"></path>
                  <path d="M13 2v6h6"></path>
                </svg>
              </div>
              <span className="score-pill">Demo Preview</span>
            </div>

            <h3>AI Resume Analyzer</h3>
            <p>Upload your resume and a target job description to receive an AI-powered match score, skill analysis, and personalized improvement roadmap.</p>

            <div className="product-panel action-panel" style={{ marginTop: '20px' }}>
              <div className="action-toolbar">
                <span className="traffic"></span>
                <span className="traffic"></span>
                <span className="traffic"></span>
                <span className="address-text">refai.app / analyze</span>
                <span className="analyzing-status">
                  <span className="analyzing-dot"></span>
                  Sample
                </span>
              </div>

              <div className="action-grid">
                {/* Resume file */}
                <div className="metric-card">
                  <div className="card-label-mono">Resume</div>
                  <div className="action-file-row">
                    <span className="panel-file-icon">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-7-6Z"></path>
                        <path d="M13 2v6h6"></path>
                      </svg>
                    </span>
                    <div>
                      <b style={{ fontSize: '11px', display: 'block' }}>Ananya_Rao_Atlassian_Resume.pdf</b>
                      <span className="action-muted-tag">248 KB</span>
                    </div>
                    <span className="action-check">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"></path>
                      </svg>
                    </span>
                  </div>
                </div>

                {/* Match score */}
                <div className="metric-card">
                  <div className="gate-row">
                    <span className="card-label-mono">Match Score</span>
                    <span className="action-muted-tag">vs JD #4821</span>
                  </div>
                  <div className="action-score-row">
                    <svg width="38" height="38" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="27" fill="none" stroke="#edf1f7" strokeWidth="8"></circle>
                      <circle
                        cx="32" cy="32" r="27" fill="none" stroke="#111827" strokeWidth="8"
                        strokeDasharray="169.6" strokeDashoffset="18" strokeLinecap="round"
                        transform="rotate(-90 32 32)"
                      ></circle>
                    </svg>
                    <div>
                      <b style={{ display: 'block', fontSize: '11px' }}>88% · Strong alignment</b>
                      <span className="action-muted-tag">6 of 8 sample requirements covered</span>
                    </div>
                  </div>
                  <div className="segment-bar" style={{ marginTop: '12px' }}>
                    <i className="filled"></i>
                    <i className="filled"></i>
                    <i className="filled"></i>
                    <i></i>
                  </div>
                  <p className="demo-score-why"><strong>Why 88%?</strong> React, FastAPI, SQL, and collaboration terms match the job description and appear in project evidence.</p>
                </div>

                {/* Job description */}
                <div className="metric-card">
                  <div className="card-label-mono">Job Description</div>
                  <b style={{ display: 'block', marginTop: '8px', fontSize: '12px' }}>Associate Software Engineer</b>
                  <span className="action-muted-tag">Atlassian · Product Platform</span>
                  <p className="action-small-copy">React, FastAPI, SQL, system design, and cross-functional ownership...</p>
                </div>

                {/* Matching skills */}
                <div className="metric-card">
                  <div className="gate-row">
                    <span className="card-label-mono">Matching Skills</span>
                    <span className="action-muted-tag">6/8</span>
                  </div>
                  <div className="skills" style={{ marginTop: '10px' }}>
                    <span className="skill skill-dark">React</span>
                    <span className="skill skill-dark">TypeScript</span>
                    <span className="skill skill-dark">System Design</span>
                    <span className="skill">GraphQL</span>
                    <span className="skill">Node.js</span>
                    <span className="skill">Testing</span>
                  </div>
                </div>

                {/* AI summary */}
                <div className="metric-card action-span-2">
                  <div className="card-label-mono">AI Summary</div>
                  <p className="action-small-copy">Ananya shows strong product-engineering alignment through React delivery, a FastAPI service used by 240 students, and SQL analytics work.</p>
                </div>

                {/* Missing skills */}
                <div className="metric-card action-span-2">
                  <div className="gate-row">
                    <span className="card-label-mono">Missing Skills</span>
                    <span className="action-gap-pill">2 gaps</span>
                  </div>

                  <div className="missing-skill-row" style={{ marginTop: '14px' }}>
                    <div className="missing-skill-line">
                      <span>Kubernetes</span>
                      <span className="missing-skill-tag">Not evidenced</span>
                    </div>
                    <div className="mini-bar amber" style={{ width: '72%' }}></div>
                  </div>

                  <div className="missing-skill-row">
                    <div className="missing-skill-line">
                      <span>AWS</span>
                      <span className="missing-skill-tag">Moderate</span>
                    </div>
                    <div className="mini-bar amber" style={{ width: '46%' }}></div>
                  </div>

                  <div className="action-footnote">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1Z"></path>
                      <rect x="5" y="4" width="14" height="17" rx="2"></rect>
                    </svg>
                    2-week learning plan generated
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Card 2 — Candidate Trust Card */}
          <Reveal as="article" delay={1} className="feature-card action-card">
            <div className="action-card-head">
              <div className="feature-icon-outline">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2 4 5.5v6c0 5 3.4 8.4 8 10.5 4.6-2.1 8-5.5 8-10.5v-6Z"></path>
                  <path d="m9 12 2 2 4-4"></path>
                </svg>
              </div>
              <span className="score-pill">Demo analysis</span>
            </div>

            <h3>Candidate Trust Card</h3>
            <p>A concise AI-generated summary that organizes candidate evidence and gaps for an employee’s review.</p>

            <div className="product-panel action-panel" style={{ marginTop: '20px' }}>
              <div className="gate-row">
                <span className="card-label-mono">Trust Card</span>
                <span className="score-pill">Sample output</span>
              </div>

              <div className="trust-person-row" style={{ marginTop: '18px' }}>
                <div className="avatar" style={{ background: '#eef2f7', color: 'var(--ink)' }}>AR</div>
                <div>
                  <b style={{ fontSize: '13px' }}>Ananya Rao · Demo</b>
                  <div className="action-muted-tag" style={{ marginTop: '2px' }}>Associate Software Engineer · Atlassian</div>
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

              <div className="metric-card" style={{ marginTop: '14px' }}>
                <div className="card-label-mono">Top Skills</div>
                <div className="skills" style={{ marginTop: '10px' }}>
                  <span className="skill skill-dark">React</span>
                  <span className="skill skill-dark">FastAPI</span>
                  <span className="skill skill-dark">SQL</span>
                  <span className="skill">Leadership</span>
                  <span className="skill">Problem Solving</span>
                </div>
              </div>

              <div className="metric-card" style={{ marginTop: '14px' }}>
                <div className="gate-row">
                  <span className="card-label-mono">Evidence Coverage</span>
                  <span className="mini-caption" style={{ marginTop: 0 }}>
                    <span className="live-dot" style={{ width: '6px', height: '6px' }}></span>
                    Strong sample
                  </span>
                </div>
                <div className="risk-bar" style={{ marginTop: '12px' }}>
                  <i style={{ width: '18%', background: '#111827' }}></i>
                </div>
              </div>

              <div className="metric-card" style={{ marginTop: '14px' }}>
                <div className="gate-row">
                  <span className="card-label-mono">Referral Readiness</span>
                  <span className="gate-status" style={{ color: 'var(--ink)' }}>91 · Demo</span>
                </div>
                <div className="gate-meter" style={{ marginTop: '12px' }}>
                  <i style={{ width: '91%' }}></i>
                </div>
                <p className="demo-score-why"><strong>Why 91?</strong> The sample has strong role alignment and repeated project evidence, while cloud and system-design depth remain open questions.</p>
              </div>

              <div className="action-signed-footer">
                <span className="action-signed-left">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2 4 5.5v6c0 5 3.4 8.4 8 10.5 4.6-2.1 8-5.5 8-10.5v-6Z"></path>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                  AI-generated demo · Evidence shown above
                </span>
                <span className="action-timestamp">2m ago</span>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Card 3 — Employee Dashboard */}
        <Reveal as="article" delay={2} className="feature-card action-card queue-card-span">
          <div className="action-card-head">
            <div className="feature-icon-outline">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
                <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
                <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
                <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
              </svg>
            </div>
          </div>

          <h3>Employee Dashboard</h3>
          <p>Employees review referral requests using Candidate Trust Cards instead of manually reading resumes.</p>

          <div className="product-panel action-panel queue-panel" style={{ marginTop: '20px' }}>
            <div className="queue-panel-head">
              <div className="queue-panel-title">
                <span className="card-label-mono">Referral Queue</span>
                <span className="queue-new-badge">1 new</span>
              </div>
              <div className="queue-toggle">
                <span className="queue-toggle-btn">All</span>
                <span className="queue-toggle-btn active">Pending</span>
              </div>
            </div>

            <div className="queue-search">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.3-4.3"></path>
              </svg>
              <span>Search candidates...</span>
            </div>

            <div className="queue-list">
              <div className="candidate-row">
                <div className="candidate-head">
                  <div className="queue-avatar">AR</div>
                  <div className="candidate-info">
                    <b>Ananya Rao</b>
                    <span className="action-muted-tag">Associate Software Engineer · Atlassian</span>
                  </div>
                  <span className="queue-score queue-score-high">91</span>
                </div>
                <div className="candidate-tags">
                  <span className="tag-risk tag-risk-low">Evidence review</span>
                  <span className="tag-skill">React · FastAPI · SQL</span>
                </div>
                <div className="candidate-actions">
                  <span className="cand-btn cand-btn-accept">Accept</span>
                  <span className="cand-btn cand-btn-decline">Decline</span>
                  <span className="cand-btn cand-btn-view">View</span>
                </div>
              </div>

            </div>
            <p className="demo-score-why"><strong>Meera Shah’s review:</strong> Ananya’s 91 Trust Score combines an 88% Resume Match, 93 ATS Score, and consistent React, FastAPI, SQL, and collaboration evidence.</p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
