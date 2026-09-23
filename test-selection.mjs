// Checks the choice between rewrites against stub endpoints: no API key, no model, no network.
//   node test-selection.mjs
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SRC = 'It is worth noting that the committee ultimately reached a consensus after lengthy deliberation.';
const REWRITE = 'The committee argued the point for hours, and in the end they agreed on it.';
// Changes more than REWRITE but puts words in quotes: only the quote rule can reject it.
const INVENTED = 'Hours of argument, then a deal. \u201cWe finally agreed on it,\u201d one member said.';
// Number case: LOST changes more than KEPT but drops the figures.
const NUM_SRC = 'It is worth noting that the agency ultimately allocated $2.4 million to 12 projects in 2025.';
const LOST = 'The agency gave a few million dollars to a dozen projects last year, after a long review of them.';
const KEPT = 'Last year, 2025, the agency put $2.4 million into 12 projects after its review.';
const calls = { multi: 0, single: 0, quoted: 0, numbers: 0 };

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
        } else if (kind === 'numbers') {
          outs = calls.numbers === 1 ? [LOST, input, KEPT, input, input] : [LOST, input, input, input, input];
        } else if (kind === 'quoted') {
          outs = [INVENTED, '\u201c' + REWRITE + '\u201d', input, input, input];
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

async function run(port, kind, text = SRC) {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['server.js'],
    env: { ...process.env, OPEN_HUMANIZER_URL: `http://127.0.0.1:${port}/v1`, OPEN_HUMANIZER_API_KEY: 'k' },
  });
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(transport);
  const out = await client.callTool({ name: 'humanize_text', arguments: { text } });
  await client.close();
  return out.content[0].text;
}

const s1 = await server('multi', 8161);
const s2 = await server('single', 8162);
const s3 = await server('quoted', 8163);
const s4 = await server('numbers', 8164);
function check(ok, message, got) {
  console.log(ok ? message : `FAIL: ${got}`);
  if (!ok) process.exitCode = 1;
}
const a = await run(8161, 'multi');
check(a === REWRITE, `multi-sample server: picked the rewrite in ${calls.multi} request`, a);
const b = await run(8162, 'single');
check(b === REWRITE, `server ignoring n: got a rewrite after ${calls.single} requests`, b);
const c = await run(8163, 'quoted');
check(c === REWRITE, 'quotes: wrapping removed, invented quotes avoided', c);
const d = await run(8164, 'numbers', NUM_SRC);
check(d === KEPT, 'numbers: a real rewrite keeping every figure wins', d);
const e = await run(8164, 'numbers', NUM_SRC);
check(e === NUM_SRC, 'numbers: keeping the figures beats a bigger change that drops them', e);
s1.close(); s2.close(); s3.close(); s4.close();
