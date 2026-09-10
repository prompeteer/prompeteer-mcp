import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { EventEmitter, once } from 'node:events';
import { createInterface } from 'node:readline';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { PassThrough } from 'node:stream';
import { join } from 'node:path';
import { MCP_ENDPOINT, runBridge } from '../bridge.js';

// Only this test launcher redirects the fixed product URL to a local fixture.
// The published CLI has no endpoint override or insecure transport flag.
test('installed mcp-remote forwards stdio initialize, tools/list, tools/call, and protocol errors', {timeout:30000}, async (t) => {
  const requests=[];
  const server=createServer(async(req,res)=>{
    if(req.method!=='POST'||req.url!=='/mcp'){res.writeHead(404,{'Content-Type':'application/json'});res.end('{}');return;}
    const chunks=[];for await(const c of req)chunks.push(c);
    const message=JSON.parse(Buffer.concat(chunks).toString());
    requests.push({message,session:req.headers['mcp-session-id']});
    if(message.id===undefined){res.writeHead(202);res.end();return;}
    let result;
    if(message.method==='initialize')result={protocolVersion:message.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'local-transport-fixture',version:'1.0.0'}};
    if(message.method==='tools/list')result={tools:[{name:'fixture_echo',description:'Local test only',inputSchema:{type:'object',properties:{text:{type:'string'}},required:['text']}}]};
    if(message.method==='tools/call')result={content:[{type:'text',text:message.params.arguments.text}]};
    res.writeHead(200,{'Content-Type':'application/json','Mcp-Session-Id':'test-session'});
    res.end(JSON.stringify(result?{jsonrpc:'2.0',id:message.id,result}:{jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Unknown test method'}}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const endpoint=`http://127.0.0.1:${server.address().port}/mcp`;
  const cache=await mkdtemp(join(tmpdir(),'prompeteer-proxy-test-'));
  t.after(()=>rm(cache,{recursive:true,force:true}));
  const runtime=Object.assign(new EventEmitter(),{execPath:process.execPath,stdin:new PassThrough(),stderr:process.stderr});
  const child=runBridge({runtime,launcher:(command,args,options)=>{
    assert.equal(args[1],MCP_ENDPOINT);
    return spawn(command,args.map(arg=>arg===MCP_ENDPOINT?endpoint:arg),{...options,stdio:'pipe',env:{...process.env,MCP_REMOTE_CONFIG_DIR:cache}});
  }});
  let diagnostics='';child.stderr.on('data',chunk=>{diagnostics+=chunk;});
  t.after(async()=>{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await once(child,'exit');}});
  const pending=new Map();const output=[];
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
    output.push(line);
    let message;try{message=JSON.parse(line);}catch{assert.fail(`Non-JSON protocol output: ${line}`);}
    pending.get(message.id)?.(message);
  });
  let id=100;
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const current=++id;
    const timeout=setTimeout(()=>reject(new Error(`Timed out waiting for ${method}: ${diagnostics}`)),10000);
    pending.set(current,message=>{clearTimeout(timeout);pending.delete(current);resolve(message);});
    runtime.stdin.write(JSON.stringify({jsonrpc:'2.0',id:current,method,params})+'\n');
  });
  const initialized=await call('initialize',{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'stdio-fixture',version:'1.0.0'}});
  assert.equal(initialized.result.serverInfo.name,'local-transport-fixture');
  runtime.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const listed=await call('tools/list');assert.equal(listed.result.tools[0].name,'fixture_echo');
  const called=await call('tools/call',{name:'fixture_echo',arguments:{text:'fixture response'}});
  assert.deepEqual(called.result.content,[{type:'text',text:'fixture response'}]);
  const failed=await call('fixture/unknown');assert.equal(failed.error.code,-32601);
  assert.ok(requests.some(r=>r.message.method==='tools/call'&&r.session==='test-session'));
  assert.ok(output.length>=4);
  runtime.stdin.end();await once(child,'exit');
  assert.equal(runtime.exitCode,0);
});


test('client EOF stops the installed proxy while remote discovery is unresponsive', {timeout:10000}, async(t)=>{
  const sockets=new Set();
  let sawRequest;
  const requested=new Promise(resolve=>{sawRequest=resolve;});
  const server=createServer(()=>sawRequest());
  server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{for(const socket of sockets)socket.destroy();return new Promise(resolve=>server.close(resolve));});
  const endpoint=`http://127.0.0.1:${server.address().port}/mcp`;
  const cache=await mkdtemp(join(tmpdir(),'prompeteer-proxy-eof-test-'));
  t.after(()=>rm(cache,{recursive:true,force:true}));
  const runtime=Object.assign(new EventEmitter(),{execPath:process.execPath,stdin:new PassThrough(),stderr:process.stderr});
  const child=runBridge({runtime,launcher:(command,args,options)=>spawn(command,args.map(arg=>arg===MCP_ENDPOINT?endpoint:arg),{...options,stdio:'pipe',env:{...process.env,MCP_REMOTE_CONFIG_DIR:cache}})});
  child.stderr.resume();let output='';child.stdout.on('data',chunk=>{output+=chunk;});
  t.after(()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');});
  await requested;
  const exited=once(child,'exit');
  const endedAt=Date.now();runtime.stdin.end();await exited;
  assert.ok(Date.now()-endedAt<2000);
  assert.equal(output,'');
  assert.equal(runtime.exitCode,0);
  assert.equal(runtime.listenerCount('SIGTERM'),0);
});
