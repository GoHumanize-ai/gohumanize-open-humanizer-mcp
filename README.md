# GoHumanize Open Humanizer MCP server

[![npm](https://img.shields.io/npm/v/gohumanize-open-humanizer-mcp)](https://www.npmjs.com/package/gohumanize-open-humanizer-mcp)
[![Model on Hugging Face](https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-model-yellow)](https://huggingface.co/gohumanize/gohumanize-open-humanizer)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22843083.svg)](https://doi.org/10.5281/zenodo.22843083)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://www.apache.org/licenses/LICENSE-2.0)

An MCP (Model Context Protocol) server that lets AI assistants call the
GoHumanize Open Humanizer: a small open model (Qwen3-4B fine-tune, Apache-2.0)
that rewrites AI-styled English text into more natural human prose.

Tools:

- `humanize_text` rewrite a passage (50 to 400 words works best; longer texts
  are processed paragraph by paragraph, up to 1,500 words).
- `about_open_humanizer` what the model is and which endpoint is in use.

The model is educational and makes no claim about AI detectors. It is separate
from the production models used by GoHumanize.ai.


## Several rewrites, best one returned

On modern prose the model sometimes plays safe and hands the text back almost unchanged
(about one try in six for version 2 of the model). Each call asks the endpoint for five rewrites (generated in
parallel, so the wait is the same) and keeps the one that moved furthest from the input while
staying a sensible length. Set `OPEN_HUMANIZER_SAMPLES=1` for a single request.


## Links

| Resource | Link |
| --- | --- |
| Project page and browser demo | [gohumanize.ai/open-model](https://gohumanize.ai/open-model) |
| GoHumanize (the product this research comes from) | [gohumanize.ai](https://gohumanize.ai/) |
| Model weights and GGUF builds (version 2 full fine-tune) | [gohumanize/gohumanize-open-humanizer](https://huggingface.co/gohumanize/gohumanize-open-humanizer) |
| Version 1 QLoRA and LoRA adapter | [gohumanize/gohumanize-open-humanizer-qlora](https://huggingface.co/gohumanize/gohumanize-open-humanizer-qlora) |
| Dataset, 3,257 pairs (CC-BY 4.0) | [gohumanize/gohumanize-open-humanizer-dataset](https://huggingface.co/datasets/gohumanize/gohumanize-open-humanizer-dataset) |
| Code and full pipeline | [GoHumanize-ai/gohumanize-open-humanizer](https://github.com/GoHumanize-ai/gohumanize-open-humanizer) |
| Write-up: every step, service and result | [docs/paper.md](https://github.com/GoHumanize-ai/gohumanize-open-humanizer/blob/main/docs/paper.md) |
| Archived release, citable DOI | [10.5281/zenodo.22843083](https://doi.org/10.5281/zenodo.22843083) |
| Python client and CLI | [pypi.org/project/gohumanize-open-humanizer](https://pypi.org/project/gohumanize-open-humanizer/) |
| MCP server for AI assistants | [npm](https://www.npmjs.com/package/gohumanize-open-humanizer-mcp) · [source](https://github.com/GoHumanize-ai/gohumanize-open-humanizer-mcp) |
| Training runs, loss curves and config | [Weights & Biases](https://wandb.ai/gohumanize/gohumanize-open-humanizer) |

## Use

```json
{
  "mcpServers": {
    "gohumanize-open-humanizer": {
      "command": "npx",
      "args": ["-y", "gohumanize-open-humanizer-mcp"]
    }
  }
}
```

## Which endpoint

The model runs wherever you point the server. **Running it yourself needs no key**
and is the recommended setup:

```bash
ollama pull hf.co/gohumanize/gohumanize-open-humanizer:Q4_K_M
export OPEN_HUMANIZER_URL=http://localhost:11434/v1
export OPEN_HUMANIZER_MODEL=hf.co/gohumanize/gohumanize-open-humanizer:Q4_K_M
```

**The hosted endpoint sleeps when idle.** The first request after a quiet period waits
for a GPU cold start, measured at one to two minutes; afterwards a rewrite takes a
second or two. MCP clients apply their own timeout, often 60 seconds, so the first
call through a client may fail even with a valid key and succeed on retry. Running the
model locally avoids this entirely.

The endpoint the server falls back to is the one behind the browser demo on
[gohumanize.ai/open-model](https://gohumanize.ai/open-model). It is rate-limited and
requires `OPEN_HUMANIZER_API_KEY`, so it is not open for general use; to try the
model without installing anything, use the demo on that page.

Any OpenAI-compatible server works:

```json
"env": {
  "OPEN_HUMANIZER_URL": "http://localhost:11434/v1",
  "OPEN_HUMANIZER_MODEL": "gohumanize/open-humanizer"
}
```

`OPEN_HUMANIZER_API_KEY` sets a bearer token when the endpoint needs one.

## Licence

Apache-2.0.
