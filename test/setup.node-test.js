import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { MCP_ENDPOINT, PROXY_VERSION, proxyEntrypoint, proxyArguments, runBridge } from '../bridge.js';

const root = new URL('../', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const run = (...args) => spawnSync(process.execPath, [new URL('index.js', root).pathname, ...args], { encoding: 'utf8', timeout: 3000 });

test('help explains real stdio and remote setup without starting network work', () => {
  const result = run('--help');
  assert.equal(result.status, 0);
  assert.match(result.stdout, /runs an MCP stdio bridge/);
  assert.match(result.stdout, /OAuth sign-in opens in your browser/);
  assert.doesNotMatch(result.stdout, /\/mcp\/sse|@prompeteer\/mcp-server/);
});

test('emits only parseable Cursor JSON on request', () => {
  const result = run('--json');
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {mcpServers:{prompeteer:{url:MCP_ENDPOINT}}});
});

test('reports actual package version', () => {
  const result = run('--version');
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), pkg.version);
});

test('rejects endpoint and proxy flag overrides', () => {
  for (const args of [['https://example.com/mcp'], ['--allow-http'], ['--header','Authorization: example'], ['--debug']]) {
    const result = run(...args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Unknown arguments/);
  }
});

test('registry versions match and expose both real connection methods', () => {
  const registry = JSON.parse(readFileSync(new URL('server.json', root), 'utf8'));
  assert.equal(registry.version, pkg.version);
  assert.ok(registry.description.length <= 100);
  assert.deepEqual(registry.packages, [{registryType:'npm',identifier:pkg.name,version:pkg.version,transport:{type:'stdio'}}]);
  assert.deepEqual(registry.remotes, [{type:'streamable-http',url:MCP_ENDPOINT}]);
  assert.deepEqual(JSON.parse(readFileSync(new URL('.mcp/server.json', root), 'utf8')), registry);
  assert.equal(registry._meta['io.modelcontextprotocol.registry/publisher-provided']['ai.prompeteer/distribution'].shortDescription,pkg.description);
});

test('launches only the installed pinned proxy and canonical HTTPS resource without a shell', () => {
  assert.equal(pkg.devDependencies['mcp-remote'],PROXY_VERSION);
  assert.match(proxyEntrypoint(),/mcp-remote\/dist\/proxy\.js$/);
  const runtime = Object.assign(new EventEmitter(), {execPath:process.execPath,stdin:new PassThrough(),stderr:{write(){}}});
  const child = Object.assign(new EventEmitter(), {exitCode:null,signalCode:null,stdin:new PassThrough(),kill(){}});
  let actual;
  runBridge({runtime,launcher:(...args)=>{actual=args;return child;}});
  assert.equal(actual[0],process.execPath);
  assert.deepEqual(actual[1],proxyArguments(proxyEntrypoint()));
  assert.deepEqual(actual[2],{stdio:['pipe','inherit','inherit'],shell:false,windowsHide:true});
  assert.equal(actual[1][1],MCP_ENDPOINT);
  assert.equal(actual[1][actual[1].indexOf('--resource')+1],MCP_ENDPOINT);
  assert.equal(actual[1][actual[1].indexOf('--host')+1],'127.0.0.1');
  assert.equal(actual[1][actual[1].indexOf('--transport')+1],'http-only');
  child.emit('exit',0,null);
  assert.equal(runtime.listenerCount('SIGINT'),0);
  assert.equal(runtime.listenerCount('SIGTERM'),0);
  assert.equal(runtime.exitCode,0);
});

test('forwards termination and records unsuccessful proxy exit without leaking errors', () => {
  const logs=[];const signals=[];
  const runtime=Object.assign(new EventEmitter(),{execPath:process.execPath,stdin:new PassThrough(),stderr:{write:(s)=>logs.push(s)}});
  const child=Object.assign(new EventEmitter(),{exitCode:null,signalCode:null,stdin:new PassThrough(),kill:(s)=>signals.push(s)});
  runBridge({runtime,launcher:()=>child});
  runtime.emit('SIGTERM');assert.deepEqual(signals,['SIGTERM']);
  child.emit('error',new Error('secret fixture value'));
  assert.equal(runtime.exitCode,1);assert.doesNotMatch(logs.join(''),/secret fixture/);
  assert.equal(runtime.listenerCount('exit'),0);
});
