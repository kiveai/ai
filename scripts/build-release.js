#!/usr/bin/env node

const { createHash } = require('node:crypto')
const {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} = require('node:fs')
const path = require('node:path')
const { gzipSync } = require('node:zlib')

const AGENT_SKILLS_SCHEMA =
  'https://schemas.agentskills.io/discovery/0.2.0/schema.json'
const EXCLUDED_SKILL_DIRECTORIES = new Set(['evals'])
const SKILL_NAME_PATTERN = /^(?!.*--)[a-z0-9]+(?:-[a-z0-9]+)*$/
const TAR_BLOCK_SIZE = 512

const sha256 = (content) =>
  `sha256:${createHash('sha256').update(content).digest('hex')}`

const parseYamlScalar = (value, field, source) => {
  const trimmed = value.trim()

  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      throw new Error(`invalid quoted ${field} in ${source}`)
    }
  }

  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'")) {
      throw new Error(`invalid quoted ${field} in ${source}`)
    }
    return trimmed.slice(1, -1).replaceAll("''", "'")
  }

  if (/^[>|]/.test(trimmed)) {
    throw new Error(
      `${field} in ${source} must use a single-line YAML scalar for release publishing`
    )
  }

  return trimmed
}

const frontmatterField = (skillMd, field, source) => {
  if (!skillMd.startsWith('---\n') && !skillMd.startsWith('---\r\n')) {
    throw new Error(`${source} must start with YAML frontmatter`)
  }

  const closing = skillMd.match(/\r?\n---(?:\r?\n|$)/)
  if (!closing || closing.index === undefined) {
    throw new Error(`${source} has unclosed YAML frontmatter`)
  }

  const frontmatter = skillMd.slice(0, closing.index)
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))
  if (!match) throw new Error(`missing frontmatter field "${field}" in ${source}`)

  return parseYamlScalar(match[1], field, source)
}

const listRuntimeFiles = (directory, base = directory) =>
  readdirSync(directory, { withFileTypes: true })
    .sort((first, second) => first.name.localeCompare(second.name))
    .flatMap((entry) => {
      if (EXCLUDED_SKILL_DIRECTORIES.has(entry.name)) return []

      const absolutePath = path.join(directory, entry.name)
      const relativePath = path.relative(base, absolutePath).split(path.sep).join('/')
      const info = lstatSync(absolutePath)

      if (info.isSymbolicLink()) {
        throw new Error(`release skills may not contain symlinks: ${relativePath}`)
      }
      if (info.isDirectory()) return listRuntimeFiles(absolutePath, base)
      if (!info.isFile()) {
        throw new Error(`release skills must contain regular files: ${relativePath}`)
      }

      return [
        {
          path: relativePath,
          content: readFileSync(absolutePath),
          mode: statSync(absolutePath).mode & 0o111 ? 0o755 : 0o644,
        },
      ]
    })

const splitTarPath = (filePath) => {
  if (Buffer.byteLength(filePath) <= 100) return { name: filePath, prefix: '' }

  const separators = [...filePath.matchAll(/\//g)].map((match) => match.index)
  for (const separator of separators.reverse()) {
    const prefix = filePath.slice(0, separator)
    const name = filePath.slice(separator + 1)
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) {
      return { name, prefix }
    }
  }

  throw new Error(`release file path is too long for a portable tar archive: ${filePath}`)
}

const writeString = (buffer, value, offset, length) => {
  if (Buffer.byteLength(value) > length) {
    throw new Error(`tar header value is too long: ${value}`)
  }
  buffer.write(value, offset, length, 'utf8')
}

const writeOctal = (buffer, value, offset, length) => {
  const octal = value.toString(8)
  if (octal.length > length - 1) {
    throw new Error(`tar header number is too large: ${value}`)
  }
  writeString(buffer, `${octal.padStart(length - 1, '0')}\0`, offset, length)
}

const createTarHeader = ({ filePath, mode, size }) => {
  const header = Buffer.alloc(TAR_BLOCK_SIZE)
  const { name, prefix } = splitTarPath(filePath)

  writeString(header, name, 0, 100)
  writeOctal(header, mode, 100, 8)
  writeOctal(header, 0, 108, 8)
  writeOctal(header, 0, 116, 8)
  writeOctal(header, size, 124, 12)
  writeOctal(header, 0, 136, 12)
  header.fill(0x20, 148, 156)
  writeString(header, '0', 156, 1)
  writeString(header, 'ustar\0', 257, 6)
  writeString(header, '00', 263, 2)
  writeString(header, prefix, 345, 155)

  const checksum = header.reduce((total, byte) => total + byte, 0)
  writeString(
    header,
    `${checksum.toString(8).padStart(6, '0')}\0 `,
    148,
    8
  )

  return header
}

const createTarArchive = (files) => {
  const chunks = []

  for (const file of files) {
    chunks.push(
      createTarHeader({
        filePath: file.path,
        mode: file.mode,
        size: file.content.length,
      }),
      file.content
    )

    const padding = (TAR_BLOCK_SIZE - (file.content.length % TAR_BLOCK_SIZE)) % TAR_BLOCK_SIZE
    if (padding > 0) chunks.push(Buffer.alloc(padding))
  }

  chunks.push(Buffer.alloc(TAR_BLOCK_SIZE * 2))
  return Buffer.concat(chunks)
}

const buildRelease = ({
  root = path.join(__dirname, '..'),
  distDirectory = path.join(root, 'dist'),
  releaseTag = process.env.RELEASE_TAG,
  githubServerUrl = process.env.GITHUB_SERVER_URL ?? 'https://github.com',
  githubRepository = process.env.GITHUB_REPOSITORY ?? 'kiveai/ai',
} = {}) => {
  if (!releaseTag) {
    throw new Error('RELEASE_TAG is required')
  }

  const skillsDirectory = path.join(root, 'skills')
  const skillNames = readdirSync(skillsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  if (skillNames.length === 0) throw new Error('no skills found in skills/')

  rmSync(distDirectory, { recursive: true, force: true })
  mkdirSync(distDirectory, { recursive: true })

  const skills = skillNames.map((directoryName) => {
    const skillDirectory = path.join(skillsDirectory, directoryName)
    const skillSource = path.join(skillDirectory, 'SKILL.md')
    const skillMd = readFileSync(skillSource, 'utf8')
    const name = frontmatterField(skillMd, 'name', skillSource)
    const description = frontmatterField(skillMd, 'description', skillSource)

    if (name !== directoryName) {
      throw new Error(
        `skill frontmatter name "${name}" must match directory "${directoryName}"`
      )
    }
    if (name.length > 64 || !SKILL_NAME_PATTERN.test(name)) {
      throw new Error(`skill frontmatter contains an invalid name: ${name}`)
    }
    if (description.trim().length === 0 || description.length > 1024) {
      throw new Error(
        `skill frontmatter description must contain 1-1024 characters: ${name}`
      )
    }

    const files = listRuntimeFiles(skillDirectory).sort((first, second) => {
      if (first.path === 'SKILL.md') return -1
      if (second.path === 'SKILL.md') return 1
      return first.path.localeCompare(second.path)
    })
    if (!files.some((file) => file.path === 'SKILL.md')) {
      throw new Error(`${skillSource} is missing from its release archive`)
    }

    const archive = gzipSync(createTarArchive(files), { level: 9, mtime: 0 })
    const archiveName = `${name}.tar.gz`
    writeFileSync(path.join(distDirectory, archiveName), archive)

    const digest = sha256(archive)
    console.log(`built ${archiveName} (${digest})`)

    return {
      name,
      type: 'archive',
      description,
      url: `${githubServerUrl}/${githubRepository}/releases/download/${encodeURIComponent(
        releaseTag
      )}/${encodeURIComponent(archiveName)}`,
      digest,
    }
  })

  const index = { $schema: AGENT_SKILLS_SCHEMA, skills }
  writeFileSync(
    path.join(distDirectory, 'index.json'),
    `${JSON.stringify(index, null, 2)}\n`
  )
  console.log(`wrote index.json with ${skills.length} skill(s)`)

  return index
}

if (require.main === module) {
  try {
    buildRelease()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

module.exports = {
  AGENT_SKILLS_SCHEMA,
  buildRelease,
  createTarArchive,
  frontmatterField,
  sha256,
}
