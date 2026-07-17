#!/usr/bin/env node

const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const SKILLS_DIR = path.join(ROOT, 'skills')
const DEFAULT_URL = 'http://127.0.0.1:3017/mcp'
const SPEND_RISKS = new Set([
  'spends-credits',
  'spends-credits-if-incorrect',
])

const parseArgs = () => {
  const args = {
    allowRemote: false,
    allowSpend: false,
    allowWrites: false,
    caseIds: [],
    maxBudgetUsd: null,
    model: 'sonnet',
    out: path.join(
      ROOT,
      '.eval-workspaces',
      `iteration-${new Date().toISOString().replace(/[:.]/g, '-')}`
    ),
    skillNames: [],
    timeoutMs: 90_000,
    url: process.env.MCP_URL ?? DEFAULT_URL,
    workspaceName: process.env.KIVE_EVAL_WORKSPACE_NAME ?? null,
  }

  process.argv.slice(2).forEach((argument) => {
    if (argument === '--allow-remote') args.allowRemote = true
    else if (argument === '--allow-spend') args.allowSpend = true
    else if (argument === '--allow-writes') args.allowWrites = true
    else if (argument.startsWith('--case=')) {
      args.caseIds.push(argument.slice('--case='.length))
    } else if (argument.startsWith('--max-budget-usd=')) {
      args.maxBudgetUsd = argument.slice('--max-budget-usd='.length)
    } else if (argument.startsWith('--model=')) {
      args.model = argument.slice('--model='.length)
    } else if (argument.startsWith('--out=')) {
      args.out = path.resolve(argument.slice('--out='.length))
    } else if (argument.startsWith('--skill=')) {
      args.skillNames.push(argument.slice('--skill='.length))
    } else if (argument.startsWith('--timeout-ms=')) {
      args.timeoutMs = Number(argument.slice('--timeout-ms='.length))
    } else if (argument.startsWith('--url=')) {
      args.url = argument.slice('--url='.length)
    } else if (argument.startsWith('--workspace-name=')) {
      args.workspaceName = argument.slice('--workspace-name='.length)
    } else if (argument === '--help' || argument === '-h') {
      console.log(`Usage:
  node scripts/run-skill-evals.js --skill=kive-example --workspace-name=kive-skill-evals
  node scripts/run-skill-evals.js --skill=kive-example --workspace-name=kive-skill-evals --url=http://127.0.0.1:3017/mcp --allow-writes

Options:
  --skill=<name>          Run one skill. Repeat to run several. Defaults to all.
  --case=<id>             Run one eval id. Repeat to run several.
  --url=<mcp-url>         Kive MCP endpoint. Defaults to ${DEFAULT_URL}.
  --out=<directory>       Eval workspace output directory.
  --model=<model>         Claude model. Defaults to sonnet.
  --max-budget-usd=<n>    Per-run Claude Code budget cap.
  --timeout-ms=<n>         Per-run timeout. Defaults to 90000.
  --workspace-name=<name> Dedicated disposable eval workspace. Required.
  --allow-remote          Permit a non-loopback MCP endpoint.
  --allow-writes          Permit cases that create workspace data.
  --allow-spend           Permit cases that can spend Kive credits.

Every case runs in a fresh Claude Code process with the Kive plugin and again
with skills disabled. The runner refuses risky cases unless explicitly allowed.
`)
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  })

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1_000) {
    throw new Error('--timeout-ms must be a number of at least 1000')
  }
  if (!args.workspaceName?.trim() || /[\r\n]/.test(args.workspaceName)) {
    throw new Error(
      '--workspace-name is required and must name a dedicated disposable eval workspace'
    )
  }
  args.workspaceName = args.workspaceName.trim()

  return args
}

const isRecord = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isLoopbackUrl = (value) => {
  try {
    return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(
      new URL(value).hostname
    )
  } catch {
    return false
  }
}

const assertRemoteMcpAuthentication = ({ url }) => {
  if (isLoopbackUrl(url) || process.env.MCP_BEARER_TOKEN) return

  const result = spawnSync('claude', ['mcp', 'get', 'kive'], {
    encoding: 'utf8',
  })
  const output = [result.stdout, result.stderr].filter(Boolean).join('\n')
  if (result.status === 0 && output.includes('Status: ✔ Connected')) return

  throw new Error(
    [
      'The strict eval MCP entry is not authenticated.',
      'Run:',
      '  claude mcp add --scope user --transport http kive ' + url,
      '  claude mcp login kive',
      '  claude mcp get kive',
    ].join('\n')
  )
}

const normalizeToolName = (name) =>
  typeof name === 'string' ? name.replace(/^mcp__.*__/, '').trim() : ''

const readEvalSuite = (skillName) => {
  const evalPath = path.join(SKILLS_DIR, skillName, 'evals', 'evals.json')
  if (!fs.existsSync(evalPath)) throw new Error(`Missing ${evalPath}`)
  return JSON.parse(fs.readFileSync(evalPath, 'utf8'))
}

const listSkillNames = () =>
  fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

const ensureSelectedSkillsExist = (selectedSkillNames) => {
  const knownSkills = new Set(listSkillNames())
  selectedSkillNames.forEach((skillName) => {
    if (!knownSkills.has(skillName)) throw new Error(`Unknown skill: ${skillName}`)
  })
}

const riskAllowed = ({ allowSpend, allowWrites, risk }) => {
  if (SPEND_RISKS.has(risk)) return allowSpend
  if (risk === 'writes-workspace') return allowWrites || allowSpend
  return true
}

const buildMcpConfig = (url) => {
  const server = { type: 'http', url }
  if (process.env.MCP_BEARER_TOKEN) {
    server.headers = { Authorization: `Bearer ${process.env.MCP_BEARER_TOKEN}` }
  }
  return { mcpServers: { kive: server } }
}

const buildSkillOnlyPlugin = ({ parentDir, skillName }) => {
  const pluginDir = path.join(parentDir, `plugin-${skillName}`)
  const pluginMetadataDir = path.join(pluginDir, '.claude-plugin')
  const pluginSkillDir = path.join(pluginDir, 'skills', skillName)
  fs.mkdirSync(pluginMetadataDir, { recursive: true })
  fs.mkdirSync(pluginSkillDir, { recursive: true })
  fs.copyFileSync(
    path.join(SKILLS_DIR, skillName, 'SKILL.md'),
    path.join(pluginSkillDir, 'SKILL.md')
  )
  writeJson(path.join(pluginMetadataDir, 'plugin.json'), {
    description: `Isolated eval plugin for ${skillName}`,
    name: `kive-eval-${skillName}`,
    version: '0.0.0',
  })
  return pluginDir
}

const parseJsonLines = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })

const collectToolCalls = (value) => {
  if (Array.isArray(value)) return value.flatMap(collectToolCalls)
  if (!isRecord(value)) return []

  const current =
    value.type === 'tool_use' &&
    typeof value.name === 'string' &&
    value.name.startsWith('mcp__')
      ? [
          {
            arguments: isRecord(value.input) ? value.input : {},
            name: normalizeToolName(value.name),
          },
        ]
      : []
  return [...current, ...Object.values(value).flatMap(collectToolCalls)]
}

const includesOrderedSubsequence = ({ actual, expected }) => {
  let offset = 0
  return expected.every((expectedName) => {
    const index = actual.slice(offset).indexOf(normalizeToolName(expectedName))
    if (index === -1) return false
    offset += index + 1
    return true
  })
}

const valueIncludes = ({ actual, expected }) => {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.every((expectedItem) =>
        actual.some((actualItem) => valueIncludes({ actual: actualItem, expected: expectedItem }))
      )
    )
  }
  if (isRecord(expected)) {
    return (
      isRecord(actual) &&
      Object.entries(expected).every(([key, value]) =>
        valueIncludes({ actual: actual[key], expected: value })
      )
    )
  }
  return actual === expected
}

const gradeToolAssertions = ({ evalCase, toolCalls }) => {
  const assertions = evalCase.tool_assertions
  const toolNames = toolCalls.map((toolCall) => toolCall.name)
  const results = []
  const addResult = ({ evidence, passed, text }) => {
    results.push({ evidence, passed, text })
  }

  ;(assertions.required ?? []).forEach((toolName) => {
    const normalized = normalizeToolName(toolName)
    const passed = toolNames.includes(normalized)
    addResult({
      evidence: passed
        ? `Observed ${normalized}`
        : `Observed: ${toolNames.join(' -> ') || '<none>'}`,
      passed,
      text: `Calls ${normalized}`,
    })
  })

  ;(assertions.forbidden ?? []).forEach((toolName) => {
    const normalized = normalizeToolName(toolName)
    const passed = !toolNames.includes(normalized)
    addResult({
      evidence: `Observed: ${toolNames.join(' -> ') || '<none>'}`,
      passed,
      text: `Does not call ${normalized}`,
    })
  })

  if ((assertions.ordered ?? []).length > 0) {
    const passed = includesOrderedSubsequence({
      actual: toolNames,
      expected: assertions.ordered,
    })
    addResult({
      evidence: `Observed: ${toolNames.join(' -> ') || '<none>'}`,
      passed,
      text: `Calls in order: ${assertions.ordered.join(' -> ')}`,
    })
  }

  if (assertions.terminal) {
    const expected = normalizeToolName(assertions.terminal)
    const actual = toolNames.at(-1)
    addResult({
      evidence: `Terminal tool: ${actual ?? '<none>'}`,
      passed: actual === expected,
      text: `Terminal tool call is ${expected}`,
    })
  }

  Object.entries(assertions.max_calls ?? {}).forEach(([toolName, maxCalls]) => {
    const normalized = normalizeToolName(toolName)
    const count = toolNames.filter((name) => name === normalized).length
    addResult({
      evidence: `Observed ${count} call(s)`,
      passed: count <= maxCalls,
      text: `Calls ${normalized} no more than ${maxCalls} time(s)`,
    })
  })

  ;(evalCase.argument_assertions ?? []).forEach((assertion) => {
    const normalized = normalizeToolName(assertion.tool)
    const matchingCalls = toolCalls.filter(
      (toolCall) => toolCall.name === normalized
    )
    const toolCall = matchingCalls[assertion.call - 1]
    const includesPassed =
      !assertion.includes ||
      valueIncludes({
        actual: toolCall?.arguments,
        expected: assertion.includes,
      })
    const absentPassed = (assertion.absent ?? []).every(
      (key) => !Object.hasOwn(toolCall?.arguments ?? {}, key)
    )
    const passed = Boolean(toolCall && includesPassed && absentPassed)
    const expectation = [
      assertion.includes
        ? `includes ${JSON.stringify(assertion.includes)}`
        : null,
      assertion.absent?.length
        ? `omits ${JSON.stringify(assertion.absent)}`
        : null,
    ]
      .filter(Boolean)
      .join(' and ')
    addResult({
      evidence: toolCall
        ? `Arguments: ${JSON.stringify(toolCall.arguments)}`
        : `No call ${assertion.call} for ${normalized}`,
      passed,
      text: `${normalized} call ${assertion.call} ${expectation}`,
    })
  })

  const passed = results.filter((result) => result.passed).length
  return {
    assertion_results: results,
    summary: {
      failed: results.length - passed,
      pass_rate: results.length === 0 ? 0 : passed / results.length,
      passed,
      passed_all: passed === results.length,
      total: results.length,
    },
  }
}

const extractResult = (events) =>
  [...events].reverse().find((event) => event.type === 'result') ?? {}

const totalTokens = (usage) =>
  isRecord(usage)
    ? Object.entries(usage)
        .filter(([key, value]) => key.endsWith('_tokens') && Number.isFinite(value))
        .reduce((sum, [, value]) => sum + value, 0)
    : null

const extractResponseText = (events) => {
  const result = extractResult(events)
  if (typeof result.result === 'string') return result.result

  return events
    .filter(
      (event) =>
        event.type === 'assistant' && event.parent_tool_use_id == null
    )
    .flatMap((event) => collectTextBlocks(event.message?.content))
    .filter(Boolean)
    .at(-1) ?? ''
}

const getInfrastructureError = ({
  code,
  events,
  responseText,
  stderr,
  timedOut,
  toolCalls,
}) => {
  if (timedOut) return 'Claude Code eval run timed out.'
  const result = extractResult(events)
  if (result.subtype === 'error_max_budget_usd') {
    return 'Claude Code eval run exceeded the configured maximum budget.'
  }
  if (code !== 0) {
    return stderr.trim() || `Claude Code exited with code ${code}`
  }

  const kiveMcpFailed = events.some(
    (event) =>
      event.type === 'system' &&
      event.subtype === 'init' &&
      Array.isArray(event.mcp_servers) &&
      event.mcp_servers.some(
        (server) => server?.name === 'kive' && server?.status === 'failed'
      )
  )
  if (toolCalls.length === 0 && kiveMcpFailed) {
    return 'The Kive MCP server failed to initialize in the eval session.'
  }

  const authenticationBlocked = [
    /mcp server.*(?:isn't|is not) authorized/is,
    /mcp connector.*(?:isn't|is not) authorized/is,
    /mcp servers? require authentication/is,
    /requires authentication before .* tools can be used/is,
  ].some((pattern) => pattern.test(responseText))

  return toolCalls.length === 0 && authenticationBlocked
    ? 'Kive MCP authentication is unavailable in the non-interactive eval session.'
    : null
}

const collectTextBlocks = (value) => {
  if (Array.isArray(value)) return value.flatMap(collectTextBlocks)
  if (!isRecord(value)) return []
  const current = value.type === 'text' && typeof value.text === 'string' ? [value.text] : []
  return [...current, ...Object.values(value).flatMap(collectTextBlocks)]
}

const runClaude = ({
  config,
  evalCase,
  mcpConfigPath,
  model,
  maxBudgetUsd,
  runDir,
  timeoutMs,
  workspaceName,
}) =>
  new Promise((resolve) => {
    const skillDir = path.join(SKILLS_DIR, config.skillName)
    const fileLines = evalCase.files.map((file) =>
      path.join(skillDir, file)
    )
    const prompt = [
      'Execute this task using the Kive MCP connector:',
      `Use only the dedicated eval workspace named "${workspaceName}". Do not access any other workspace.`,
      evalCase.prompt,
      fileLines.length > 0 ? `Input files:\n${fileLines.join('\n')}` : null,
      evalCase.risk === 'read-only'
        ? null
        : `Save any produced files under: ${path.join(runDir, 'outputs')}`,
    ]
      .filter(Boolean)
      .join('\n\n')
    const commandArgs = [
      '-p',
      prompt,
      '--mcp-config',
      mcpConfigPath,
      '--strict-mcp-config',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'bypassPermissions',
      '--setting-sources',
      'local',
      '--no-session-persistence',
    ]

    if (config.name === 'with_skill') {
      commandArgs.push('--plugin-dir', config.pluginDir)
    } else {
      commandArgs.push('--disable-slash-commands')
    }
    const disallowedTools = ['Agent']
    if (evalCase.risk === 'read-only') {
      disallowedTools.push(
        'Bash',
        'Edit',
        'Write',
        'NotebookEdit',
        'WebFetch',
        'WebSearch'
      )
    }
    commandArgs.push('--disallowedTools', disallowedTools.join(','))
    if (model) commandArgs.push('--model', model)
    if (maxBudgetUsd) commandArgs.push('--max-budget-usd', maxBudgetUsd)

    fs.mkdirSync(path.join(runDir, 'outputs'), { recursive: true })
    const child = spawn('claude', commandArgs, {
      cwd: runDir,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let finished = false
    let timedOut = false
    const finish = (result) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      resolve(result)
    }
    const timeout = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
      setTimeout(() => {
        if (!finished) child.kill('SIGKILL')
      }, 5_000).unref()
    }, timeoutMs)
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', (error) =>
      finish({ code: -1, stderr: error.message, stdout, timedOut })
    )
    child.on('close', (code) => finish({ code, stderr, stdout, timedOut }))
  })

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

const stats = (values) => {
  const finiteValues = values.filter(Number.isFinite)
  if (finiteValues.length === 0) return { mean: null, stddev: null }
  const mean = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
  const variance =
    finiteValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    finiteValues.length
  return { mean, stddev: Math.sqrt(variance) }
}

const buildBenchmark = (runs) => {
  const summarize = (configuration) => {
    const matching = runs.filter((run) => run.configuration === configuration)
    const completed = matching.filter((run) => run.status === 'completed')
    return {
      completed_runs: completed.length,
      error_runs: matching.length - completed.length,
      pass_rate: stats(completed.map((run) => run.passRate)),
      time_seconds: stats(
        completed.map((run) =>
          Number.isFinite(run.durationMs) ? run.durationMs / 1000 : null
        )
      ),
      tokens: stats(completed.map((run) => run.totalTokens)),
      total_runs: matching.length,
    }
  }
  const withSkill = summarize('with_skill')
  const withoutSkill = summarize('without_skill')
  const delta = (metric) => {
    const withValue = withSkill[metric].mean
    const withoutValue = withoutSkill[metric].mean
    return Number.isFinite(withValue) && Number.isFinite(withoutValue)
      ? withValue - withoutValue
      : null
  }

  return {
    run_summary: {
      with_skill: withSkill,
      without_skill: withoutSkill,
      delta: {
        pass_rate: delta('pass_rate'),
        time_seconds: delta('time_seconds'),
        tokens: delta('tokens'),
      },
    },
  }
}

const main = async () => {
  const args = parseArgs()
  if (!isLoopbackUrl(args.url) && !args.allowRemote) {
    throw new Error('Refusing a non-loopback MCP URL without --allow-remote')
  }
  assertRemoteMcpAuthentication({ url: args.url })

  const selectedSkillNames =
    args.skillNames.length > 0 ? args.skillNames : listSkillNames()
  ensureSelectedSkillsExist(selectedSkillNames)

  const selectedCases = selectedSkillNames.flatMap((skillName) => {
    const suite = readEvalSuite(skillName)
    return suite.evals
      .filter(
        (evalCase) =>
          args.caseIds.length === 0 || args.caseIds.includes(evalCase.id)
      )
      .map((evalCase) => ({ evalCase, skillName }))
  })
  const knownCaseIds = new Set(selectedCases.map(({ evalCase }) => evalCase.id))
  const missingCaseIds = args.caseIds.filter((caseId) => !knownCaseIds.has(caseId))
  if (missingCaseIds.length > 0) {
    throw new Error(`Unknown eval case(s): ${missingCaseIds.join(', ')}`)
  }

  const blockedCases = selectedCases.filter(
    ({ evalCase }) => !riskAllowed({ ...args, risk: evalCase.risk })
  )
  if (blockedCases.length > 0) {
    const details = blockedCases
      .map(({ evalCase, skillName }) => `${skillName}/${evalCase.id} (${evalCase.risk})`)
      .join(', ')
    throw new Error(
      `Refusing risky eval cases: ${details}. Pass --allow-writes or --allow-spend as appropriate.`
    )
  }

  fs.mkdirSync(args.out, { recursive: true })
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kive-skill-evals-'))
  const mcpConfigPath = path.join(tempDir, 'mcp-config.json')
  writeJson(mcpConfigPath, buildMcpConfig(args.url))
  fs.chmodSync(mcpConfigPath, 0o600)
  const pluginDirs = Object.fromEntries(
    selectedSkillNames.map((skillName) => [
      skillName,
      buildSkillOnlyPlugin({ parentDir: tempDir, skillName }),
    ])
  )
  const benchmarkRuns = []

  try {
    for (const { evalCase, skillName } of selectedCases) {
      for (const configuration of ['with_skill', 'without_skill']) {
        const runDir = path.join(
          args.out,
          skillName,
          `eval-${evalCase.id}`,
          configuration
        )
        const result = await runClaude({
          config: {
            name: configuration,
            pluginDir: pluginDirs[skillName],
            skillName,
          },
          evalCase,
          maxBudgetUsd: args.maxBudgetUsd,
          mcpConfigPath,
          model: args.model,
          runDir,
          timeoutMs: args.timeoutMs,
          workspaceName: args.workspaceName,
        })
        fs.writeFileSync(path.join(runDir, 'transcript.jsonl'), result.stdout)
        fs.writeFileSync(path.join(runDir, 'stderr.log'), result.stderr)
        const events = parseJsonLines(result.stdout)
        const toolCalls = events.flatMap(collectToolCalls)
        const responseText = extractResponseText(events)
        const infrastructureError = getInfrastructureError({
          code: result.code,
          events,
          responseText,
          stderr: result.stderr,
          timedOut: result.timedOut,
          toolCalls,
        })
        const grading =
          !infrastructureError
            ? {
                ...gradeToolAssertions({ evalCase, toolCalls }),
                status: 'completed',
              }
            : {
                assertion_results: [
                  {
                    evidence: infrastructureError,
                    passed: false,
                    text: 'Eval infrastructure is available',
                  },
                ],
                status: 'error',
                summary: {
                  failed: 1,
                  pass_rate: null,
                  passed: 0,
                  passed_all: false,
                  total: 1,
                },
              }
        const resultEvent = extractResult(events)
        const timing = {
          duration_ms: Number.isFinite(resultEvent.duration_ms)
            ? resultEvent.duration_ms
            : null,
          total_cost_usd: Number.isFinite(resultEvent.total_cost_usd)
            ? resultEvent.total_cost_usd
            : null,
          total_tokens: totalTokens(resultEvent.usage),
          usage: isRecord(resultEvent.usage) ? resultEvent.usage : {},
        }
        fs.writeFileSync(
          path.join(runDir, 'response.txt'),
          `${responseText}\n`
        )
        writeJson(path.join(runDir, 'grading.json'), grading)
        writeJson(path.join(runDir, 'timing.json'), timing)
        writeJson(path.join(runDir, 'tool-calls.json'), toolCalls)
        benchmarkRuns.push({
          configuration,
          durationMs: timing.duration_ms,
          evalId: evalCase.id,
          passRate:
            grading.status === 'completed'
              ? grading.summary.passed_all
                ? 1
                : 0
              : null,
          skillName,
          status: grading.status,
          totalTokens: timing.total_tokens,
        })
        console.log(
          `${grading.status === 'error' ? 'ERROR' : grading.summary.failed === 0 ? 'PASS' : 'FAIL'} ${skillName}/${evalCase.id}/${configuration}`
        )
      }
    }
  } finally {
    fs.rmSync(tempDir, { force: true, recursive: true })
  }

  writeJson(path.join(args.out, 'benchmark.json'), buildBenchmark(benchmarkRuns))
  writeJson(path.join(args.out, 'runs.json'), benchmarkRuns)
  console.log(`wrote ${args.out}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
