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

assert.match(navigation, /DEMO_ENTRY_PATH = '\/dashboard\?demo=1'/, 'the demo CTA must carry a direct-route fallback')
assert.match(hero, /to=\{DEMO_ENTRY_PATH\}[\s\S]*onClick=\{enterDemoMode\}/, 'the primary CTA must reuse Demo Mode and the fallback URL')
assert.match(navbar, /to=\{DEMO_ENTRY_PATH\}[\s\S]*onClick=\{enterDemoMode\}/, 'the navigation CTA must use the same demo entry')
assert.match(app, /scrollToLandingSection\(targetId\)/, 'direct hash navigation must use the shared smooth-scroll helper')
assert.match(journey, /<section id="how-it-works">/, 'the explanation section must have a stable target ID')
assert.match(styles, /#how-it-works[\s\S]*scroll-margin-top:\s*90px/, 'the target must account for the sticky header')
assert.deepEqual(vercel.rewrites, [{ source: '/(.*)', destination: '/index.html' }], 'Vercel must serve the SPA for direct demo refreshes')

const sourceText = walk(path.join(frontendRoot, 'src'))
  .filter((file) => /\.(?:ts|tsx|js|jsx|css|html)$/.test(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
assert.doesNotMatch(sourceText, /drive\.google\.com|docs\.google\.com|google\s+drive/i, 'obsolete Google Drive demo links must not return')

console.log('Landing navigation assertions: 8 passed')
