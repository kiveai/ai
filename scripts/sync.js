#!/usr/bin/env node
// Syncs canonical skills from skills/ into every provider plugin.
// Usage:
//   node scripts/sync.js          # write provider copies
//   node scripts/sync.js --check  # exit 1 if generated copies drift (CI)

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

// skills/README.md is repository documentation, not a runtime skill resource.
// Keep it in the canonical tree without publishing it into provider plugins.
const sourceFiles = listFiles(SOURCE).filter((file) => file !== 'README.md')

let drift = false

const syncFile = (dstPath, content) => {
  const current = fs.existsSync(dstPath) ? fs.readFileSync(dstPath) : null
  const next = Buffer.isBuffer(content) ? content : Buffer.from(content)
  if (current !== null && next.equals(current)) return

  drift = true
  if (CHECK) {
    console.error(`DRIFT: ${path.relative(ROOT, dstPath)} is out of date`)
  } else {
    fs.mkdirSync(path.dirname(dstPath), { recursive: true })
    fs.writeFileSync(dstPath, next)
    console.log(`synced ${path.relative(ROOT, dstPath)}`)
  }
}

const removeStale = (targetDir, expected) => {
  for (const rel of listFiles(targetDir)) {
    if (!expected.includes(rel)) {
      drift = true
      if (CHECK) {
        console.error(`DRIFT: ${path.relative(ROOT, path.join(targetDir, rel))} has no source in skills/`)
      } else {
        fs.rmSync(path.join(targetDir, rel))
        console.log(`removed ${path.relative(ROOT, path.join(targetDir, rel))}`)
      }
    }
  }
}

for (const target of PROVIDER_SKILL_DIRS) {
  for (const rel of sourceFiles) {
    syncFile(path.join(target, rel), fs.readFileSync(path.join(SOURCE, rel)))
  }
  removeStale(target, sourceFiles)
}

if (CHECK && drift) {
  console.error('\nGenerated copies are out of sync. Run: node scripts/sync.js')
  process.exit(1)
}

if (!drift) console.log('generated copies in sync')
