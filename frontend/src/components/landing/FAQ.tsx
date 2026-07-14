'use client'
import { useState } from 'react'

const FAQS = [
    {
        q: 'What is RefAI?',
        a: 'RefAI is an AI-powered referral platform that connects students with professionals for trusted referrals. By analyzing your resume against job requirements, RefAI generates a Candidate Trust Card that helps employees make informed referral decisions quickly and confidently.',
    },
    {
        q: 'How does RefAI work?',
        a: 'Upload your resume, select your target role, and let our AI analyze your profile. It evaluates your skills, experience, and job fit to generate a Trust Card that you can share with potential referrers.',
    },
    {
        q: 'What is the Candidate Trust Card?',
        a: 'The Candidate Trust Card is an AI-generated summary of your professional readiness. It highlights your strengths, skill match, project experience, and overall fit, helping employees assess your profile in under a minute.',
    },
    {
        q: 'Does RefAI guarantee a referral?',
        a: 'No. RefAI does not guarantee referrals or job offers. It helps you present your profile more effectively and gives employees the information they need to make confident referral decisions.',
    },
    {
        q: 'How does AI evaluate my resume?',
        a: 'Our AI compares your resume with the requirements of your chosen role, identifies relevant skills and experiences, detects missing competencies, and provides an overall job-fit assessment with actionable insights.',
    },
    {
        q: 'Is my resume and personal data secure?',
        a: 'Yes. Your data is securely stored and processed using industry-standard security practices. Your information is only shared with people you choose to connect with.',
    },
    {
        q: 'Can employees trust the AI analysis?',
        a: 'The Trust Card is designed to assist, not replace, human judgment. It provides a concise, data-driven overview to help employees evaluate candidates faster while leaving the final referral decision entirely to them.',
    },
    {
        q: 'Who can use RefAI?',
        a: 'RefAI is designed for students, recent graduates, job seekers, and professionals who want to connect through trusted referrals while reducing uncertainty in the referral process.',
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
                        Everything students and employees want to know before trusting RefAI with a referral.
                    </p>
                </div>

                <div className="faq-list">
                    {FAQS.map((item, i) => {
                        const isOpen = openIndex === i
                        return (
                            <div className={`faq-item fade ${isOpen ? 'is-open' : ''}`} key={item.q}>
                                <button
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
                                <div className="faq-answer-wrap" id={`faq-answer-${i}`}>
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
                    <a className="btn btn-primary" href="mailto:hello@refai.example">Contact us</a>
                </div>
            </div>
        </section>
    )
}