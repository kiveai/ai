---
name: kive-build-campaign
description: Plan and produce cohesive multi-asset product campaigns with Kive through its MCP server. Use when the user asks for a product launch, campaign, ad set, social content package, creative concepts, multiple placements, or coordinated product images and videos. Turn a loose marketing goal into placement-specific briefs, ground options in real Kive studios and presets, estimate the exact credit cost, get approval before spending, and keep the visual direction consistent across assets.
---

# Build a Kive campaign

Turn a loose campaign request into a decision-ready plan and, after approval, finished Kive assets. Add campaign judgment and cross-tool coordination; rely on the Kive MCP tool descriptions for individual call contracts.

## 1. Resolve the brief

- Use details already supplied. Ask only for missing information that would materially change the work: product, audience or goal, placement, offer, and non-negotiable brand constraints.
- Resolve the workspace and saved product with `list_workspaces` and `find_products`. If multiple products match, ask the user to choose before planning assets.
- Ground product facts in Kive results or the user's words. Do not invent claims, ingredients, packaging details, logos, or promotional copy.

## 2. Establish one campaign spine

Define a compact shared direction before specifying assets:

- **Goal and audience:** what response the creative should drive.
- **Product truth:** the real feature or visual detail to protect.
- **Visual hook:** the one memorable scene idea.
- **Look:** mood, palette, light, materials, and composition.
- **Continuity:** the motif that should recur across stills and videos.
- **Constraints:** details, claims, or treatments to avoid.

When exploring alternatives, honor the user's requested count; otherwise create three directions that test meaningfully different visual hooks. Change one strategic variable at a time and explain the tradeoff; do not present near-duplicate prompt wording as separate concepts.

## 3. Build the asset plan

Give every asset a purpose, placement, format, Kive setup, and concise brief. Use the user's requested ratio when supplied; otherwise use:

- Feed still or product ad: `4:5`
- Story, Reel, or other vertical short-form asset: `9:16`
- Square catalog tile: `1:1`
- Landscape site hero or video: `16:9`

Search `find_studios` once using the campaign look, not generic terms. Search `find_video_presets` once when the plan includes video. If a search errors or returns no usable option, make at most one broader fallback call to that catalog. Then choose the closest returned option or use a prompt-only brief and state the tradeoff. Never call either catalog more than twice in one request. Keep the campaign spine in every still and video brief.

Keep words and calls to action out of generated scenes unless the user explicitly requires them. Prefer composition with intentional negative space for later copy so the product image remains accurate and reusable.

## 4. Quote before spending

For a campaign or any request with multiple assets, treat an exact asset list plus credit estimate as the approval checkpoint unless the user has already approved that exact work.

- Call the relevant generation tool once per planned configuration with `estimateOnly: true`. Use the final product, studio or preset, aspect ratio, mode, and sample count so the quote matches execution.
- Report each estimate and their combined total. If the total exceeds the user's budget, adjust the plan and re-estimate; never silently drop an asset or spend above the cap.
- Present the campaign spine, asset table, selected Kive options, and total. Ask for explicit approval to spend.
- Stop there. An estimate is not a generation, and phrases such as "show me the approach", "before we commit", or "get it ready for approval" are not authorization to spend.
- Skip estimates when the user explicitly asks not to estimate.

## 5. Execute the approved plan

- Treat a direct request to generate, or explicit approval of the exact plan, as authorization. Do not add another approval loop.
- Reuse the estimated configuration and campaign spine. Generate only the approved assets and sample counts.
- Render each result with `show_kive_image` or `show_kive_video` until it is ready before claiming completion.
- If a result needs refinement, preserve the campaign spine and change only the requested variable. Use `edit_image` for edits to an existing image instead of restarting product generation.

## Link finished assets

When summarizing delivered assets, link each one to its page in Kive:

```
https://kive.ai/<workspace url>/generate-image?id=<output id>&generationId=<generation id>
```

- `<workspace url>` is the `url` field from `list_workspaces`, `<generation id>` is the generation's `id`, and `<output id>` is the `id` of the specific output inside the generation's `output` array (both are in the `show_kive_image` / `show_kive_video` result). The same format works for image and video generations.
- When a Kive task id is known, the agent view is an equivalent target: `https://kive.ai/<workspace url>/agent?generationId=<generation id>&id=<output id>&taskId=<task id>`.
- Do not link `generationUrl` or a bare `preloadedImageGenerationId` URL as the asset link: that only preloads composer settings and does not open the generated asset.

## Response format at the approval checkpoint

Keep it concise and decision-ready:

1. **Campaign spine:** goal, visual hook, look, and protected product truth.
2. **Assets:** placement, ratio, Kive studio or preset, brief, samples, and exact credits.
3. **Total:** combined Kive credits and any budget tradeoff.
4. **Decision:** one clear approval question or, during exploration, a choice between directions.
