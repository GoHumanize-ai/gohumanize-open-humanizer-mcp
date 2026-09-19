#!/usr/bin/env node
// MCP server for the GoHumanize Open Humanizer.
//
// The model is served behind any OpenAI-compatible chat endpoint. By default
// this talks to the public GoHumanize demo endpoint; point it at a local
// Ollama (`ollama run gohumanize/open-humanizer`) or your own vLLM server with:
//
//   OPEN_HUMANIZER_URL      base URL, e.g. http://localhost:11434/v1
//   OPEN_HUMANIZER_MODEL    served model name (default: gohumanize-open-humanizer)
//   OPEN_HUMANIZER_API_KEY  bearer token if the endpoint requires one
//
// This is an educational open model. It rewrites style; it makes no claim
// about AI detectors.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// package.json is the single source of truth for the version reported to clients.
const { version } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'package.json'), 'utf8'),
);

const DEFAULT_URL = 'https://gohumanize--gohumanize-open-humanizer-serve-serve.modal.run/v1';
const BASE_URL = (process.env.OPEN_HUMANIZER_URL || DEFAULT_URL).replace(/\/$/, '');
const MODEL = process.env.OPEN_HUMANIZER_MODEL || 'gohumanize-open-humanizer';
const API_KEY = process.env.OPEN_HUMANIZER_API_KEY || '';
const TIMEOUT_MS = Number(process.env.OPEN_HUMANIZER_TIMEOUT_MS || 120000);
const MAX_WORDS = 1500;

// The hosted endpoint is not open to the public: it is the one behind the browser
// demo and requires a key. Say so usefully instead of surfacing a bare 401.
const GUIDE =
  'The hosted demo endpoint needs a key. Either run the model yourself, which needs no key:\n  ollama pull hf.co/gohumanize/gohumanize-open-humanizer:Q4_K_M\n  export OPEN_HUMANIZER_URL=http://localhost:11434/v1\n  export OPEN_HUMANIZER_MODEL=hf.co/gohumanize/gohumanize-open-humanizer:Q4_K_M\nor set OPEN_HUMANIZER_API_KEY, or try the model in a browser at https://gohumanize.ai/research';

// Same system prompt the model was trained with.
const SYSTEM_PROMPT =
  'Rewrite the following text so that it reads as if a person wrote it: varied sentence ' +
  'length, concrete wording, natural rhythm, no filler transitions. Keep the meaning, the ' +
  'facts and the order of ideas. Return only the rewritten text.';

function text(value) {
  return { content: [{ type: 'text', text: String(value) }] };
}

function errorText(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function humanize(input, temperature) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature,
        top_p: 0.9,
        max_tokens: 1500,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: input },
        ],
        chat_template_kwargs: { enable_thinking: false },
      }),
    });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300);
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `endpoint refused the request (${res.status}).\n${GUIDE}`,
        );
      }
      throw new Error(`endpoint returned ${res.status}: ${body}`);
    }
    const data = await res.json();
    const out = data?.choices?.[0]?.message?.content;
    if (typeof out !== 'string' || !out.trim()) throw new Error('empty response from model');
    return out.trim();
  } finally {
    clearTimeout(timer);
  }
}

const server = new McpServer({ name: 'gohumanize-open-humanizer', version });

server.registerTool(
  'humanize_text',
  {
    title: 'Humanize text',
    description:
      'Rewrite a passage of AI-styled English prose so it reads more like a person wrote it, ' +
      'keeping the meaning, facts and order of ideas. Uses the GoHumanize Open Humanizer, a small ' +
      'open model (Qwen3-4B fine-tune) trained on public-domain prose. Best on passages of 50 to ' +
      '400 words; longer inputs are processed paragraph by paragraph. Educational model: no claim ' +
      'about AI detectors.',
    inputSchema: {
      text: z.string().min(1).describe('The text to rewrite (English)'),
      temperature: z
        .number()
        .min(0)
        .max(1.5)
        .optional()
        .describe('Sampling temperature, default 0.7; lower is more literal'),
    },
  },
  async ({ text: input, temperature = 0.7 }) => {
    const words = input.trim().split(/\s+/).length;
    if (words > MAX_WORDS) return errorText(`Input is ${words} words; the limit is ${MAX_WORDS}.`);
    // No key and the default endpoint: the request will be refused, but only after
    // the hosted container has booted, which can take a couple of minutes. Say so now.
    if (!API_KEY && BASE_URL === DEFAULT_URL) {
      return errorText(`No endpoint configured. ${GUIDE}`);
    }
    try {
      const paragraphs = input.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      if (paragraphs.length <= 1 || words <= 400) return text(await humanize(input.trim(), temperature));
      const parts = [];
      for (const p of paragraphs) parts.push(await humanize(p, temperature));
      return text(parts.join('\n\n'));
    } catch (e) {
      return errorText(`Humanizer request failed: ${e.message}. Endpoint: ${BASE_URL}`);
    }
  },
);

server.registerTool(
  'about_open_humanizer',
  {
    title: 'About the Open Humanizer',
    description:
      'Describe the GoHumanize Open Humanizer: what it is, how it was trained, where the model, ' +
      'dataset and paper are published, and which endpoint this server is using.',
    inputSchema: {},
  },
  async () =>
    text(
      [
        'GoHumanize Open Humanizer (educational open model, Apache-2.0).',
        'Base: Qwen3-4B, fine-tuned with QLoRA on 2,000 pairs of AI-styled text -> public-domain human prose (Project Gutenberg).',
        'Dataset (CC-BY 4.0), model weights, GGUF, training code, evaluation and a full write-up are linked from https://gohumanize.ai/research',
        'It is separate from the production models used by GoHumanize.ai and makes no claim about passing AI detectors.',
        `This server is calling: ${BASE_URL} (model "${MODEL}").`,
      ].join('\n'),
    ),
);

await server.connect(new StdioServerTransport());
