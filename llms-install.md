# Installing Prompeteer MCP

Generates contextual prompts and agent skills tuned to 140+ AI platforms, with a 16-dimension Prompt Score and a saved prompt vault. Free to start.

Connect to `https://prompeteer.ai/mcp` using Streamable HTTP and OAuth 2.1 with PKCE S256. Complete sign-in in your MCP client's browser flow.

For Cursor, add this to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "prompeteer": {
      "url": "https://prompeteer.ai/mcp"
    }
  }
}
```

For other clients, follow the [connection guide](https://prompeteer.ai/connect). Do not assume all MCP clients accept the same configuration format.

For clients that launch stdio servers, use Node.js 22.14.0 or later and configure:

```json
{
  "mcpServers": {
    "prompeteer": {
      "command": "npx",
      "args": ["-y", "@prompeteer.ai/mcp-server@2.0.3"]
    }
  }
}
```

The package runs a maintained `mcp-remote` proxy to the fixed Prompeteer endpoint and opens browser OAuth when required. Credentials are handled by that proxy's local cache. Prompeteer's generation service remains hosted. `--help`, `--version`, and `--json` print information without connecting; `--json` prints the direct Cursor configuration above.

The hosted service provides prompt generation, agent skill generation, Prompt Score, PromptDrive, and authenticated private Memory tools. Skills receive a Skill Score through the skill workflow. Use authenticated tool discovery for the current schemas and authorized operations.

Free to start. See [current pricing and allowances](https://prompeteer.ai/pricing); this file does not promise unlimited use.

[Privacy](https://prompeteer.ai/privacy) | [Terms](https://prompeteer.ai/terms) | [Support](https://prompeteer.ai/about)
