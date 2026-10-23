# Provider plugins

Plugins that package the Kive MCP server and skills for AI clients:

- [`claude/`](claude/) is the Claude Code plugin.
- [`agent-plugins/`](agent-plugins/plugin/) is the portable Agent Plugins package with Kive's ChatGPT presentation metadata. It follows the same layout as [Stripe's Agent Plugin](https://github.com/stripe/ai/tree/main/providers/agent-plugins/plugin).

**Do not edit skill files in provider directories.** Skills under `providers/*/plugin/skills/` are generated from the canonical [`skills/`](../skills/) tree by [`scripts/sync.js`](../scripts/sync.js) — edit the source and run the sync; CI flags PRs where the copies drift.

Plugin manifests are hand-maintained. The Claude and Agent Plugins packages have independent versions in their respective `plugin.json` files — see [CONTRIBUTING.md](../CONTRIBUTING.md).
