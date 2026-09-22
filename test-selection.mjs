// Checks the choice between rewrites against stub endpoints: no API key, no model, no network.
//   node test-selection.mjs
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SRC = 'It is worth noting that the committee ultimately reached a consensus after lengthy deliberation.';
const REWRITE = 'The committee argued the point for hours, and in the end they agreed on it.';
const calls = { multi: 0, single: 0 };

function server(kind, port) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      let body = '';
      req.on('data', (d) => (body += d));
      req.on('end', () => {
        const parsed = JSON.parse(body);
        calls[kind] += 1;
        const input = parsed.messages.at(-1).content;
        let outs;
        if (kind === 'multi') {
          if (parsed.n !== 5) throw new Error('expected n=5, got ' + parsed.n);
          outs = [input, input, REWRITE, input, input];
        } else {
          outs = calls.single < 3 ? [input] : [REWRITE];
        }
        const payload = JSON.stringify({ choices: outs.map((o) => ({ message: { content: o } })) });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(payload);
      });
    });
    s.listen(port, () => resolve(s));
  });
}

async function run(port, kind) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['server.js'],
    env: { ...process.env, OPEN_HUMANIZER_URL: `http://127.0.0.1:${port}/v1`, OPEN_HUMANIZER_API_KEY: 'k' },
  });
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(transport);
  const out = await client.callTool({ name: 'humanize_text', arguments: { text: SRC } });
  await client.close();
  return out.content[0].text;
}

const s1 = await server('multi', 8161);
const s2 = await server('single', 8162);
const a = await run(8161, 'multi');
console.log(a === REWRITE ? `multi-sample server: picked the rewrite in ${calls.multi} request` : `FAIL: ${a}`);
const b = await run(8162, 'single');
console.log(b === REWRITE ? `server ignoring n: got a rewrite after ${calls.single} requests` : `FAIL: ${b}`);
s1.close(); s2.close();
