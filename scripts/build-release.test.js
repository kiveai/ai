const assert = require('node:assert/strict')
const { mkdtempSync, readFileSync, rmSync } = require('node:fs')
const { tmpdir } = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { gunzipSync } = require('node:zlib')

const { AGENT_SKILLS_SCHEMA, buildRelease, sha256 } = require('./build-release')

const readTarFiles = (archive) => {
  const tar = gunzipSync(archive)
  const files = new Map()
  let offset = 0

  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break

    const field = (start, length) =>
      header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '')
    const name = field(0, 100)
    const prefix = field(345, 155)
    const filePath = prefix ? `${prefix}/${name}` : name
    const size = Number.parseInt(field(124, 12).trim() || '0', 8)
    const contentStart = offset + 512
    files.set(filePath, tar.subarray(contentStart, contentStart + size))
    offset = contentStart + Math.ceil(size / 512) * 512
  }

  return files
}

test('builds deterministic RFC v0.2 release artifacts from canonical skills', () => {
  const root = path.join(__dirname, '..')
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'kive-agent-skills-release-'))
  const firstDist = path.join(temporaryRoot, 'first')
  const secondDist = path.join(temporaryRoot, 'second')

  try {
    const options = {
      root,
      releaseTag: 'v-test',
      githubServerUrl: 'https://github.com',
      githubRepository: 'kiveai/ai',
    }
    const firstIndex = buildRelease({ ...options, distDirectory: firstDist })
    const secondIndex = buildRelease({ ...options, distDirectory: secondDist })

    assert.equal(firstIndex.$schema, AGENT_SKILLS_SCHEMA)
    assert.deepEqual(firstIndex, secondIndex)
    assert.equal(firstIndex.skills.length, 1)

    const [skill] = firstIndex.skills
    assert.equal(skill.name, 'kive-build-campaign')
    assert.equal(skill.type, 'archive')
    assert.equal(
      skill.url,
      'https://github.com/kiveai/ai/releases/download/v-test/kive-build-campaign.tar.gz'
    )

    const firstArchive = readFileSync(firstDist + '/kive-build-campaign.tar.gz')
    const secondArchive = readFileSync(secondDist + '/kive-build-campaign.tar.gz')
    assert.deepEqual(firstArchive, secondArchive)
    assert.equal(skill.digest, sha256(firstArchive))

    const files = readTarFiles(firstArchive)
    assert.deepEqual([...files.keys()], ['SKILL.md', 'agents/openai.yaml'])
    assert.deepEqual(
      files.get('SKILL.md'),
      readFileSync(path.join(root, 'skills/kive-build-campaign/SKILL.md'))
    )
    assert.equal([...files.keys()].some((file) => file.startsWith('evals/')), false)

    assert.deepEqual(
      readFileSync(firstDist + '/index.json'),
      readFileSync(secondDist + '/index.json')
    )
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true })
  }
})
