import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../src/', import.meta.url))
const forbidden = [/ATS Score/i, /ATS percentage/i, /resume ATS percentage/i, /ATS match/i, /hiring probability/i, /selection probability/i, /chance of selection/i]
async function files(dir) { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map(async entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat() }
const sourceFiles = (await files(root)).filter(file => /\.(tsx?|jsx?)$/.test(file))
const violations = []
for (const file of sourceFiles) { const text = await readFile(file, 'utf8'); for (const phrase of forbidden) if (phrase.test(text)) violations.push(file + ': ' + phrase) }
assert.deepEqual(violations, [], 'Forbidden user-facing product wording found:\n' + violations.join('\n'))
console.log('Forbidden user-facing ATS/probability wording: 0 occurrences')
