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

Pick the tool input based on where the product comes from — `create_product_in_kive` takes **exactly one source**:

| Source | What to do |
|---|---|
| Product already saved in Kive | `find_products` and use its id — don't recreate it |
| Ecommerce product page URL | `create_product_in_kive` with `productUrl` |
| Direct public image URL (jpg/png/webp/heic/avif) | `create_product_in_kive` with `imageUrl` |
| Local file / user photo | Upload contract: `create_product_image_upload_url` → upload (or `show_product_image_upload_widget` in hosts that render widgets) → `confirm_product_image_upload` → `create_product_in_kive` with the `uploadedImageHandle` |

Never use the upload tools when you already have a public URL. `create_product_in_kive` returns a **job id** — the product is set up asynchronously.

## 3. Recommend studios — then stop

Call `recommend_studios` with the **job id** from `create_product_in_kive` (it does not take a product id). Two things to know:

- If the job is still preparing, it returns NOT READY with a poll-again instruction — **keep calling it** until the studios are ready. Don't restart the product flow and don't switch tools.
- When ready, it renders a visual contact sheet of studio options and returns the `productId` plus studio ids. **Stop here.** Present the options and let the user choose. Do not call `generate_product_image` before the user has picked, even if one option seems obviously best.

For a product that already exists in Kive there is no job — resolve studios with `find_studios` instead. That's also the path when the user already named a specific studio up front; the checkpoint exists for when the choice is open.

## 4. Generate and render

- After the user picks, call `generate_product_image` with the `productId` and chosen `studioId`, putting the user's creative direction in `brief` (e.g. "subtle reflective surface"). Useful contract details: defaults to prefer are 4:5 aspect ratio, `premium` mode, and 1 sample; saved style/character models go in `modelIds` (resolve with `find_models` — never write model names as plain @ text in the brief); `estimateOnly: true` returns the credit cost without generating.
- This *starts* the generation — it does not display an image. `show_kive_image` owns the result card: call it with the `generationId` and workspace to render the finished image inline, and if it returns NOT_READY, **call it again about every 5 seconds** until the image renders. Never tell the user the image is ready without having rendered it. `check_image_generation_status` gives a plain status without rendering.

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
