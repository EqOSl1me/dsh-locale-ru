/**
 * drift.mjs - measure Russian coverage against the dsh version actually installed.
 *
 * This is the script the upstream pack does not have, and the reason this
 * repository exists: `total` coverage numbers are meaningless without naming
 * the dsh revision they were measured against. This one resolves the real
 * installed version and reports exactly what is still English.
 *
 * Usage:
 *   node scripts/drift.mjs                 # report, exit 1 if anything is untranslated
 *   node scripts/drift.mjs --json          # machine-readable
 *   node scripts/drift.mjs --warn-only     # exit 0 even when coverage is incomplete
 *
 * How it finds the installed dsh: the DSH_HOME profile installs @deepseek-ai/dsh,
 * which pins the exact version. The corpus in upstream/corpus.json must have been
 * extracted from that same revision (scripts/extract.mjs records it).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)

const corpusPath = join(ROOT, 'upstream', 'corpus.json')
const dictDir = join(ROOT, 'dict', 'ru')
const metaPath = join(ROOT, 'upstream', 'meta.json')

if (!existsSync(corpusPath)) {
  console.error('drift: upstream/corpus.json not found - run scripts/extract.mjs first')
  process.exit(2)
}
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8'))
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : null

/* ---- resolve the installed dsh version ---- */

function readInstalledDsh() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const candidates = [
    join(home, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
    join(home, 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
  ]
  for (const p of candidates) {
    if (!existsSync(p)) continue
    try { return { path: p, version: JSON.parse(readFileSync(p, 'utf8')).version } } catch { /* keep looking */ }
  }
  return null
}

const installed = readInstalledDsh()

/* ---- load translated dictionaries ---- */

const dicts = {}
try {
  for (const f of readdirSync(dictDir)) {
    if (!f.endsWith('.json')) continue
    dicts[f.slice(0, -5)] = JSON.parse(readFileSync(join(dictDir, f), 'utf8'))
  }
} catch {
  console.error('drift: dict/ru/ not found')
  process.exit(2)
}

/* ---- permission-preset drift (cordis.patch.yml restates the base table) ---- */

/**
 * The patch row for "permission" replaces the whole config, so a preset the
 * base bundle adds later is silently hidden. Compare our restated ids with the
 * installed base bundle's own table.
 */
function presetIdsFromPatchYaml(file) {
  const text = readFileSync(file, 'utf8')
  const anchor = text.indexOf('- id: permission')
  if (anchor < 0) return null
  const lines = text.slice(anchor).split('\n')
  // Locate the presets: line inside this row (indentation differs between files).
  let presetsIndent = -1
  for (const line of lines) {
    if (/^\s*- id: \S/.test(line) && !line.includes('permission')) break
    const m = /^(\s*)presets:\s*$/.exec(line)
    if (m) { presetsIndent = m[1].length; break }
  }
  if (presetsIndent < 0) return null
  const ids = []
  for (const line of lines) {
    if (presetsIndent < 0) break
    const m = new RegExp('^ {' + (presetsIndent + 2) + '}([A-Za-z][A-Za-z0-9-]*):\\s*$').exec(line)
    if (m) ids.push(m[1])
  }
  return ids
}

function findBaseBundle() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const roots = [
    join(home, 'profiles', 'web', 'node_modules', '@deepseek-ai', 'dsh-base'),
    join(home, 'profiles', 'node_modules', '@deepseek-ai', 'dsh-base'),
    join(dirname(dirname(process.execPath)), 'node_modules', '@deepseek-ai', 'dsh-base'),
  ]
  for (const r of roots) {
    const p = join(r, 'cordis.patch.yml')
    if (existsSync(p)) return p
  }
  return null
}

const ourPatch = join(ROOT, 'cordis.patch.yml')
const basePatch = findBaseBundle()
const presetDrift = { ours: null, upstream: null, missing: [], extra: [] }
if (existsSync(ourPatch)) presetDrift.ours = presetIdsFromPatchYaml(ourPatch)
if (basePatch) presetDrift.upstream = presetIdsFromPatchYaml(basePatch)
if (presetDrift.ours && presetDrift.upstream) {
  presetDrift.missing = presetDrift.upstream.filter((id) => !presetDrift.ours.includes(id))
  presetDrift.extra = presetDrift.ours.filter((id) => !presetDrift.upstream.includes(id))
}

/* ---- compare ---- */

const rows = []
let translated = 0
let total = 0
const stale = {}

for (const ns of Object.keys(corpus).sort()) {
  const keys = Object.keys(corpus[ns])
  const dict = dicts[ns]
  const covered = dict ? keys.filter((k) => dict[k] !== undefined) : []
  const missing = keys.filter((k) => !dict || dict[k] === undefined)
  if (dict) {
    const staleKeys = Object.keys(dict).filter((k) => !(k in corpus[ns]))
    if (staleKeys.length) stale[ns] = staleKeys
  }
  translated += covered.length
  total += keys.length
  rows.push({ ns, total: keys.length, translated: covered.length, missing })
}

const pct = total === 0 ? 100 : Math.floor((translated / total) * 100)
const missingNamespaces = rows.filter((r) => r.translated === 0)
const partial = rows.filter((r) => r.translated > 0 && r.missing.length > 0)

if (has('--json')) {
  console.log(JSON.stringify({
    installedDsh: installed, corpusRevision: meta ? meta.revision : null,
    translated, total, percent: pct, missingNamespaces, partial, stale, presetDrift,
  }, null, 2))
  process.exit(pct === 100 || has('--warn-only') ? 0 : 1)
}

console.log('dsh-locale-ru drift report')
console.log('')
if (installed) console.log('  installed dsh : ' + installed.version + '  (' + installed.path + ')')
else console.log('  installed dsh : NOT FOUND (is dsh installed for this user?)')
if (meta) console.log('  corpus from   : ' + meta.revision + (meta.tag ? '  (' + meta.tag + ')' : ''))
if (installed && meta && meta.version && installed.version !== meta.version) {
  console.log('')
  console.log('  !! VERSION MISMATCH: the corpus was extracted from ' + meta.version)
  console.log('     but ' + installed.version + ' is installed. Re-run scripts/extract.mjs')
  console.log('     against the new revision before trusting these numbers.')
}
console.log('')
console.log('  coverage: ' + translated + '/' + total + ' = ' + pct + '%')
console.log('')

if (missingNamespaces.length) {
  console.log('Namespaces with NO Russian at all (show English):')
  for (const r of missingNamespaces) console.log('  ' + r.ns.padEnd(26) + String(r.total).padStart(4) + ' keys')
  console.log('')
}
if (partial.length) {
  console.log('Partially translated namespaces:')
  for (const r of partial) {
    const p = Math.floor((r.translated / r.total) * 100)
    console.log('  ' + r.ns.padEnd(26) + String(r.translated).padStart(4) + '/' + String(r.total).padEnd(5) + (p + '%').padStart(6))
    console.log('      missing: ' + r.missing.slice(0, 6).join(', ') + (r.missing.length > 6 ? ', ...' : ''))
  }
  console.log('')
}
if (presetDrift.missing.length) {
  console.log('PERMISSION PRESET DRIFT - the base bundle defines presets missing from cordis.patch.yml.')
  console.log('A patch row replaces the whole config, so these are HIDDEN from users:')
  for (const id of presetDrift.missing) console.log('  MISSING  ' + id)
  console.log('')
}
if (presetDrift.extra.length) {
  console.log('Presets in cordis.patch.yml that upstream no longer defines (stale):')
  for (const id of presetDrift.extra) console.log('  STALE    ' + id)
  console.log('')
}

if (Object.keys(stale).length) {
  console.log('Stale keys (in a dictionary, absent upstream - safe to delete):')
  for (const [ns, ks] of Object.entries(stale)) console.log('  ' + ns + ': ' + ks.join(', '))
  console.log('')
}
if (pct === 100 && presetDrift.missing.length === 0) {
  console.log('OK: every key in the corpus has a Russian translation.')
  process.exit(0)
}
if (presetDrift.missing.length) {
  console.log('INCOMPLETE: ' + presetDrift.missing.length + ' permission preset(s) hidden from users.')
  process.exit(1)
}
console.log('INCOMPLETE: ' + (total - translated) + ' key(s) still fall back to English.')
process.exit(has('--warn-only') ? 0 : 1)
