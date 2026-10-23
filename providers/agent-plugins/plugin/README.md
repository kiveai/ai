# Kive Agent Plugin

This directory packages the Kive ChatGPT integration in the [Agent Plugins 1.0](https://agent-plugins.org/) layout, following the [`stripe/ai` package](https://github.com/stripe/ai/tree/main/providers/agent-plugins/plugin/):

- `plugin.json` contains portable identity and `com.openai` presentation/review metadata.
- `mcp.json` connects to Kive's existing OAuth-protected remote server.
- `skills/` is generated from the repository's canonical [`skills/`](../../../skills/) directory.
- `assets/` contains the Kive logo used by the plugin interface.

Edit canonical skills in `skills/` at the repository root, then run `node scripts/sync.js`. Keep the manifest's version and user-facing copy in sync with the [published Kive ChatGPT app](https://chatgpt.com/plugins/plugin_asdk_app_6a5f329f776c819185906fea7ed52e9d).

The MCP service implementation, OAuth flow, tools, and widgets are maintained in `kiveai/kive` under `apps/mcp`. This package points clients at the live service; installing it does not deploy or change that service.
