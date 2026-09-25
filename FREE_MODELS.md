# Free AI Gateway Models — Stock Selector

These models are available at **zero cost** through Vercel AI Gateway.
Use `AI_GATEWAY_API_KEY` (set in `.env.local` / Vercel env) to call any of them
via `https://ai-gateway.vercel.sh/v1/chat/completions`.

## Free Text Models (8 available, $0 input)

| Model | Context | Type |
|---|---|---|
| `inclusionai/ling-3.0-flash-fin` | 256K | Fastest · analysis & classification |
| `inclusionai/ling-3.0-flash-fin-free` | 256K | Fastest · alternate endpoint |
| `inclusionai/ling-3.0-flash-vl` | 256K | Multimodal · charts/screenshots |
| `inclusionai/ling-3.0-flash-vl-free` | 256K | Multimodal · alternate endpoint |
| `inclusionai/ling-3.0-flash-sante` | 256K | Security-focused reasoning |
| `inclusionai/ling-3.0-flash-sante-free` | 256K | Security-focused · alternate endpoint |
| `poolside/laguna-s-2.1-free` | 256K | Code generation |
| `typesafe-ai/jev` | — | Evaluation · structured decisions |

**Note:** Listed as Free on Vercel's site (output $0, input rounds to $0). It's an evaluation model — for classification, routing, rubric assessment — not a chat model, so context window is 0. Use it for structured decision tasks, not general conversation.

## Recommended defaults for Stock Selector

```env
# Primary model — fast, multimodal (handles charts & screenshots)
AI_GATEWAY_MODEL=inclusionai/ling-3.0-flash-vl

# Fallback if primary is slow/unavailable
AI_GATEWAY_FALLBACK_MODEL=inclusionai/ling-3.0-flash-fin
```

## Example call

```bash
curl https://ai-gateway.vercel.sh/v1/chat/completions \
  -H "Authorization: Bearer $AI_GATEWAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "inclusionai/ling-3.0-flash-vl",
    "messages": [{"role": "user", "content": "Analyze this stock chart pattern"}]
  }'
```

## In Hermes

`hermes model` → **30. Vercel AI Gateway** for all 8 free models. Quick alias: `/model jev` → `ai-gateway/typesafe-ai/jev`.

## Full catalog

Free models only: https://vercel.com/ai-gateway/models?features=free
