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
            Explore how RefAI helps students prove their readiness and helps employees make confident referral decisions.
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
              <span className="score-pill">Live Preview</span>
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
                  Live
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
                      <b style={{ fontSize: '11px', display: 'block' }}>resume_alex.pdf</b>
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
                      <b style={{ display: 'block', fontSize: '11px' }}>Strong alignment</b>
                      <span className="action-muted-tag">Top 8% of applicants</span>
                    </div>
                  </div>
                  <div className="segment-bar" style={{ marginTop: '12px' }}>
                    <i className="filled"></i>
                    <i className="filled"></i>
                    <i className="filled"></i>
                    <i></i>
                  </div>
                </div>

                {/* Job description */}
                <div className="metric-card">
                  <div className="card-label-mono">Job Description</div>
                  <b style={{ display: 'block', marginTop: '8px', fontSize: '12px' }}>Sr. Frontend Engineer</b>
                  <span className="action-muted-tag">Helix Labs · Remote</span>
                  <p className="action-small-copy">5+ years React, TypeScript, system design experience...</p>
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
                  <p className="action-small-copy">Strong technical alignment. Missing Kubernetes &amp; AWS. Recommend learning plan before referral.</p>
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
                      <span className="missing-skill-tag">Critical</span>
                    </div>
                    <div className="mini-bar amber" style={{ width: '32%' }}></div>
                  </div>

                  <div className="missing-skill-row">
                    <div className="missing-skill-line">
                      <span>AWS</span>
                      <span className="missing-skill-tag">Moderate</span>
                    </div>
                    <div className="mini-bar amber" style={{ width: '55%' }}></div>
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
              <span className="score-pill">Verified</span>
            </div>

            <h3>Candidate Trust Card</h3>
            <p>A concise AI-generated summary that helps employees evaluate candidates in under 30 seconds.</p>

            <div className="product-panel action-panel" style={{ marginTop: '20px' }}>
              <div className="gate-row">
                <span className="card-label-mono">Trust Card</span>
                <span className="score-pill">Verified</span>
              </div>

              <div className="trust-person-row" style={{ marginTop: '18px' }}>
                <div className="avatar" style={{ background: '#eef2f7', color: 'var(--ink)' }}>AM</div>
                <div>
                  <b style={{ fontSize: '13px' }}>Alex Morgan</b>
                  <div className="action-muted-tag" style={{ marginTop: '2px' }}>Computer Engineering · Stanford</div>
                </div>
                <div className="score-ring">87</div>
              </div>

              <div className="stat-box-row">
                <div className="stat-box">
                  <span className="risk-stat-label">Confidence</span>
                  <span className="risk-stat-value">94%</span>
                </div>
                <div className="stat-box">
                  <span className="risk-stat-label">Tenure Fit</span>
                  <span className="risk-stat-value">High</span>
                </div>
                <div className="stat-box">
                  <span className="risk-stat-label">Culture</span>
                  <span className="risk-stat-value">Strong</span>
                </div>
              </div>

              <div className="metric-card" style={{ marginTop: '14px' }}>
                <div className="card-label-mono">Top Skills</div>
                <div className="skills" style={{ marginTop: '10px' }}>
                  <span className="skill skill-dark">React</span>
                  <span className="skill skill-dark">TypeScript</span>
                  <span className="skill skill-dark">System Design</span>
                  <span className="skill">GraphQL</span>
                </div>
              </div>

              <div className="metric-card" style={{ marginTop: '14px' }}>
                <div className="gate-row">
                  <span className="card-label-mono">Referral Risk</span>
                  <span className="mini-caption" style={{ marginTop: 0 }}>
                    <span className="live-dot" style={{ width: '6px', height: '6px' }}></span>
                    Low
                  </span>
                </div>
                <div className="risk-bar" style={{ marginTop: '12px' }}>
                  <i style={{ width: '92%', background: '#111827' }}></i>
                </div>
              </div>

              <div className="metric-card" style={{ marginTop: '14px' }}>
                <div className="gate-row">
                  <span className="card-label-mono">Referral Readiness</span>
                  <span className="gate-status" style={{ color: 'var(--ink)' }}>Ready</span>
                </div>
                <div className="gate-meter" style={{ marginTop: '12px' }}>
                  <i style={{ width: '96%' }}></i>
                </div>
              </div>

              <div className="action-signed-footer">
                <span className="action-signed-left">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2 4 5.5v6c0 5 3.4 8.4 8 10.5 4.6-2.1 8-5.5 8-10.5v-6Z"></path>
                    <path d="m9 12 2 2 4-4"></path>
                  </svg>
                  Signed by RefAI · Verifiable
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
                <span className="queue-new-badge">3 new</span>
              </div>
              <div className="queue-toggle">
                <button className="queue-toggle-btn">All</button>
                <button className="queue-toggle-btn active">Pending</button>
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
              {/* Alex Morgan */}
              <div className="candidate-row">
                <div className="candidate-head">
                  <div className="queue-avatar">AM</div>
                  <div className="candidate-info">
                    <b>Alex Morgan</b>
                    <span className="action-muted-tag">Sr. Frontend · Helix Labs</span>
                  </div>
                  <span className="queue-score queue-score-high">87%</span>
                </div>
                <div className="candidate-tags">
                  <span className="tag-risk tag-risk-low">Low Risk</span>
                  <span className="tag-skill">6/8 Skills</span>
                </div>
                <div className="candidate-actions">
                  <button className="cand-btn cand-btn-accept">Accept</button>
                  <button className="cand-btn cand-btn-decline">Decline</button>
                  <button className="cand-btn cand-btn-view">View</button>
                </div>
              </div>

              {/* Riya Patel */}
              <div className="candidate-row">
                <div className="candidate-head">
                  <div className="queue-avatar">RP</div>
                  <div className="candidate-info">
                    <b>Riya Patel</b>
                    <span className="action-muted-tag">Backend Eng · Meridian</span>
                  </div>
                  <span className="queue-score queue-score-high">91%</span>
                </div>
                <div className="candidate-tags">
                  <span className="tag-risk tag-risk-low">Low Risk</span>
                  <span className="tag-skill">8/8 Skills</span>
                </div>
                <div className="candidate-actions">
                  <button className="cand-btn cand-btn-accept">Accept</button>
                  <button className="cand-btn cand-btn-decline">Decline</button>
                  <button className="cand-btn cand-btn-view">View</button>
                </div>
              </div>

              {/* Jamie Kim */}
              <div className="candidate-row">
                <div className="candidate-head">
                  <div className="queue-avatar">JK</div>
                  <div className="candidate-info">
                    <b>Jamie Kim</b>
                    <span className="action-muted-tag">Full Stack · Atlas &amp; Co.</span>
                  </div>
                  <span className="queue-score queue-score-mid">74%</span>
                </div>
                <div className="candidate-tags">
                  <span className="tag-risk tag-risk-medium">Medium Risk</span>
                  <span className="tag-skill">5/8 Skills</span>
                </div>
                <div className="candidate-actions">
                  <button className="cand-btn cand-btn-accept disabled">Accept</button>
                  <button className="cand-btn cand-btn-decline">Decline</button>
                  <button className="cand-btn cand-btn-view">View</button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}