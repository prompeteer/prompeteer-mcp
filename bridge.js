import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const MCP_ENDPOINT = 'https://prompeteer.ai/mcp';
export const PROXY_VERSION = '0.8.6';
const require = createRequire(new URL('./vendor/runtime.cjs', import.meta.url));

/** Resolve the installed, pinned dependency; never download or invoke a shell. */
export function proxyEntrypoint() {
  const packagePath = require.resolve('mcp-remote/package.json');
  const metadata = JSON.parse(readFileSync(packagePath, 'utf8'));
  if (metadata.version !== PROXY_VERSION || metadata.bin?.['mcp-remote'] !== 'dist/proxy.js') {
    throw new Error('The installed MCP proxy does not match the reviewed release. Reinstall this package.');
  }
  return resolve(dirname(packagePath), metadata.bin['mcp-remote']);
}

export function proxyArguments(entrypoint) {
  return [
    entrypoint,
    MCP_ENDPOINT,
    '--transport', 'http-only',
    '--host', '127.0.0.1',
    '--resource', MCP_ENDPOINT,
    '--auth-timeout', '300',
  ];
}

/** The launcher seam supports local fixture tests; it is not exposed by the CLI. */
export function runBridge({ launcher = spawn, runtime = process, entrypoint = proxyEntrypoint() } = {}) {
  const child = launcher(runtime.execPath, proxyArguments(entrypoint), {
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: false,
    windowsHide: true,
  });
  let clientDisconnected = false;
  let failed = false;
  let killTimer;
  const terminate = (signal) => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    child.kill(signal);
    killTimer ??= setTimeout(() => child.kill('SIGKILL'), 1000);
    killTimer.unref();
  };
  const onInterrupt = () => terminate('SIGINT');
  const onTerminate = () => terminate('SIGTERM');
  const onExit = () => terminate('SIGTERM');
  const onInputEnd = () => {
    clientDisconnected = true;
    terminate('SIGTERM');
  };
  const onInputError = () => {
    failed = true;
    terminate('SIGTERM');
  };
  // EPIPE is expected if the proxy exits before its client finishes writing.
  const onPipeError = () => {
    runtime.stdin.unpipe(child.stdin);
    terminate('SIGTERM');
  };
  const cleanup = () => {
    clearTimeout(killTimer);
    runtime.off('SIGINT', onInterrupt);
    runtime.off('SIGTERM', onTerminate);
    runtime.off('exit', onExit);
    runtime.stdin.off('end', onInputEnd);
    runtime.stdin.off('error', onInputError);
    runtime.stdin.unpipe(child.stdin);
    runtime.stdin.pause();
    // Keep the pipe's error listener for any final asynchronous EPIPE event.
  };
  runtime.on('SIGINT', onInterrupt);
  runtime.on('SIGTERM', onTerminate);
  runtime.on('exit', onExit);
  runtime.stdin.once('end', onInputEnd);
  runtime.stdin.once('error', onInputError);
  child.stdin.on('error', onPipeError);
  child.once('error', () => {
    failed = true;
    cleanup();
    runtime.stderr.write('Prompeteer could not start its MCP proxy. Check the Node version and package installation.\n');
    runtime.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    cleanup();
    runtime.exitCode = failed ? 1 : clientDisconnected ? 0 : code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1);
  });
  // pipe applies backpressure and forwards buffered bytes without reading them
  // twice. Watch EOF immediately, before remote discovery or OAuth can finish.
  runtime.stdin.pipe(child.stdin);
  if (runtime.stdin.readableEnded) onInputEnd();
  return child;
}
