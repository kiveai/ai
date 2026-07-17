# Skill evaluation

Skills added to this repository are evaluated as behavior, not just Markdown. Each suite follows the [Agent Skills eval loop](https://agentskills.io/skill-creation/evaluating-skills): realistic prompts, a fresh run with the skill, a fresh baseline run without it, objective assertions, benchmark aggregation, and human review.

## What lives where

- `skills/<skill>/evals/evals.json` contains 2–3 representative cases, expected outputs, human-readable assertions, and machine-readable tool assertions.
- `skills/<skill>/evals/files/` contains only input fixtures needed by those cases.
- `.eval-workspaces/iteration-*/` is generated locally with transcripts, outputs, grades, timing, and `benchmark.json`; it is gitignored.
- Eval files stay in the canonical `skills/` tree but are excluded from the published plugin and `/.well-known/skills` payload.

## Validate suites

Run this on every PR:

```bash
node scripts/validate-evals.js
node scripts/sync.js --check
```

Validation checks structure, unique ids, fixture paths, risk labels, and executable assertions. It does not prove model behavior.

## Run behavioral comparisons

Every selected case runs in a new Claude Code process twice: `with_skill` loads the Kive plugin, while `without_skill` disables skills.

Use a dedicated non-production workspace that satisfies the case's `preconditions`. Keep that workspace stable across both configurations so the only intended difference is the skill. Never use a personal or production workspace as an eval fixture.

Every behavioral run requires `--workspace-name` (or `KIVE_EVAL_WORKSPACE_NAME`). The runner injects that name into the prompt and tells the agent not to access other workspaces.

```bash
node scripts/run-skill-evals.js \
  --skill=kive-example \
  --workspace-name=kive-skill-evals \
  --url=http://127.0.0.1:3017/mcp
```

Replace `kive-example` with the skill directory name.

The runner defaults to Sonnet and a 90-second timeout so paired runs stay bounded. Override those with `--model` and `--timeout-ms`; use `--max-budget-usd` to set a per-run cost ceiling.

The runner refuses workspace mutations and credit-spending cases by default:

```bash
# Allows workspace mutations in a disposable non-production workspace
node scripts/run-skill-evals.js \
  --skill=kive-example \
  --case=example-write-case \
  --workspace-name=kive-skill-evals \
  --url=http://127.0.0.1:3017/mcp \
  --allow-writes

# Allows generations or edits that can spend credits
node scripts/run-skill-evals.js \
  --skill=kive-example \
  --case=example-generation-case \
  --workspace-name=kive-skill-evals \
  --url=http://127.0.0.1:3017/mcp \
  --allow-spend \
  --max-budget-usd=1.00 \
  --timeout-ms=420000
```

Video render cases can take several minutes. Keep the longer timeout so the
agent can poll `show_kive_video` through READY; a bounded timeout is an
infrastructure result, not evidence that the skill failed.

Remote endpoints require the explicit `--allow-remote` safety gate. Credential provisioning and hosted execution are outside this repository's scope. Do not run credit-spending cases against a personal or production workspace merely to populate a benchmark.

Runner or authentication failures are recorded with `status: "error"` and excluded from pass-rate deltas. Re-authenticate Claude Code before rerunning; never interpret an infrastructure error as a 0% skill-quality score.

## Review an iteration

For every case:

1. Compare `with_skill/response.txt` and `without_skill/response.txt` without looking at the directory names first.
2. Check `grading.json` evidence against `tool-calls.json` and the raw transcript.
3. Record concrete human feedback in a `feedback.json` beside the case. Empty feedback means the output was acceptable.
4. Inspect `benchmark.json` for pass-rate improvement and token/time cost.

Remove assertions that pass equally with and without the skill. Fix assertions that fail in both configurations before changing the skill. Improve the skill only when failures or human feedback reveal a generalizable gap, then rerun every case in a new iteration directory.

Before public launch, require all P0/P1 product-flow cases to pass with the skill, no credit-safety regression versus baseline, and empty human feedback for the final iteration.
