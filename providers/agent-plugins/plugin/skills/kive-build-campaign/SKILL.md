---
name: kive-build-campaign
description: Plan and produce cohesive multi-asset product campaigns with Kive through its MCP server. Use when the user asks for a product launch, campaign, ad set, social content package, creative concepts, multiple placements, or coordinated product images and videos. Turn a loose marketing goal into placement-specific briefs, let the user pick the campaign's look from Kive's looks and ads, estimate the exact credit cost, get approval before spending, and keep the visual direction consistent across assets.
---

# Build a Kive campaign

Turn a loose campaign request into a decision-ready plan and, after approval, finished Kive assets. Add campaign judgment and cross-tool coordination; rely on the Kive MCP server instructions and tool descriptions for individual call contracts. Where this skill and the server disagree, follow the server.

## 1. Resolve the brief

- Use details already supplied. Ask only for missing information that would materially change the work: product, audience or goal, placement, offer, and non-negotiable brand constraints.
- Resolve the workspace and saved product with `list_workspaces` and `find_products`. If multiple products match, ask the user to choose before planning assets.
- Ground product facts in Kive results or the user's words. Do not invent claims, ingredients, packaging details, logos, or promotional copy.

## 2. Settle the look

Kive creates product images from looks and ads: curated reference images the user picks and remixes with their own product. A look is a photo set-up without ad copy; an ad is a designed ad or a photo with ad copy. Say looks or ads to the user, never ideas. How much of the look the user has already decided picks the step:

- **Decided:** the user described the scene or style, or named a studio. Use that as the campaign's look and plan direct generations. Skip looks and ads.
- **Open, or the user asked for options:** call `find_ideas` with the `productId`. Pass `kind` when they said looks or ads, and `query` when they described one. Show the cards and end your turn: the pick is the user's. The look or ad they pick becomes the campaign's look.
- **Delegated** ("you choose", "surprise me"): call `find_ideas`, take the best match for the goal, and name the look or ad you used in one line.

Studios are style presets the user brings. Call `find_studios` or `recommend_studios` only when the user names a studio or asks for studios; never search or offer them on your own. Video presets take over how a video moves: call `find_video_presets` and pass a preset only when the user asks for presets or names one.

## 3. Establish one campaign spine

Define a compact shared direction before specifying assets:

- **Goal and audience:** what response the creative should drive.
- **Product truth:** the real feature or visual detail to protect.
- **Visual hook:** the one memorable scene idea.
- **Look:** the look or ad the user picked, or the scene they described, with its mood, palette, light, materials, and composition.
- **Continuity:** the motif that should recur across stills and videos.
- **Constraints:** details, claims, or treatments to avoid.

When the user asks for alternative directions, honor the requested count; otherwise offer three that test meaningfully different visual hooks. Change one strategic variable at a time and explain the tradeoff; do not present near-duplicate prompt wording as separate concepts.

## 4. Build the asset plan

Give every asset a purpose, placement, format, route, and concise brief. Each asset takes one of three routes:

- **Remix of the picked look or ad** (`remix_idea`): one image per call, composed by the look or ad. It takes no ratio, mode, or sample settings, and its `instruction` carries only the user's own direction. Use it for the stills that should match the pick.
- **Direct generation** (`generate_product_image`): for a look the user described, a studio they named, or a placement that needs a set ratio. Put the campaign spine in `brief`. To carry the style of a finished campaign still into later stills, pass its image URL in `styleImageUrls`.
- **Video** (`generate_product_video`): looks and ads do not start a video. Anchor it on the saved product and put the motion and the campaign spine in `brief`.

For direct generations and videos, use the user's requested ratio when supplied; otherwise use:

- Feed still or product ad: `4:5`
- Story, Reel, or other vertical short-form asset: `9:16`
- Square catalog tile: `1:1`
- Landscape site hero or video: `16:9`

Keep words and calls to action out of generated scenes unless the user explicitly requires them or picked an ad that carries copy. Prefer composition with intentional negative space for later copy so the product image remains accurate and reusable.

## 5. Quote before spending

For a campaign or any request with multiple assets, treat an exact asset list plus credit estimate as the approval checkpoint unless the user has already approved that exact work.

- For each direct generation and video, call the generation tool once per planned configuration with `estimateOnly: true`. Use the final product, aspect ratio, mode, and sample count, plus any studio or preset the user chose, so the quote matches execution.
- For each remix, use the price per remix image that `find_ideas` returned. Showing looks and ads is free.
- Report each cost as the tool gave it, and the combined total of the planned assets. If the total exceeds the user's budget, adjust the plan and re-estimate; never silently drop an asset or spend above the cap.
- Present the campaign spine, asset table, the look or ad in use, and total. Ask for explicit approval to spend.
- Stop there. An estimate is not a generation, and phrases such as "show me the approach", "before we commit", or "get it ready for approval" are not authorization to spend.
- Skip estimates when the user explicitly asks not to estimate.

## 6. Execute the approved plan

- Treat a direct request to generate, or explicit approval of the exact plan, as authorization. Do not add another approval loop of your own.
- Reuse the estimated configuration and campaign spine. Generate only the approved assets and sample counts.
- For a remix, call `remix_idea` with the picked `ideaId` and the `productId`, then poll `show_kive_image` with the `remixId`. A remix runs as a Kive Agent chat: when it returns a question, show it to the user and wait, and when it asks to confirm a credit cost, let the user decide. Never answer for the user. Pass their reply with `continue_idea_remix`.
- Render each result with `show_kive_image` or `show_kive_video` until it is ready before claiming completion.
- If a result needs refinement, preserve the campaign spine and change only the requested variable. Use `continue_idea_remix` with `change` for a finished remix, and `edit_image` for other existing images, instead of restarting product generation.

## Link finished assets

When summarizing delivered assets, link each one to its page in Kive:

```
https://kive.ai/<workspace url>/generate-image?id=<output id>&generationId=<generation id>
```

- `<workspace url>` is the `url` field from `list_workspaces`, `<generation id>` is the generation's `id`, and `<output id>` is the `id` of the specific output inside the generation's `output` array (both are in the `show_kive_image` / `show_kive_video` result). The same format works for image and video generations.
- For a remix, use the `continueUrl` the result returns: it opens the same chat in Kive. Mention it once.
- When a Kive task id is known, the agent view is an equivalent target: `https://kive.ai/<workspace url>/agent?generationId=<generation id>&id=<output id>&taskId=<task id>`.
- Do not link `generationUrl` or a bare `preloadedImageGenerationId` URL as the asset link: that only preloads composer settings and does not open the generated asset.

## Response format at the approval checkpoint

Keep it concise and decision-ready:

1. **Campaign spine:** goal, visual hook, look, and protected product truth.
2. **Assets:** placement, ratio, route (remix, direct generation, or video), brief, samples, and exact credits.
3. **Total:** combined Kive credits and any budget tradeoff.
4. **Decision:** one clear approval question or, during exploration, a choice between directions.
