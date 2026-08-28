#!/usr/bin/env node

const { createHash } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} = require('node:fs')
const path = require('node:path')

const releaseTag = process.env.RELEASE_TAG
if (!releaseTag) throw new Error('RELEASE_TAG is required')

const root = path.join(__dirname, '..')
const skillsDirectory = path.join(root, 'skills')
const distDirectory = path.join(root, 'dist')
const repository = process.env.GITHUB_REPOSITORY ?? 'kiveai/ai'
const serverUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com'

rmSync(distDirectory, { recursive: true, force: true })
mkdirSync(distDirectory, { recursive: true })

const skills = readdirSync(skillsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(({ name }) => {
    const skillMd = readFileSync(
      path.join(skillsDirectory, name, 'SKILL.md'),
      'utf8'
    )
    const description = skillMd.match(/^description:\s*(.+)$/m)?.[1]
    if (!description) throw new Error(`Missing description for ${name}`)

    const archiveName = `${name}.tar.gz`
    const archivePath = path.join(distDirectory, archiveName)
    execFileSync('git', [
      'archive',
      '--format=tar.gz',
      `--output=${archivePath}`,
      `HEAD:skills/${name}`,
    ])

    const digest = createHash('sha256')
      .update(readFileSync(archivePath))
      .digest('hex')

    return {
      name,
      type: 'archive',
      description,
      url: `${serverUrl}/${repository}/releases/download/${releaseTag}/${archiveName}`,
      digest: `sha256:${digest}`,
    }
  })

const index = {
  $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
  skills,
}

writeFileSync(
  path.join(distDirectory, 'index.json'),
  `${JSON.stringify(index, null, 2)}\n`
)
console.log(`Built Agent Skills index with ${skills.length} skill(s)`)
