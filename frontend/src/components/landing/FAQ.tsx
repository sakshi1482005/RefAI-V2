'use client'
import { useState } from 'react'

const FAQS = [
    {
        q: 'What is RefAI?',
        a: 'RefAI is an AI-assisted referral workflow. It compares a resume with job requirements and generates a Candidate Trust Card that organizes role fit, supporting evidence, and gaps for employee review.',
    },
    {
        q: 'How does RefAI work?',
        a: 'Upload your resume, select your target role, and let our AI analyze your profile. It evaluates your skills, experience, and job fit to generate a Trust Card that you can share with potential referrers.',
    },
    {
        q: 'What is the Candidate Trust Card?',
        a: 'The Candidate Trust Card is an AI-generated summary of role readiness. It highlights strengths, skill match, project evidence, and gaps so employees can begin with a structured overview and inspect the underlying resume claims.',
    },
    {
        q: 'Does RefAI guarantee a referral?',
        a: 'No. RefAI does not guarantee referrals or job offers. It helps candidates present relevant evidence and leaves every referral decision to the employee.',
    },
    {
        q: 'How does AI evaluate my resume?',
        a: 'Our AI compares your resume with the requirements of your chosen role, identifies relevant skills and experiences, detects missing competencies, and provides an overall job-fit assessment with actionable insights.',
    },
    {
        q: 'Is my resume and personal data secure?',
        a: 'The public demo uses fictional candidate data. For authenticated use, resume handling depends on the configured application services and privacy controls; avoid uploading sensitive information until you have reviewed the product’s data policy.',
    },
    {
        q: 'Can employees trust the AI analysis?',
        a: 'The Trust Card is designed to assist, not replace, human judgment. Its scores summarize the available inputs, while employees should inspect the cited resume evidence and make the final referral decision themselves.',
    },
    {
        q: 'Who can use RefAI?',
        a: 'RefAI is designed for students, recent graduates, job seekers, and employees who want a more structured, evidence-led referral conversation.',
    },
    {
        q: 'What makes RefAI different from LinkedIn?',
        a: 'LinkedIn helps you build a professional network. RefAI focuses specifically on referral readiness by using AI to evaluate candidate-job fit and generate trust-based insights that make referral decisions easier.',
    },
    {
        q: 'Is RefAI free to use?',
        a: 'The core features of RefAI are available for free. Additional AI-powered insights and premium features may be introduced in future releases.',
    },
]

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState<number>(0)

    const toggle = (i: number) => setOpenIndex((prev) => (prev === i ? -1 : i))

    return (
        <section id="faq">
            <div className="shell">
                <div className="section-head center fade">
                    <div className="eyebrow"><i></i> Got questions?</div>
                    <h2>Frequently asked questions</h2>
                    <p className="section-copy" style={{ margin: '14px auto 0' }}>
                        Practical details students and employees should understand before using RefAI for a referral review.
                    </p>
                </div>

                <div className="faq-list">
                    {FAQS.map((item, i) => {
                        const isOpen = openIndex === i
                        return (
                            <div className={`faq-item fade ${isOpen ? 'is-open' : ''}`} key={item.q}>
                                <button
                                    type="button"
                                    id={`faq-question-${i}`}
                                    className="faq-question"
                                    onClick={() => toggle(i)}
                                    aria-expanded={isOpen}
                                    aria-controls={`faq-answer-${i}`}
                                >
                                    <span className="faq-q-num">{String(i + 1).padStart(2, '0')}</span>
                                    <span className="faq-q-text">{item.q}</span>
                                    <span className="faq-icon" aria-hidden="true">
                                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                            <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                                        </svg>
                                    </span>
                                </button>
                                <div className="faq-answer-wrap" id={`faq-answer-${i}`} role="region" aria-labelledby={`faq-question-${i}`} aria-hidden={!isOpen}>
                                    <div className="faq-answer-inner">
                                        <p className="faq-answer">{item.a}</p>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="faq-cta fade">
                    <div>
                        <div className="faq-cta-title">Still have questions?</div>
                        <p className="faq-cta-copy">Reach out and our team will get back to you within a day.</p>
                    </div>
                    {/* TODO: Replace with a real support channel when one is configured. */}
                    <span className="btn btn-primary" aria-disabled="true" title="Contact support is not configured yet">Contact us</span>
                </div>
            </div>
        </section>
    )
}
