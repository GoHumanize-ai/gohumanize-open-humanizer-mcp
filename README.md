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

## Links

| Resource | Link |
| --- | --- |
| Project page and browser demo | [gohumanize.ai/research](https://gohumanize.ai/research) |
| Model weights, LoRA adapter, GGUF builds | [gohumanize/gohumanize-open-humanizer](https://huggingface.co/gohumanize/gohumanize-open-humanizer) |
| Dataset, 2,200 pairs (CC-BY 4.0) | [gohumanize/gohumanize-open-humanizer-dataset](https://huggingface.co/datasets/gohumanize/gohumanize-open-humanizer-dataset) |
| Code and full pipeline | [GoHumanize-ai/gohumanize-open-humanizer](https://github.com/GoHumanize-ai/gohumanize-open-humanizer) |
| Write-up: every step, service and result | [docs/paper.md](https://github.com/GoHumanize-ai/gohumanize-open-humanizer/blob/main/docs/paper.md) |
| Archived release, citable DOI | [10.5281/zenodo.22843083](https://doi.org/10.5281/zenodo.22843083) |
| Python client and CLI | [pypi.org/project/gohumanize-open-humanizer](https://pypi.org/project/gohumanize-open-humanizer/) |
| MCP server for AI assistants | [npm](https://www.npmjs.com/package/gohumanize-open-humanizer-mcp) · [source](https://github.com/GoHumanize-ai/gohumanize-open-humanizer-mcp) |
| Training run, loss curves and config | [Weights & Biases](https://wandb.ai/gohumanize/gohumanize-open-humanizer/runs/95wi8tdg) |

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

By default the server calls the public demo endpoint. To use your own copy of
the model, point it at any OpenAI-compatible server:

```json
"env": {
  "OPEN_HUMANIZER_URL": "http://localhost:11434/v1",
  "OPEN_HUMANIZER_MODEL": "gohumanize/open-humanizer"
}
```

`OPEN_HUMANIZER_API_KEY` sets a bearer token when the endpoint needs one.

## Licence

Apache-2.0.
