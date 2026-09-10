#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { MCP_ENDPOINT, runBridge } from './bridge.js';

const { version, description } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const remoteConfig = { mcpServers: { prompeteer: { url: MCP_ENDPOINT } } };
const args = process.argv.slice(2);

if (args.length === 1 && args[0] === '--version') {
  console.log(version);
} else if (args.length === 1 && args[0] === '--json') {
  console.log(JSON.stringify(remoteConfig, null, 2));
} else if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
  console.log(`Prompeteer MCP (${version})

${description}

With no arguments, this command runs an MCP stdio bridge to ${MCP_ENDPOINT}.
OAuth sign-in opens in your browser when required. The maintained mcp-remote
proxy handles authentication and keeps credentials in its local protected cache.
All MCP messages use stdout. Sign-in and connection diagnostics use stderr.

Clients with native remote support can connect directly using Streamable HTTP:
${JSON.stringify(remoteConfig, null, 2)}

Usage:
  npx @prompeteer.ai/mcp-server
  npx @prompeteer.ai/mcp-server --help
  npx @prompeteer.ai/mcp-server --json
  npx @prompeteer.ai/mcp-server --version

Requires Node.js 22.14.0 or later.
Connection guide: https://prompeteer.ai/connect
Current plans: https://prompeteer.ai/pricing
`);
} else if (args.length !== 0) {
  console.error('Unknown arguments. Run prompeteer-mcp --help for connection instructions.');
  process.exitCode = 1;
} else {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 14)) {
    console.error('Prompeteer MCP requires Node.js 22.14.0 or later.');
    process.exitCode = 1;
  } else {
    try {
      runBridge();
    } catch {
      console.error('Prompeteer could not load its reviewed MCP proxy. Reinstall this package.');
      process.exitCode = 1;
    }
  }
}
