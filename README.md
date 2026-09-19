# GoHumanize Open Humanizer MCP server

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

- Project page: https://gohumanize.ai/research
- Model weights, LoRA adapter and GGUF builds (Hugging Face): https://huggingface.co/gohumanize/gohumanize-open-humanizer
- Dataset (Hugging Face, CC-BY 4.0): https://huggingface.co/datasets/gohumanize/gohumanize-open-humanizer-dataset
- Code, pipeline and write-up (GitHub): https://github.com/GoHumanize-ai/gohumanize-open-humanizer
- Paper: https://github.com/GoHumanize-ai/gohumanize-open-humanizer/blob/main/docs/paper.md
- Archived release with DOI (Zenodo): https://doi.org/10.5281/zenodo.22843083
- Python client and CLI (PyPI): https://pypi.org/project/gohumanize-open-humanizer/
- MCP server (npm): https://www.npmjs.com/package/gohumanize-open-humanizer-mcp, source: https://github.com/GoHumanize-ai/gohumanize-open-humanizer-mcp
- Training run (Weights & Biases): https://wandb.ai/gohumanize/gohumanize-open-humanizer/runs/95wi8tdg

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
