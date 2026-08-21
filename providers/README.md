# Provider plugins

Plugins that package the Kive MCP server and skills for specific AI clients. Currently: [`claude/`](claude/) for the Claude Code plugin.

**Do not edit skill files in provider directories.** Skills under `providers/*/plugin/skills/` are generated from the canonical [`skills/`](../skills/) tree by [`scripts/sync.js`](../scripts/sync.js) — edit the source and run the sync; CI flags PRs where the copies drift.

Plugin manifests (`plugin.json`, `.mcp.json`) are hand-maintained. The plugin version lives only in `claude/plugin/.claude-plugin/plugin.json` — see [CONTRIBUTING.md](../CONTRIBUTING.md).
