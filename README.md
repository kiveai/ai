# Kive AI

This repo is the one-stop shop for using [Kive](https://kive.ai) with AI agents and LLMs.

Kive turns product photos into studio-quality images and videos. Connect the Kive MCP server to your favorite AI client and your agent can browse your workspace, set up products, pick studios, and generate product images and videos — right from chat.

## Model Context Protocol (MCP)

Kive hosts a remote MCP server at:

```
https://mcp.kive.ai/mcp
```

It uses OAuth, so connecting is just: add the connector, approve access with your Kive account, done. No API keys.

### Claude (claude.ai / Claude Desktop)

Add Kive from **Settings → Connectors**, or follow the [step-by-step guide](https://kive.ai/docs/mcp/connect-to-claude). See also [kive.ai/mcp/claude](https://kive.ai/mcp/claude).

### Claude Code

```bash
claude mcp add --transport http kive https://mcp.kive.ai/mcp
```

### ChatGPT app

Open [Kive in the ChatGPT app directory](https://chatgpt.com/plugins/plugin_asdk_app_6a5f329f776c819185906fea7ed52e9d), or search for **Kive** under **Settings → Apps & Connectors**. Select **Install**, sign in with your Kive account, then ask `Show my Kive workspaces` in a new chat to confirm it works. No developer mode or server URL is needed.

See [kive.ai/mcp/chatgpt](https://kive.ai/mcp/chatgpt) for the full walkthrough and available tools.

### Cursor

One-click install and setup instructions at [kive.ai/mcp/cursor](https://kive.ai/mcp/cursor).

### Other clients

Kive works with any MCP client that supports remote servers with OAuth. Guides with prefilled install links:

[Figma](https://kive.ai/mcp/figma) ·
[Canva](https://kive.ai/mcp/canva) ·
[Webflow](https://kive.ai/mcp/webflow) ·
[Framer](https://kive.ai/mcp/framer) ·
[n8n](https://kive.ai/mcp/n8n) ·
[Lovable](https://kive.ai/mcp/lovable) ·
[Zapier](https://kive.ai/mcp/zapier) ·
[Notion](https://kive.ai/mcp/notion) ·
[Windsurf](https://kive.ai/mcp/windsurf) ·
[v0](https://kive.ai/mcp/v0) ·
[Replit](https://kive.ai/mcp/replit) ·
[Gamma](https://kive.ai/mcp/gamma) ·
[Bolt](https://kive.ai/mcp/bolt)

Full list at [kive.ai/mcp](https://kive.ai/mcp).

## What agents can do with Kive

- Browse your workspaces, saved products, trained models, studios, video presets, and previous generations
- Create a saved product from a product page URL, a public image URL, or an uploaded photo
- Generate product images with Kive studios, and product videos with video presets
- Edit existing images ("put the product on a marble surface")
- Show finished images and videos inline while you iterate

Try prompts like:

- `Show the products in my Kive workspace`
- `Generate a product image for this product using a clean studio`
- `Make a product video with a slow zoom preset`
- `Edit this image so the product is on a marble surface`

Generations use your Kive workspace permissions and credits — the agent only gets access after you authorize the connector.

## Agent skills

[Agent skills](https://agentskills.io) are optional instructions that help agents use Kive for higher-level workflows that span multiple MCP tools.

Kive currently ships one deliberately focused skill:

- [`kive-build-campaign`](skills/kive-build-campaign/) turns a loose product campaign request into a coherent multi-format plan, grounds it in real Kive studios and presets, quotes the exact credit cost, and waits for approval before generating.

Install it with:

```bash
npx skills add kiveai/ai
```

See [`skills/`](skills/) for the published skill catalog.

### Claude Code plugin

The Kive plugin configures the remote MCP server and installs the campaign skill:

```bash
/plugin marketplace add kiveai/ai
/plugin install kive@kive
```

## Agent-readable docs

- [kive.ai/llms.txt](https://kive.ai/llms.txt) — capability map and agent guidance
- [kive.ai/docs](https://kive.ai/docs) — product documentation

## License

[MIT](LICENSE)
