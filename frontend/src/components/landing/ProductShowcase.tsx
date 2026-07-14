import Reveal from './Reveal'

export default function ProductShowcase() {
    return (
        <section id="product-showcase">
            <div className="shell">
                <div className="card-grid">
                    {/* Card 1 — Referral Readiness Gate */}
                    <Reveal as="article" delay={0} className="feature-card">
                        <div className="feature-icon-outline">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="5" y="11" width="14" height="10" rx="2"></rect>
                                <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
                            </svg>
                        </div>
                        <h3>Referral Readiness Gate</h3>
                        <p>Only referral-ready candidates unlock referral requests, encouraging skill improvement before outreach.</p>

                        <div className="product-panel gate-panel" style={{ marginTop: '16px' }}>
                            <div className="gate-row">
                                <span className="card-label-mono">Readiness</span>
                                <span className="gate-status">Unlocked</span>
                            </div>
                            <div className="gate-meter">
                                <i style={{ width: '92%' }}></i>
                            </div>
                            <div className="gate-checklist">
                                <div className="check-item">
                                    <span className="check-icon">
                                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6 9 17l-5-5"></path>
                                        </svg>
                                    </span>
                                    Skills verified
                                </div>
                                <div className="check-item">
                                    <span className="check-icon">
                                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6 9 17l-5-5"></path>
                                        </svg>
                                    </span>
                                    Score &ge; 80%
                                </div>
                            </div>
                        </div>
                    </Reveal>

                    {/* Card 2 — AI Referral Message Generator */}
                    <Reveal as="article" delay={1} className="feature-card">
                        <div className="feature-icon-outline">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"></path>
                            </svg>
                        </div>
                        <h3>AI Referral Message Generator</h3>
                        <p>Generate personalized, professional referral requests tailored to each company and employee.</p>

                        <div className="product-panel msg-panel" style={{ marginTop: '16px' }}>
                            <div className="msg-header">
                                <span className="card-label-mono">Generated Message</span>
                                <span className="msg-ai-badge">AI</span>
                            </div>
                            <div className="msg-box">
                                &ldquo;Hi Sarah, I&rsquo;d like to refer <b>Alex Morgan</b> for the Senior Frontend role. Their trust score is <b>87%</b> with strong React &amp; TypeScript skills&hellip;&rdquo;
                            </div>
                            <div className="msg-actions">
                                <button type="button" className="msg-btn msg-btn-primary">Copy</button>
                                <button type="button" className="msg-btn">Edit</button>
                                <button type="button" className="msg-btn">Regenerate</button>
                            </div>
                        </div>
                    </Reveal>

                    {/* Card 3 — Employee Dashboard */}
                    <Reveal as="article" delay={2} className="feature-card">
                        <div className="feature-icon-outline">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" rx="1"></rect>
                                <rect x="14" y="3" width="7" height="7" rx="1"></rect>
                                <rect x="3" y="14" width="7" height="7" rx="1"></rect>
                                <rect x="14" y="14" width="7" height="7" rx="1"></rect>
                            </svg>
                        </div>
                        <h3>Employee Dashboard</h3>
                        <p>Employees review Candidate Trust Cards instead of manually reading resumes, making referral decisions faster.</p>

                        <div className="product-panel queue-panel" style={{ marginTop: '16px' }}>
                            <span className="card-label-mono queue-label">Referral Queue</span>
                            <div className="queue-list">
                                <div className="queue-row">
                                    <div className="avatar queue-avatar">AM</div>
                                    <span className="queue-name">Alex Morgan</span>
                                    <span className="queue-score queue-score-high">87%</span>
                                </div>
                                <div className="queue-row">
                                    <div className="avatar queue-avatar">JK</div>
                                    <span className="queue-name">Jamie Kim</span>
                                    <span className="queue-score">74%</span>
                                </div>
                                <div className="queue-row">
                                    <div className="avatar queue-avatar">RP</div>
                                    <span className="queue-name">Riya Patel</span>
                                    <span className="queue-score queue-score-high">91%</span>
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>

                {/* Bottom row — 2-Week Learning Plan + CTA */}
                <div className="showcase-grid">
                    <Reveal as="article" delay={3} className="feature-card">
                        <div className="feature-icon-outline">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 2h6a1 1 0 0 1 1 1v1H8V3a1 1 0 0 1 1-1Z"></path>
                                <rect x="5" y="4" width="14" height="17" rx="2"></rect>
                                <path d="m9 12 2 2 4-4"></path>
                            </svg>
                        </div>
                        <h3>2-Week Learning Plan</h3>
                        <p>Receive an AI-generated roadmap highlighting missing skills and practical steps to improve your readiness.</p>

                        <div className="product-panel roadmap-panel" style={{ marginTop: '16px' }}>
                            <div className="roadmap-header">
                                <span className="card-label-mono">Week 1-2 Roadmap</span>
                                <span className="roadmap-progress-text">3 of 8 complete</span>
                            </div>

                            <div className="roadmap-list">
                                <div className="roadmap-item completed">
                                    <span className="roadmap-check">
                                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6 9 17l-5-5"></path>
                                        </svg>
                                    </span>
                                    <span className="roadmap-task">System Design Basics</span>
                                    <span className="roadmap-hours">2h</span>
                                </div>
                                <div className="roadmap-item completed">
                                    <span className="roadmap-check">
                                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6 9 17l-5-5"></path>
                                        </svg>
                                    </span>
                                    <span className="roadmap-task">React Testing Library</span>
                                    <span className="roadmap-hours">3h</span>
                                </div>
                                <div className="roadmap-item completed">
                                    <span className="roadmap-check">
                                        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6 9 17l-5-5"></path>
                                        </svg>
                                    </span>
                                    <span className="roadmap-task">GraphQL Fundamentals</span>
                                    <span className="roadmap-hours">4h</span>
                                </div>
                                <div className="roadmap-item next">
                                    <span className="roadmap-radio"></span>
                                    <span className="roadmap-task">Kubernetes in Production</span>
                                    <span className="roadmap-next-tag">Next</span>
                                </div>
                                <div className="roadmap-item disabled">
                                    <span className="roadmap-radio disabled"></span>
                                    <span className="roadmap-task">AWS Solutions Architect</span>
                                    <span className="roadmap-hours">6h</span>
                                </div>
                            </div>

                            <div className="roadmap-progress-bar">
                                <i style={{ width: '37.5%' }}></i>
                            </div>
                        </div>
                    </Reveal>

                    <Reveal as="div" delay={3} soft className="showcase-cta-box">
                        <div className="showcase-cta-top">
                            <h2 className="showcase-cta-heading">
                                Ready to turn your resume into a <em className="hero-serif-italic">trusted</em> referral?
                            </h2>
                            <p className="showcase-cta-copy">
                                Join 2,400+ candidates and employees already using RefAI to make smarter referral decisions.
                            </p>
                        </div>
                        <div className="showcase-cta-actions">
                            <button type="button" className="btn showcase-btn-primary">
                                Analyze My Resume
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14"></path>
                                    <path d="m12 5 7 7-7 7"></path>
                                </svg>
                            </button>
                            <button type="button" className="btn showcase-btn-secondary">See How It Works</button>
                        </div>
                    </Reveal>
                </div>
            </div>
        </section>
    )
}