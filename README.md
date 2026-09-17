# GoHumanize Open Humanizer MCP server

An MCP (Model Context Protocol) server that lets AI assistants call the
GoHumanize Open Humanizer: a small open model (Qwen3-4B fine-tune, Apache-2.0)
that rewrites AI-styled English text into more natural human prose.

Tools:

- `humanize_text` rewrite a passage (50 to 400 words works best; longer texts
  are processed paragraph by paragraph, up to 1,500 words).
- `about_open_humanizer` what the model is and which endpoint is in use.

The model is educational and makes no claim about AI detectors. It is separate
from the production models used by GoHumanize.ai. Model, dataset, training code
and the full write-up: https://gohumanize.ai/research

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
