---
name: kive-library
description: Browse and reuse what's already in a Kive workspace via the Kive MCP server. Use when the user asks about their existing Kive content — workspaces, saved products, trained models, studios, video presets, or previous generations — e.g. "show my Kive products", "find my recent generations", "which studios do I have", "show that image again". Prefer this over recreating assets that already exist.
license: MIT
metadata:
  author: kive
---

# Kive library

The Kive workspace is a library: saved products, trained models, studios, video presets, and every previous generation. Before creating anything new, check whether it already exists — reusing a saved product or an earlier generation is instant and free, regenerating is not.

All tools come from the Kive MCP server (`https://mcp.kive.ai/mcp`).

## Finding things

| The user asks about | Tool |
|---|---|
| Their workspaces / which account | `list_workspaces` |
| Saved products | `find_products` |
| Trained models | `find_models` |
| Studios (image looks) | `find_studios` |
| Video presets (motions) | `find_video_presets` |
| Previous generations (images/videos) | `find_generations` |

- Call `list_workspaces` first if no workspace is established in the conversation; pass the workspace to the find tools.
- These are read-only and cheap — prefer a quick `find_*` over asking the user for ids they won't know.

## Showing things

Search results are text. To actually display an asset:

- `show_kive_image` renders an image inline; `show_kive_video` renders a video. Use them whenever the user wants to *see* something ("show me", "which one was it"), not just hear about it.
- These are the same render tools the generation flows use, so "show me the last one again" is one call, not a regeneration.

## Reuse over recreate

- User references a product that exists → use its id in generation flows; don't `create_product_in_kive` again.
- User wants "that image from yesterday, but on a white background" → `find_generations`, then `edit_image` on it (see the `kive-product-shots` skill), not a fresh generation from scratch.
- If auth fails, `check_kive_auth_status` explains how the user should log in / authorize.
