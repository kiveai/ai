---
name: kive-product-video
description: Generate product videos with Kive via the Kive MCP server. Use when the user wants a product video, promo clip, ad creative, animated product shot, or video variations of a product — e.g. "make a video of this product", "slow zoom on the bottle", "create four video variations". Covers video presets, sampling multiple outputs, audio, and rendering the finished video.
license: MIT
metadata:
  author: kive
---

# Kive product videos

Kive animates a saved product into short product videos using **video presets** (camera moves and styles like a slow zoom or orbit). The flow mirrors the product-shot flow:

```
auth → workspace → product → pick preset(s) → generate → render result
```

All tools come from the Kive MCP server (`https://mcp.kive.ai/mcp`). If they're missing, point the user to https://kive.ai/mcp to connect it.

## 1. Start from a saved product

Videos are generated from a product that exists in Kive:

- Existing product → `find_products`.
- New product → follow the same product-creation steps as image generation (`create_product_in_kive` for URLs; the upload contract for local files). See the `kive-product-shots` skill for the full contract.

## 2. Choose video presets

- Browse options with `find_video_presets`. If the user described a motion ("slow zoom", "spin"), match it to a preset; if the choice is open, show a few presets and let the user pick rather than guessing.
- One request can use **up to four presets** and sample **up to four outputs**, so "give me four variations" is a single `generate_product_video` call — not four calls.

## 3. Generate and render

- `generate_product_video` starts the generation. Defaults: one video, audio on. Adjust only when the user asked (e.g. "no sound", "four variations").
- Video generation takes noticeably longer than images. `show_kive_video` owns the result: call it to render the finished video inline, and **call it again** if the video isn't ready yet. `check_video_generation_status` gives a plain status without rendering.
- Never tell the user the video is done without a successful `show_kive_video` render.

## Cost and permissions

Video generation spends workspace credits — typically more than images, and multiplied by the number of sampled outputs. If the user asks for many variations, confirm before spending. Relay credit/permission errors instead of retrying.

## Common failure modes to avoid

- Making N separate generation calls for N variations instead of sampling in one call.
- Guessing a preset when the user's intent is open — show options first.
- Claiming the video is ready without rendering it.
- Recreating the product when it already exists in the workspace.
