# Prompeteer MCP Server

Contextual prompts and agent skills for 140+ AI platforms.

Prompeteer generates contextual prompts and agent skills tuned to the model you are actually using, across 140+ AI platforms and 129 languages. Every prompt gets a 16-dimension Prompt Score, and skills get a Skill Score. Saved prompts live in PromptDrive and roam across platforms. Free to start.

## Connect to the hosted server

| Setting | Value |
| --- | --- |
| Endpoint | `https://prompeteer.ai/mcp` |
| Transport | Streamable HTTP |
| Authentication | OAuth 2.1 with PKCE S256 |
| Connection guide | [prompeteer.ai/connect](https://prompeteer.ai/connect) |

Use a client that supports remote MCP and OAuth discovery. Add the endpoint in its remote-server settings and complete the browser sign-in. Access depends on the account, plan, consented scopes, and client support.

For Cursor, add this entry to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "prompeteer": {
      "url": "https://prompeteer.ai/mcp"
    }
  }
}
```

Other clients have their own configuration formats. Use the [connection guide](https://prompeteer.ai/connect) for client-specific setup.

## Connect through the npm stdio bridge

For clients that launch local MCP commands, use Node.js 22.14.0 or later and add:

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

The command runs a stdio bridge to the same hosted Prompeteer endpoint. It uses the pinned `mcp-remote` 0.8.6 proxy for Streamable HTTP and OAuth. The client opens a browser for sign-in when authorization is needed. The local bridge does not run Prompeteer's generation models or product service.

The endpoint and OAuth resource are fixed to `https://prompeteer.ai/mcp`. The wrapper uses a loopback OAuth callback, runs without a shell, and forwards MCP messages through stdout. Connection diagnostics use stderr. It does not accept arbitrary endpoints, authentication headers, or debug flags. Native remote clients can use the direct URL without installing the bridge.

```sh
npx @prompeteer.ai/mcp-server@2.0.3
npx @prompeteer.ai/mcp-server@2.0.3 --help
npx @prompeteer.ai/mcp-server@2.0.3 --json
npx @prompeteer.ai/mcp-server@2.0.3 --version
```

`--json` prints the direct remote configuration for Cursor. `--help` and `--version` do not start a connection.

OAuth credentials are managed by `mcp-remote`, using its local `~/.mcp-auth` cache by default. On POSIX systems, new credential files are written with mode 0600. The bridge does not add its own token store. The package includes the tested proxy runtime and the patched query parser used by its callback server. Client installation does not resolve a different proxy dependency tree.

## Capabilities

| Tool family | Examples |
| --- | --- |
| Prompt and skill generation | `generate_prompt`, `generate_skill` |
| Prompt Score | `score_prompt` |
| PromptDrive | `list_prompts`, `get_prompt`, `save_to_promptdrive` |
| Private Memory | `list_memory_sources`, `search_memory`, `get_memory_page`, `ask_memory`, `get_memory_settings`, `update_memory_settings` |

Skills receive a Skill Score as part of the skill workflow; `score_skill` is not a separate advertised MCP tool. Discover the current tool schemas through the authenticated server. Generation, scoring, writes, and private Memory operations may require additional scopes or consume plan allowances.

Example: “Generate a prompt for a product launch email in Claude. Show its Prompt Score, then save the approved version to PromptDrive.”

## Authentication

The server advertises OAuth metadata and requests the scopes needed for authorized work. Keep credentials in the MCP client's managed authentication flow.

| Scope | Purpose |
| --- | --- |
| `mcp:read` | Read prompts and vault metadata |
| `mcp:write` | Save prompts |
| `mcp:generate` | Generate prompts and skills |
| `memory:read` | Read private Memory |
| `memory:write` | Update Memory settings |

[OAuth metadata](https://prompeteer.ai/mcp/.well-known/oauth-authorization-server) and [protected resource metadata](https://prompeteer.ai/.well-known/oauth-protected-resource/mcp) are publicly discoverable. An unauthenticated MCP request returns HTTP 401 until you sign in.

## Pricing and public facts

Free to start. See [current plans and allowances](https://prompeteer.ai/pricing).

Prompeteer reports 12,000+ users across 160 countries and supports 129 languages. These company facts were approved for publication in September 2026.

## Registry and source

The [official MCP registry](https://registry.modelcontextprotocol.io/?q=prompeteer) lists the server as `io.github.prompeteer/prompeteer-mcp`. This is separate from first-party connector directories.

`server.json` describes both the npm stdio bridge and the hosted Streamable HTTP endpoint. Its registry description uses the canonical tagline because the registry limits descriptions to 100 characters. The full description is preserved in publisher metadata. `.mcp/server.json` is an identical compatibility copy.

Version 2.0.3 adds a working stdio bridge and corrects stale setup instructions. Earlier npm 2.0.0 printed setup instructions and exited, even though registry versions 2.0.0 through 2.0.2 advertised it as a stdio transport. The hosted endpoint remains `https://prompeteer.ai/mcp`.

## Repository manifests for Cursor and Gemini CLI

`plugin.json` and `mcp.json` provide the portable Agent Plugins format supported by Cursor. After installing the plugin through Cursor, connect Prompeteer and complete browser sign-in. The direct Cursor configuration above also works as a manual setup format. Generated skills are returned as content; connecting does not run or install a generated skill.

`gemini-extension.json` provides a Gemini CLI extension using the hosted HTTP endpoint and OAuth discovery. Once the manifest is available in the public repository, install with:

```sh
gemini extensions install https://github.com/prompeteer/prompeteer-mcp
```

Restart Gemini CLI and complete the Prompeteer connection when prompted. Generation and scoring can consume account quota; requested saves write to your PromptDrive.

These manifests have been structurally validated. Installation and OAuth in the actual Cursor and Gemini CLI applications have not been tested for this release. Their presence does not establish a marketplace listing or platform approval. See the [Cursor plugin documentation](https://cursor.com/docs/plugins) and [Gemini extension reference](https://geminicli.com/docs/extensions/reference/).

## Build and verify from source

Use Node.js 22.14.0 or later. The source lock pins the maintained proxy and its dependencies. Build copies those unmodified runtime files, with their licenses, into the release package.

```sh
npm ci --ignore-scripts
npm run build
npm run check
npm test
npm audit
npm pack --dry-run --json --ignore-scripts
```

The explicit build uses `mcp-remote` 0.8.6 and patched `qs` 6.16.0. Tests run protocol forwarding and startup-disconnect checks against local fixtures; they do not generate prompts or make paid service calls. The `vendor/` build output is included in npm releases and is not committed to this repository.

## Support and license

- [Connection guide](https://prompeteer.ai/connect)
- [Privacy policy](https://prompeteer.ai/privacy)
- [Terms of service](https://prompeteer.ai/terms)
- [Issues](https://github.com/prompeteer/prompeteer-mcp/issues)

The bridge wrapper and documentation in this repository are MIT licensed. The hosted Prompeteer platform is proprietary.
