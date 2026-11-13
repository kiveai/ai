# Kive plugin for Claude

Create product images and videos with [Kive](https://kive.ai) from a Claude conversation. Kive turns a product photo or product page into a saved product, then makes on-brand images from looks and ads you pick, and product videos from a short brief.

## What the plugin contains

- **The Kive connector.** `.mcp.json` points Claude at Kive's hosted MCP server, `https://mcp.kive.ai/mcp`. You sign in once with your Kive account through OAuth. There are no API keys to paste.
- **The `kive-build-campaign` skill.** It turns a loose campaign request into a plan with one shared visual direction, placement-specific assets and the credit cost, and waits for your approval before it generates anything.

The plugin has no hooks, scripts or local servers, so nothing runs on your machine. Everything Claude does with Kive goes through the connector, to your Kive workspace, with your Kive permissions.

## Install

In Claude Code:

```bash
claude plugin marketplace add kiveai/ai
claude plugin install kive@kive
```

Then run `/mcp` in Claude Code, select `plugin:kive:kive`, and sign in with your Kive account.

## Try it

- `Show the products in my Kive workspace`
- `Show me some looks for my face cream and let me pick one`
- `Plan a launch campaign for this product: a feed ad, a story and a short video`

## Credits and data

Generating images and videos uses credits from your Kive workspace. Claude tells you the cost before it spends them. Browsing your workspace, products, looks and ads is free.

The connector sends Kive what you ask Claude to do with it: the workspace you choose, the products and images you point it at, and your creative direction. See the [privacy policy](https://kive.ai/privacy) and [terms](https://kive.ai/terms).

## Help

- [Connect Kive to Claude](https://kive.ai/docs/mcp/connect-to-claude)
- [Manage and troubleshoot the connector](https://kive.ai/docs/mcp/manage-and-troubleshoot)
- Bugs and requests for this plugin: [github.com/kiveai/ai/issues](https://github.com/kiveai/ai/issues)

## License

[MIT](https://github.com/kiveai/ai/blob/main/LICENSE)
