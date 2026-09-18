// Smoke test: start the server over stdio, list tools, call both of them.
// Needs network access to the configured endpoint (OPEN_HUMANIZER_URL / _API_KEY).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({ command: 'node', args: ['server.js'], env: process.env });
const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
if (names.join(',') !== 'about_open_humanizer,humanize_text') throw new Error(`unexpected tools: ${names}`);
console.log('tools:', names.join(', '));

const about = await client.callTool({ name: 'about_open_humanizer', arguments: {} });
if (!about.content[0].text.includes('Open Humanizer')) throw new Error('about text missing');
console.log('about: ok');

const sample =
  'It is worth noting that the committee ultimately reached a consensus regarding the proposed changes. ' +
  'Furthermore, the members expressed a considerable degree of satisfaction with the collaborative process.';
const res = await client.callTool({ name: 'humanize_text', arguments: { text: sample } });
if (res.isError) throw new Error(res.content[0].text);
const out = res.content[0].text;
if (out.split(/\s+/).length < 10) throw new Error(`output too short: ${out}`);
console.log('humanize_text: ok\n---\n' + out + '\n---');

await client.close();
console.log('PASS');
