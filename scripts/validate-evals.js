#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const SKILLS_DIR = path.join(ROOT, 'skills')
const ALLOWED_RISKS = new Set([
  'read-only',
  'spends-credits',
  'spends-credits-if-incorrect',
  'writes-workspace',
])
const TOOL_ASSERTION_ARRAY_KEYS = ['forbidden', 'ordered', 'required']

const isRecord = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0

const addError = (errors, location, message) => {
  errors.push(`${location}: ${message}`)
}

const validateStringArray = ({ errors, location, value }) => {
  if (!Array.isArray(value) || value.some((item) => !isNonEmptyString(item))) {
    addError(errors, location, 'must be an array of non-empty strings')
    return false
  }

  return true
}

const validateToolAssertions = ({ assertions, errors, location }) => {
  if (!isRecord(assertions)) {
    addError(errors, location, 'must be an object')
    return
  }

  TOOL_ASSERTION_ARRAY_KEYS.forEach((key) => {
    if (key in assertions) {
      validateStringArray({
        errors,
        location: `${location}.${key}`,
        value: assertions[key],
      })
    }
  })

  if ('terminal' in assertions && !isNonEmptyString(assertions.terminal)) {
    addError(errors, `${location}.terminal`, 'must be a non-empty string')
  }

  if ('max_calls' in assertions) {
    if (!isRecord(assertions.max_calls)) {
      addError(errors, `${location}.max_calls`, 'must be an object')
    } else {
      Object.entries(assertions.max_calls).forEach(([tool, count]) => {
        if (!isNonEmptyString(tool) || !Number.isInteger(count) || count < 0) {
          addError(
            errors,
            `${location}.max_calls.${tool}`,
            'must be a non-negative integer'
          )
        }
      })
    }
  }

  const hasExecutableAssertion =
    TOOL_ASSERTION_ARRAY_KEYS.some(
      (key) => Array.isArray(assertions[key]) && assertions[key].length > 0
    ) ||
    isNonEmptyString(assertions.terminal) ||
    (isRecord(assertions.max_calls) &&
      Object.keys(assertions.max_calls).length > 0)

  if (!hasExecutableAssertion) {
    addError(errors, location, 'must include at least one executable assertion')
  }
}

const validateArgumentAssertions = ({ assertions, errors, location }) => {
  if (!Array.isArray(assertions)) {
    addError(errors, location, 'must be an array')
    return
  }

  assertions.forEach((assertion, index) => {
    const assertionLocation = `${location}[${index}]`
    if (!isRecord(assertion)) {
      addError(errors, assertionLocation, 'must be an object')
      return
    }
    if (!isNonEmptyString(assertion.tool)) {
      addError(errors, `${assertionLocation}.tool`, 'must be a non-empty string')
    }
    if (!Number.isInteger(assertion.call) || assertion.call < 1) {
      addError(errors, `${assertionLocation}.call`, 'must be a positive integer')
    }
    if ('includes' in assertion && !isRecord(assertion.includes)) {
      addError(errors, `${assertionLocation}.includes`, 'must be an object')
    }
    if ('absent' in assertion) {
      validateStringArray({
        errors,
        location: `${assertionLocation}.absent`,
        value: assertion.absent,
      })
    }
    const hasIncludes =
      isRecord(assertion.includes) && Object.keys(assertion.includes).length > 0
    const hasAbsent =
      Array.isArray(assertion.absent) && assertion.absent.length > 0
    if (!hasIncludes && !hasAbsent) {
      addError(
        errors,
        assertionLocation,
        'must include a non-empty includes object or absent array'
      )
    }
  })
}

const validateEval = ({ evalCase, evalIndex, evalPath, skillDir }) => {
  const errors = []
  const location = `${evalPath} evals[${evalIndex}]`
  if (!isRecord(evalCase)) {
    addError(errors, location, 'must be an object')
    return errors
  }

  ;['id', 'prompt', 'expected_output'].forEach((key) => {
    if (!isNonEmptyString(evalCase[key])) {
      addError(errors, `${location}.${key}`, 'must be a non-empty string')
    }
  })

  if (!Array.isArray(evalCase.files)) {
    addError(errors, `${location}.files`, 'must be an array')
  } else {
    evalCase.files.forEach((file, fileIndex) => {
      const fileLocation = `${location}.files[${fileIndex}]`
      if (!isNonEmptyString(file)) {
        addError(errors, fileLocation, 'must be a non-empty string')
        return
      }
      const filePath = path.join(skillDir, file)
      if (!fs.existsSync(filePath)) {
        addError(errors, fileLocation, `file does not exist: ${file}`)
      }
    })
  }

  validateStringArray({
    errors,
    location: `${location}.assertions`,
    value: evalCase.assertions,
  })
  if (Array.isArray(evalCase.assertions) && evalCase.assertions.length === 0) {
    addError(errors, `${location}.assertions`, 'must not be empty')
  }

  if ('preconditions' in evalCase) {
    validateStringArray({
      errors,
      location: `${location}.preconditions`,
      value: evalCase.preconditions,
    })
  }

  if (!ALLOWED_RISKS.has(evalCase.risk)) {
    addError(
      errors,
      `${location}.risk`,
      `must be one of ${[...ALLOWED_RISKS].join(', ')}`
    )
  }

  validateToolAssertions({
    assertions: evalCase.tool_assertions,
    errors,
    location: `${location}.tool_assertions`,
  })

  if ('argument_assertions' in evalCase) {
    validateArgumentAssertions({
      assertions: evalCase.argument_assertions,
      errors,
      location: `${location}.argument_assertions`,
    })
  }

  return errors
}

const validateEvalFile = ({ evalPath, skillName }) => {
  const relativeEvalPath = path.relative(ROOT, evalPath)
  const skillDir = path.join(SKILLS_DIR, skillName)
  const errors = []
  let payload

  try {
    payload = JSON.parse(fs.readFileSync(evalPath, 'utf8'))
  } catch (error) {
    return [`${relativeEvalPath}: invalid JSON: ${error.message}`]
  }

  if (!isRecord(payload)) {
    return [`${relativeEvalPath}: must contain a JSON object`]
  }
  if (payload.skill_name !== skillName) {
    addError(
      errors,
      `${relativeEvalPath}.skill_name`,
      `must match the skill directory (${skillName})`
    )
  }
  if (!Array.isArray(payload.evals) || payload.evals.length < 2) {
    addError(
      errors,
      `${relativeEvalPath}.evals`,
      'must contain at least two eval cases'
    )
    return errors
  }

  const ids = new Set()
  payload.evals.forEach((evalCase, evalIndex) => {
    errors.push(
      ...validateEval({
        evalCase,
        evalIndex,
        evalPath: relativeEvalPath,
        skillDir,
      })
    )
    if (isRecord(evalCase) && isNonEmptyString(evalCase.id)) {
      if (ids.has(evalCase.id)) {
        addError(
          errors,
          `${relativeEvalPath} evals[${evalIndex}].id`,
          `duplicate id: ${evalCase.id}`
        )
      }
      ids.add(evalCase.id)
    }
  })

  return errors
}

const skillNames = fs
  .readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

const results = skillNames.map((skillName) => {
  const evalPath = path.join(SKILLS_DIR, skillName, 'evals', 'evals.json')
  if (!fs.existsSync(evalPath)) {
    return {
      errors: [`${path.relative(ROOT, evalPath)}: missing eval suite`],
      skillName,
    }
  }

  return {
    errors: validateEvalFile({ evalPath, skillName }),
    skillName,
  }
})

const errors = results.flatMap((result) => result.errors)
if (errors.length > 0) {
  errors.forEach((error) => console.error(`ERROR: ${error}`))
  process.exit(1)
}

results.forEach(({ skillName }) => console.log(`ok ${skillName}`))
console.log(`validated ${results.length} skill eval suites`)
