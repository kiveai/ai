#!/usr/bin/env node
// Syncs canonical skills from skills/ into every provider plugin, and generates
// the .well-known/skills payload in agentskills.io discovery format, kept
// colocated here and ready to serve from a domain when we wire one up.
// Usage:
//   node scripts/sync.js          # write provider copies + well-known/skills
//   node scripts/sync.js --check  # exit 1 if generated copies drift (CI)

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const SOURCE = path.join(ROOT, 'skills')
const PROVIDER_SKILL_DIRS = [path.join(ROOT, 'providers', 'claude', 'plugin', 'skills')]
const WELL_KNOWN_DIR = path.join(ROOT, 'well-known', 'skills')

const CHECK = process.argv.includes('--check')

const listFiles = (dir, base = dir) => {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listFiles(full, base)
    return [path.relative(base, full)]
  })
}

// skills/README.md and eval suites are authoring inputs, not runtime skill
// resources. Keep them in the canonical tree without publishing them into
// provider plugins or the /.well-known/skills payload.
const sourceFiles = listFiles(SOURCE).filter(
  (file) => file !== 'README.md' && !file.split(path.sep).includes('evals')
)

const frontmatterField = (skillMd, field) => {
  const match = skillMd.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
  if (!match) throw new Error(`missing frontmatter field "${field}"`)
  return match[1].trim()
}

const buildIndex = () => {
  const skillDirs = fs
    .readdirSync(SOURCE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  const skills = skillDirs.map((dir) => {
    const skillMd = fs.readFileSync(path.join(SOURCE, dir, 'SKILL.md'), 'utf8')
    const files = sourceFiles
      .filter((rel) => rel.startsWith(dir + path.sep))
      .map((rel) => rel.slice(dir.length + 1).split(path.sep).join('/'))
      .sort((a, b) => (a === 'SKILL.md' ? -1 : b === 'SKILL.md' ? 1 : a.localeCompare(b)))
    return {
      name: frontmatterField(skillMd, 'name'),
      description: frontmatterField(skillMd, 'description'),
      files,
    }
  })

  // Short arrays are emitted inline so the payload matches Biome formatting in
  // consumers that vendor it (e.g. the kive monorepo).
  const json = JSON.stringify({ skills }, null, 2).replace(
    /\[\n\s+([^[\]]+?)\n\s+\]/gs,
    (match, body) => {
      const inline = `[${body
        .split('\n')
        .map((line) => line.trim())
        .join(' ')}]`
      return inline.length <= 70 ? inline : match
    }
  )
  return json + '\n'
}

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

for (const rel of sourceFiles) {
  syncFile(path.join(WELL_KNOWN_DIR, rel), fs.readFileSync(path.join(SOURCE, rel)))
}
syncFile(path.join(WELL_KNOWN_DIR, 'index.json'), buildIndex())
removeStale(WELL_KNOWN_DIR, [...sourceFiles, 'index.json'])

if (CHECK && drift) {
  console.error('\nGenerated copies are out of sync. Run: node scripts/sync.js')
  process.exit(1)
}

if (!drift) console.log('generated copies in sync')
