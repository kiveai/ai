# Contributing

Contributions are welcome! If you've found a bug or have a feature request, please [open an issue](../../issues).

## Before you open a PR

1. [Fork](https://help.github.com/articles/fork-a-repo/) this repository and clone it locally.
2. Make your changes.
3. Run `node scripts/sync.js` so provider plugin copies stay in sync with `skills/`.
4. Submit a [pull request](https://help.github.com/articles/creating-a-pull-request-from-a-fork/).

## Where to edit what

- **Skills** are authored once in [`skills/`](skills/). The copies under `providers/*/plugin/skills/` and `well-known/` are **generated** by [`scripts/sync.js`](scripts/sync.js) — do not edit them directly; CI will flag PRs that drift from the source. The `well-known/skills/` tree is what kive.ai serves at `/.well-known/skills/` (vendored into the kive monorepo at `apps/web-public/public/.well-known/skills/`) so `npx skills add https://kive.ai` works — after changing skills, update that copy too.
- **Plugin manifests** (`.claude-plugin/`, `providers/*/plugin/`) are hand-maintained.
- The Kive MCP server itself is not in this repository. For issues with the hosted server at `https://mcp.kive.ai/mcp`, open an issue here and we will route it.

## Skill guidelines

Skills follow the [Agent Skills specification](https://agentskills.io/specification):

- Directory name matches the `name` frontmatter field (kebab-case, `kive-` prefix).
- `description` states both **what** the skill does and **when** to use it, with trigger keywords.
- Keep `SKILL.md` under 500 lines; move detailed material to `references/`.
- We deliberately keep the catalog small — a few high-quality skills beat many overlapping ones. New skill proposals should start as an issue.

Thanks for contributing to Kive! ✨
