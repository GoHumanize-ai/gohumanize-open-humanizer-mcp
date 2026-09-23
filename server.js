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
// 300 s, not 120: the hosted endpoint runs on a GPU that scales to zero, and a cold
// start plus generation can exceed two minutes. Note that MCP clients apply their own
// timeout (often 60 s), so a local endpoint is the reliable choice.
const TIMEOUT_MS = Number(process.env.OPEN_HUMANIZER_TIMEOUT_MS || 300000);
// On modern prose the model sometimes plays safe and returns the input almost unchanged
// (about one try in six). Generate several rewrites (the server makes them in
// parallel, so the wait is the same) and keep the one that moved furthest from the input.
const SAMPLES = Math.max(1, Number(process.env.OPEN_HUMANIZER_SAMPLES || 5));
const MIN_LENGTH_RATIO = 0.65;
const MAX_LENGTH_RATIO = 1.4;
const NEAR_COPY = 0.9;
const MAX_WORDS = 1500;

// The hosted endpoint is not open to the public: it is the one behind the browser
// demo and requires a key. Say so usefully instead of surfacing a bare 401.
const GUIDE =
  'The hosted demo endpoint needs a key. Either run the model yourself, which needs no key:\n  ollama pull hf.co/gohumanize/gohumanize-open-humanizer:Q4_K_M\n  export OPEN_HUMANIZER_URL=http://localhost:11434/v1\n  export OPEN_HUMANIZER_MODEL=hf.co/gohumanize/gohumanize-open-humanizer:Q4_K_M\nor set OPEN_HUMANIZER_API_KEY, or try the model in a browser at https://gohumanize.ai/open-model';

// Same system prompt the model was trained with.
const SYSTEM_PROMPT =
  'Rewrite the following text so that it reads as if a person wrote it: varied sentence ' +
  'length, concrete wording, natural rhythm, no filler transitions. Keep the meaning, the ' +
  'facts and the order of ideas. Return only the rewritten text.';

// Share of the source's words that survive in the rewrite; 1 means unchanged.
function wordOverlap(source, rewrite) {
  const counts = new Map();
  for (const w of source.toLowerCase().split(/\s+/).filter(Boolean)) {
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  if (!total) return 1;
  let kept = 0;
  for (const w of rewrite.toLowerCase().split(/\s+/).filter(Boolean)) {
    const left = counts.get(w) ?? 0;
    if (left > 0) {
      counts.set(w, left - 1);
      kept += 1;
    }
  }
  return kept / total;
}

// The model sometimes adds quotation marks the input did not have: it wraps the whole
// answer in quotes, or turns a plain statement into a quote. Both put words in quotes that
// nobody said, so drop quotes wrapped around the whole answer and prefer rewrites that do
// not add any.
const QUOTES = ['"', '\u201c', '\u201d'];
const countQuotes = (t) => [...t].filter((ch) => QUOTES.includes(ch)).length;

function unwrapQuotes(source, rewrite) {
  const t = rewrite.trim();
  if (
    t.length > 2 &&
    QUOTES.includes(t[0]) &&
    QUOTES.includes(t.at(-1)) &&
    !QUOTES.includes(source.trim()[0]) &&
    countQuotes(t.slice(1, -1)) === 0
  ) {
    return t.slice(1, -1).trim();
  }
  return rewrite;
}

// About a quarter of rewrites of number-heavy text drop a figure. A rewrite that keeps
// every number of the source is preferred, but only among real rewrites: a near-copy
// keeps every number without trying.
function numbers(t) {
  return new Set(
    (t.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[.,]+$/, '').replaceAll(',', '')).filter(Boolean)
  );
}

// The candidates that pass `keep`, or all of them if none does.
function prefer(pool, keep) {
  const kept = pool.filter(keep);
  return kept.length ? kept : pool;
}

// The candidate that changed the most, among those of a sensible length, preferring in
// turn: no added quotation marks, a real rewrite, every number of the source kept.
function pickMostRewritten(source, candidates) {
  const usable = candidates.filter((c) => c && c.trim()).map((c) => unwrapQuotes(source, c));
  if (usable.length < 2) return usable[0] ?? '';
  const sourceWords = source.split(/\s+/).filter(Boolean).length || 1;
  const sourceNumbers = numbers(source);
  let pool = prefer(usable, (c) => {
    const ratio = c.split(/\s+/).filter(Boolean).length / sourceWords;
    return ratio >= MIN_LENGTH_RATIO && ratio <= MAX_LENGTH_RATIO;
  });
  pool = prefer(pool, (c) => countQuotes(c) <= countQuotes(source));
  pool = prefer(pool, (c) => wordOverlap(source, c) <= NEAR_COPY);
  pool = prefer(pool, (c) => {
    const kept = numbers(c);
    return [...sourceNumbers].every((n) => kept.has(n));
  });
  return pool.reduce((best, c) => (wordOverlap(source, c) < wordOverlap(source, best) ? c : best));
}

function text(value) {
  return { content: [{ type: 'text', text: String(value) }] };
}

function errorText(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

async function humanize(input, temperature) {
  let candidates = await complete(input, temperature, SAMPLES);
  // Servers that ignore `n` (Ollama, for one) answer with a single rewrite. Ask again,
  // one request at a time, and stop as soon as one of them is a real rewrite.
  const serverIgnoresN = candidates.length < 2;
  for (let tries = 0; serverIgnoresN && SAMPLES > 1 && tries < SAMPLES - 1; tries += 1) {
    if (wordOverlap(input, pickMostRewritten(input, candidates)) <= NEAR_COPY) break;
    candidates = candidates.concat(await complete(input, temperature, 1));
  }
  return pickMostRewritten(input, candidates);
}

async function complete(input, temperature, samples) {
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
        ...(samples > 1 ? { n: samples } : {}),
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
    const outs = (data?.choices ?? [])
      .map((c) => c?.message?.content)
      .filter((c) => typeof c === 'string' && c.trim())
      .map((c) => c.trim());
    if (!outs.length) throw new Error('empty response from model');
    return outs;
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
        .describe('Sampling temperature, default 0.9; lower is more literal'),
    },
  },
  async ({ text: input, temperature = 0.9 }) => {
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
        'Base: Qwen3-4B, fully fine-tuned on 2,957 pairs of AI-styled text -> public-domain human prose from Project Gutenberg books and US federal agencies.',
        'Dataset (CC-BY 4.0), model weights, GGUF, training code, evaluation and a full write-up are linked from https://gohumanize.ai/open-model',
        'It is separate from the production models used by GoHumanize.ai and makes no claim about passing AI detectors.',
        `This server is calling: ${BASE_URL} (model "${MODEL}").`,
      ].join('\n'),
    ),
);

await server.connect(new StdioServerTransport());
