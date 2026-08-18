import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relativePath) => fs.readFileSync(path.join(frontendRoot, relativePath), 'utf8')
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = path.join(directory, entry.name)
  return entry.isDirectory() ? walk(fullPath) : [fullPath]
})

const navigation = read('src/lib/landingNavigation.ts')
const hero = read('src/components/landing/Hero.tsx')
const navbar = read('src/components/landing/Navbar.tsx')
const app = read('src/App.tsx')
const journey = read('src/components/landing/Journey.tsx')
const styles = read('src/styles/landing.css')
const vercel = JSON.parse(read('vercel.json'))

assert.match(hero, /to="\/auth"[^>]*>Get Started<\/Link>/, 'the primary CTA must open real authentication')
assert.match(navbar, /to="\/auth"[^>]*>Get Started<\/Link>/, 'the navigation CTA must open real authentication')
assert.match(hero, /What makes a RefAI Trust Card different\?/, 'the landing evidence preview must lead with product value')
assert.match(hero, /Verified Evidence[\s\S]*Explainable Intelligence[\s\S]*Referral Ready/, 'the landing preview must show the three concise Trust Card differentiators')
assert.doesNotMatch(hero, /Trust Score components/, 'the landing preview must not repeat a technical score breakdown')
assert.match(hero, /Example target companies[\s\S]*Illustrative examples only — no company affiliation implied/, 'company examples must be explicitly illustrative and disclose no affiliation')
assert.doesNotMatch(hero, /Target ·|Candidate ·|Reviewer ·/, 'the legacy target, candidate, and reviewer preview labels must be removed')
assert.match(hero, /renderCompanyMarqueeSet\('a'\)[\s\S]*renderCompanyMarqueeSet\('b'\)/, 'example companies must retain the original repeated marquee structure')
assert.match(styles, /logoMarqueeScroll 22s linear infinite/, 'example companies must retain the original marquee timing and direction')
assert.match(styles, /\.logo-marquee:hover \.logo-marquee-track[\s\S]*animation-play-state: paused/, 'the original marquee hover pause must remain')
assert.match(styles, /\.trust-difference\s*\{[\s\S]*border-top:[\s\S]*border-bottom:/, 'Trust Card differentiators must use an integrated divider-led treatment')
assert.doesNotMatch(navigation, /demo=1/, 'landing navigation must not preserve a legacy preview entry route')
assert.match(app, /scrollToLandingSection\(targetId\)/, 'direct hash navigation must use the shared smooth-scroll helper')
assert.match(journey, /<section id="how-it-works">/, 'the explanation section must have a stable target ID')
assert.match(styles, /#how-it-works[\s\S]*scroll-margin-top:\s*90px/, 'the target must account for the sticky header')
assert.deepEqual(vercel.rewrites, [{ source: '/(.*)', destination: '/index.html' }], 'Vercel must serve the SPA for direct application refreshes')
assert.match(hero, /supportsHover[\s\S]*prefersReducedMotion/, 'the Trust Card preview tilt must be disabled for touch and reduced-motion users')
assert.match(hero, /stage\.addEventListener\('mouseleave', resetParallax\)/, 'the Trust Card preview must return to neutral after hover')
assert.match(styles, /#trust-card-preview \.browser\s*\{[\s\S]*width:\s*min\(660px, 100%\)/, 'the Trust Card preview must retain its landscape desktop width')
assert.match(styles, /#trust-card-preview\s*\{[\s\S]*overflow:\s*visible/, 'the preview stage must not clip the card during tilt')

const sourceText = walk(path.join(frontendRoot, 'src'))
  .filter((file) => /\.(?:ts|tsx|js|jsx|css|html)$/.test(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
assert.doesNotMatch(sourceText, /drive\.google\.com|docs\.google\.com|google\s+drive/i, 'obsolete Google Drive demo links must not return')

console.log('Landing navigation assertions: 21 passed')
