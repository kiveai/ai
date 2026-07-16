---
name: kive-product-shots
description: Create studio-quality product images with Kive via the Kive MCP server. Use when the user wants product shots, product photography, ecommerce images, packshots, or lifestyle images of a product — from a product page URL, an image URL, an uploaded photo, or a product already saved in Kive. Covers the full flow, workspace selection, creating the product, letting the user pick a studio, generating, and rendering results.
license: MIT
metadata:
  author: kive
---

# Kive product shots

Kive turns a single product photo into studio-quality images. The flow has a fixed shape with one human checkpoint in the middle:

```
auth → workspace → product → recommend studios → ⏸ USER PICKS → generate → render result
```

All tools come from the Kive MCP server (`https://mcp.kive.ai/mcp`). If the tools are missing, tell the user to connect it first (guide: https://kive.ai/mcp).

## 1. Auth and workspace

- If a tool fails with an auth error, call `check_kive_auth_status` and follow its instructions (it points the user to log in / authorize). Don't retry blindly.
- Call `list_workspaces` before the first workspace-scoped action. If the user has one workspace, use it without asking. If several and the user hasn't specified, you may use the default, but mention which one you're using.

## 2. Create (or find) the product

Pick the tool based on where the product image comes from — this matters:

| Source | What to do |
|---|---|
| Product already in Kive | `find_products` and use its id — don't recreate it |
| Product page URL or public image URL | `create_product_in_kive` directly with the URL |
| Local file / user photo | Upload contract: `create_product_image_upload_url` → user uploads (or `show_product_image_upload_widget` in hosts that render widgets) → `confirm_product_image_upload` → `create_product_in_kive` |

Never use the upload tools when you already have a public URL.

## 3. Recommend studios — then stop

Call `recommend_studios` with the product. Two things to know:

- Product setup runs asynchronously. If the product isn't ready yet, `recommend_studios` reports that — **keep calling it again** until it returns studio options. Don't restart the product flow and don't switch tools.
- When it returns options, it renders a visual studio grid. **Stop here.** Present the options and let the user choose. Do not call `generate_product_image` before the user has picked a studio, even if one option seems obviously best.

If the user already named a specific studio up front, you can resolve it with `find_studios` and skip the recommendation checkpoint — the checkpoint exists for when the choice is open.

## 4. Generate and render

- After the user picks, call `generate_product_image` with the chosen studio (plus any user tweaks, e.g. "subtle reflective surface"). This *starts* the generation — it does not display an image.
- `show_kive_image` owns the result: call it to render the finished image inline. If the generation is still running, it says so — **call `show_kive_image` again** until the image actually renders. Never tell the user the image is ready without having rendered it. `check_image_generation_status` is available for plain status checks without rendering.

## 5. Iterate

- Tweaks to a finished image ("put it on marble", "remove the shadow") → `edit_image`, then render with `show_kive_image` (same retry rule).
- A different look → back to step 3/4 with another studio; the product is already set up, don't recreate it.
- Previous results → `find_generations`.

## Cost and permissions

Generations and edits spend the user's Kive workspace credits and run under their permissions. If Kive returns a credit or permission error, relay it and help the user pick a different workspace or option — don't retry the same call.

## Common failure modes to avoid

- **Wrong tool for the source**: using the upload contract for a URL, or vice versa.
- **Premature generation**: calling `generate_product_image` before the user picked a studio.
- **Claiming ready without rendering**: saying "your image is done" without a successful `show_kive_image` render.
- **Restarting the flow**: recreating the product or re-recommending studios when only the generation step needs retrying.
