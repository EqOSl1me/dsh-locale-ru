/**
 * smoke.mjs - load lib/client.js the way the browser does and assert that it
 * registers the Russian language and every dictionary against the real locale
 * API shape. This catches a bundle that is syntactically valid but registers
 * nothing, which a syntax check alone cannot see.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8')

const languages = []
const dictionaries = []
let applied = null
let injected = null

const locale = {
  addLanguage(l) { languages.push(l); return () => {} },
  register(ns, loc, dict) { dictionaries.push({ ns, loc, dict }); return () => {} },
}
const ctx = {
  locale,
  effect(fn, label) { fn(); return () => {} },
}

// The harness client-module loader: window.__ModuleLoader__.load({id, factory}).
let loaded = null
globalThis.window = {
  __ModuleLoader__: {
    load(spec) { loaded = spec },
  },
}

new Function(bundle)()
if (loaded === null) { console.error('FAIL: bundle did not call window.__ModuleLoader__.load'); process.exit(1) }
if (typeof loaded.id !== 'string' || loaded.id.length === 0) { console.error('FAIL: bundle has no id'); process.exit(1) }

const mod = loaded.factory(() => { throw new Error('unexpected require') })
applied = mod.apply
injected = mod.inject
if (typeof applied !== 'function') { console.error('FAIL: no apply export'); process.exit(1) }

applied(ctx)

/* ---- assertions ---- */

const errors = []
if (languages.length !== 1) errors.push('expected 1 addLanguage call, got ' + languages.length)
const lang = languages[0]
if (!lang) errors.push('no language registered')
else {
  if (lang.id !== 'ru') errors.push('language id is ' + JSON.stringify(lang.id) + ', expected "ru"')
  if (lang.fallback !== 'en') errors.push('fallback is ' + JSON.stringify(lang.fallback) + ', expected "en"')
  if (typeof lang.label !== 'string' || lang.label.length === 0) errors.push('language has no label')
}
if (!Array.isArray(injected) || !injected.includes('locale')) errors.push('inject must include "locale"')

const dictFiles = readdirSync(join(ROOT, 'dict', 'ru')).filter((f) => f.endsWith('.json'))
if (dictionaries.length !== dictFiles.length) {
  errors.push('registered ' + dictionaries.length + ' dictionaries, dict/ru/ has ' + dictFiles.length + ' files')
}
for (const d of dictionaries) {
  if (d.loc !== 'ru') errors.push('dictionary ' + d.ns + ' registered for locale ' + JSON.stringify(d.loc))
  if (Object.keys(d.dict).length === 0) errors.push('dictionary ' + d.ns + ' is empty')
}

if (errors.length) {
  console.error('smoke: FAIL')
  for (const e of errors) console.error('  ' + e)
  process.exit(1)
}

const keys = dictionaries.reduce((n, d) => n + Object.keys(d.dict).length, 0)
console.log('smoke: OK - ' + loaded.id)
console.log('  language   : ' + lang.id + ' (' + lang.label + '), fallback ' + lang.fallback)
console.log('  inject     : ' + injected.join(', '))
console.log('  dictionaries: ' + dictionaries.length + ' namespaces, ' + keys + ' keys')
