#!/usr/bin/env node
// Syncs canonical skills from skills/ into every provider plugin.
// Usage:
//   node scripts/sync.js          # write provider copies
//   node scripts/sync.js --check  # exit 1 if provider copies drift from skills/ (CI)

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const SOURCE = path.join(ROOT, 'skills')
const PROVIDER_SKILL_DIRS = [path.join(ROOT, 'providers', 'claude', 'plugin', 'skills')]

const CHECK = process.argv.includes('--check')

const listFiles = (dir, base = dir) => {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listFiles(full, base)
    return [path.relative(base, full)]
  })
}

const sourceFiles = listFiles(SOURCE).filter((f) => !f.endsWith('README.md') || f.includes(path.sep))

let drift = false

for (const target of PROVIDER_SKILL_DIRS) {
  const targetFiles = listFiles(target)

  for (const rel of sourceFiles) {
    const srcPath = path.join(SOURCE, rel)
    const dstPath = path.join(target, rel)
    const srcContent = fs.readFileSync(srcPath)
    const dstContent = fs.existsSync(dstPath) ? fs.readFileSync(dstPath) : null

    if (dstContent === null || !srcContent.equals(dstContent)) {
      drift = true
      if (CHECK) {
        console.error(`DRIFT: ${path.relative(ROOT, dstPath)} does not match ${path.relative(ROOT, srcPath)}`)
      } else {
        fs.mkdirSync(path.dirname(dstPath), { recursive: true })
        fs.writeFileSync(dstPath, srcContent)
        console.log(`synced ${path.relative(ROOT, dstPath)}`)
      }
    }
  }

  for (const rel of targetFiles) {
    if (!sourceFiles.includes(rel)) {
      drift = true
      if (CHECK) {
        console.error(`DRIFT: ${path.relative(ROOT, path.join(target, rel))} has no source in skills/`)
      } else {
        fs.rmSync(path.join(target, rel))
        console.log(`removed ${path.relative(ROOT, path.join(target, rel))}`)
      }
    }
  }
}

if (CHECK && drift) {
  console.error('\nProvider skill copies are out of sync. Run: node scripts/sync.js')
  process.exit(1)
}

if (!drift) console.log('provider skills in sync')
