#!/usr/bin/env bash
# UAF v32 Synapse V5 patch: diagnose -> auto-fix -> verify
# - 3엔드포인트(session/stream/run) + HTML 교정 + KV 큐 + WS 폴백
set -euo pipefail
IFS=$'\n\t'

ROOT="${1:-.}"
cd "$ROOT"

say(){ printf "\033[36m[patch]\033[0m %s\n" "$*"; }
die(){ printf "\033[31m[patch]\033[0m %s\n" "$*" >&2; exit 2; }

# ---------- 0) Pre-check ----------
say "check package.json"
[ -f package.json ] || die "package.json not found (Next.js repo root에서 실행하세요)"

say "install deps"
npm i -S @vercel/kv uuid socket.io socket.io-client >/dev/null

mkdir -p app/api/synapse/session app/api/synapse/stream lib/orchestrator/providers lib/orchestrator public ws tools

# ---------- 1) Diagnose ----------
say "diagnose .env.local keys & KV"
MISS=()
grep -q "OPENAI_API_KEY" .env.local 2>/dev/null || MISS+=("OPENAI_API_KEY")
grep -q "ANTHROPIC_API_KEY" .env.local 2>/dev/null || MISS+=("ANTHROPIC_API_KEY")
grep -q "GEMINI_API_KEY" .env.local 2>/dev/null || MISS+=("GEMINI_API_KEY")
grep -q "XAI_API_KEY" .env.local 2>/dev/null || MISS+=("XAI_API_KEY")
grep -q "KV_REST_API_URL" .env.local 2>/dev/null || MISS+=("KV_REST_API_URL")
grep -q "KV_REST_API_TOKEN" .env.local 2>/dev/null || MISS+=("KV_REST_API_TOKEN")
if [ ${#MISS[@]} -gt 0 ]; then
  say "WARN missing keys: ${MISS[*]} (실행은 가능, 캐시/일부 기능 비활성)"
fi

# ---------- 2) Providers (idempotent) ----------
say "write providers"
cat > lib/orchestrator/providers/openai.ts <<'TS'
import OpenAI from "openai";
export async function callOpenAI(prompt:string){
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const model = "gpt-4o";
  const rsp = await client.chat.completions.create({ model, messages:[{role:"user", content: prompt}], temperature:0.4 });
  const text = rsp.choices?.[0]?.message?.content ?? "";
  return { provider:"openai", model, text };
}
TS

cat > lib/orchestrator/providers/anthropic.ts <<'TS'
import Anthropic from "@anthropic-ai/sdk";
export async function callAnthropic(prompt:string){
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const model = "claude-sonnet-4-5-20250929";
  const rsp = await client.messages.create({ model, max_tokens:1024, messages:[{ role:"user", content: prompt }], temperature:0.3 });
  const text = rsp.content?.map(c => ('text' in c ? c.text : "")).join("") ?? "";
  return { provider:"anthropic", model, text };
}
TS

cat > lib/orchestrator/providers/gemini.ts <<'TS'
import { GoogleGenerativeAI } from "@google/generative-ai";
export async function callGemini(prompt:string){
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const modelId = "gemini-2.5-pro";
  const model = genAI.getGenerativeModel({ model: modelId });
  const rsp = await model.generateContent({ contents:[{ role:"user", parts:[{text:prompt}] }] });
  const text = rsp.response.text();
  return { provider:"gemini", model: modelId, text };
}
TS

cat > lib/orchestrator/providers/grok.ts <<'TS'
import fetch from "cross-fetch";
export async function callGrok(prompt:string){
  const model = "grok-4-0709";
  const key = process.env.XAI_API_KEY!;
  const rsp = await fetch("https://api.x.ai/v1/chat/completions",{
    method:"POST",
    headers:{ "Authorization":\`Bearer \${key}\`, "Content-Type":"application/json" },
    body: JSON.stringify({ model, messages:[{role:"user", content: prompt}], max_tokens:1024, temperature:0.4 })
  });
  if(!rsp.ok) return { provider:"xai", model, text:"" };
  const json = await rsp.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  return { provider:"xai", model, text };
}
TS

# ---------- 3) Graph & runSession ----------
say "write graph/run"
cat > lib/orchestrator/graph.ts <<'TS'
export type Node = { id:string; label:string; provider:string; };
export type Edge = { from:string; to:string; label?:string; };
export function toGraph(results:{provider:string, model:string, text:string}[]){
  const nodes:Node[] = results.map((r,i)=>({ id:\`n\${i+1}\`, label:r.text?.slice(0,160)||"(empty)", provider:r.provider }));
  const edges:Edge[] = [];
  if(nodes.length>0) for(let i=1;i<nodes.length;i++) edges.push({from:nodes[0].id,to:nodes[i].id,label:"evidence"});
  return { nodes, edges };
}
TS

cat > lib/orchestrator/run.ts <<'TS'
import { kv } from "@vercel/kv";
import { callOpenAI } from "@/lib/orchestrator/providers/openai";
import { callAnthropic } from "@/lib/orchestrator/providers/anthropic";
import { callGemini } from "@/lib/orchestrator/providers/gemini";
import { callGrok } from "@/lib/orchestrator/providers/grok";
import { toGraph } from "@/lib/orchestrator/graph";

const Q=(sid:string)=>\`syn:\${sid}:events\`;
const push=async(sid:string, e:any)=>kv.lpush(Q(sid), JSON.stringify(e));

export async function runSession(sid:string, prompt:string){
  const tasks = [
    callGemini(prompt).then(r=>({ok:true,r})).catch(e=>({ok:false,e:String(e),who:"gemini"})),
    callAnthropic(prompt).then(r=>({ok:true,r})).catch(e=>({ok:false,e:String(e),who:"anthropic"})),
    callGrok(prompt).then(r=>({ok:true,r})).catch(e=>({ok:false,e:String(e),who:"xai"})),
    callOpenAI(prompt).then(r=>({ok:true,r})).catch(e=>({ok:false,e:String(e),who:"openai"})),
  ];
  const settled = await Promise.allSettled(tasks);
  const results:any[] = [];
  for(const s of settled){
    if(s.status==="fulfilled" && s.value.ok){
      const {provider, model, text}=s.value.r;
      results.push({provider, model, text});
      await push(sid,{event_type:"AGENT_FINISH", payload:{provider,model,excerpt:(text||"").slice(0,180)}});
    } else {
      const w = (s.status==="fulfilled")?s.value.who:"unknown";
      await push(sid,{event_type:"AGENT_DIAG", payload:{model:w,status:"FAILURE",errorType:"UNKNOWN",message:(s.status==="fulfilled")?s.value.e:String(s.reason)}});
    }
  }
  await push(sid,{event_type:"GRAPH_READY", payload: toGraph(results)});
  await push(sid,{event_type:"SESSION_END", payload:{}});
}
TS

# ---------- 4) API: session (POST) ----------
say "write session endpoint"
cat > app/api/synapse/session/route.ts <<'TS'
import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { v4 as uuid } from "uuid";
import { runSession } from "@/lib/orchestrator/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Q=(sid:string)=>\`syn:\${sid}:events\`; const P=(sid:string)=>\`syn:\${sid}:prompt\`;

export async function POST(req:NextRequest){
  const { prompt } = await req.json().catch(()=>({}));
  if(!prompt || String(prompt).length<4) return NextResponse.json({error:"prompt required"},{status:400});
  const sid = uuid();
  await kv.set(P(sid), String(prompt));
  await kv.del(Q(sid));
  await kv.lpush(Q(sid), JSON.stringify({event_type:"SESSION_START", payload:{sid, ts:Date.now()}}));
  (async()=>{ try{ await runSession(sid, String(prompt)); }catch(e:any){
    await kv.lpush(Q(sid), JSON.stringify({event_type:"AGENT_DIAG", payload:{model:"system",status:"FAILURE",errorType:"UNKNOWN",message:String(e)}}));
    await kv.lpush(Q(sid), JSON.stringify({event_type:"SESSION_END", payload:{}}));
  }})();
  return NextResponse.json({ sid },{status:200});
}
TS

# ---------- 5) API: stream (GET) ----------
say "write stream endpoint"
cat > app/api/synapse/stream/route.ts <<'TS'
import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Q=(sid:string)=>\`syn:\${sid}:events\`;

export async function GET(req:NextRequest){
  const {searchParams}= new URL(req.url);
  const sid=searchParams.get("sid");
  if(!sid) return new Response("sid required",{status:400});
  const enc=new TextEncoder();
  const stream=new ReadableStream({
    async start(controller){
      const send=(o:any)=>controller.enqueue(enc.encode(\`data: \${JSON.stringify(o)}\\n\\n\`));
      send({event_type:"STREAM_OPEN", payload:{sid}});
      let offset=0, alive=true, kill=setTimeout(()=>{alive=false}, 1000*60*5);
      while(alive){
        try{
          const len=(await kv.llen(Q(sid)))||0;
          if(len>offset){
            const items=await kv.lrange(Q(sid), offset, len-1);
            offset=len;
            for(const raw of items){
              const e=(typeof raw==="string")?JSON.parse(raw):raw;
              send(e);
              if(e?.event_type==="SESSION_END"){ alive=false; break; }
            }
          }
        }catch(e:any){ send({event_type:"AGENT_DIAG", payload:{model:"system",status:"FAILURE",errorType:"API_ERROR_5XX",message:String(e)}}); }
        await new Promise(r=>setTimeout(r,300));
      }
      clearTimeout(kill); controller.close();
    }
  });
  return new Response(stream,{headers:{
    "Content-Type":"text/event-stream; charset=utf-8",
    "Cache-Control":"no-cache, no-transform",
    "Connection":"keep-alive",
    "X-Accel-Buffering":"no"
  }});
}
TS

# ---------- 6) HTML: 세션 생성 + SSE/WS 폴백 ----------
say "write WS fallback shim"
cat > public/_synapse_ws_fallback.js <<'JS'
(function(){
  const WS_PORT = Number((window.__WS_PORT__||'8787'));
  const WS_URL = window.__WS_URL__ || (location.origin.replace(/^http/,'ws').replace(/\/$/,'').replace(/:\d+$/,'')+':'+WS_PORT);
  window.__synapseConnect = function(sid, onEvent){
    try{
      const es = new EventSource(\`/api/synapse/stream?sid=\${encodeURIComponent(sid)}\`);
      es.onmessage = ev => onEvent(JSON.parse(ev.data));
      es.onerror = ()=>{ es.close();
        const s=document.createElement("script"); s.src="https://cdn.socket.io/4.7.4/socket.io.min.js";
        s.onload=()=>{ const io=window.io; const sock=io(WS_URL,{transports:["websocket"]}); sock.emit("subscribe", sid); sock.on("event", onEvent); };
        document.head.appendChild(s);
      };
    }catch(e){ console.error(e); }
  };
})();
JS

# ---------- 7) WS relay (옵션) ----------
say "write ws/relay.ts"
cat > ws/relay.ts <<'TS'
import http from "http";
import { Server } from "socket.io";
import { kv } from "@vercel/kv";
const port = Number(process.env.WS_PORT||8787);
const io = new Server(http.createServer().listen(port,{host:"0.0.0.0"}),{cors:{origin:"*"}});
const Q=(sid:string)=>\`syn:\${sid}:events\`;
io.on("connection",(socket)=>{
  socket.on("subscribe", async (sid:string)=>{
    socket.join(sid);
    let off=0; const timer=setInterval(async ()=>{
      const len=(await kv.llen(Q(sid)))||0;
      if(len>off){
        const evs=await kv.lrange(Q(sid), off, len-1); off=len;
        for(const raw of evs){ const e=(typeof raw==="string")?JSON.parse(raw):raw; io.to(sid).emit("event",e); if(e?.event_type==="SESSION_END"){ clearInterval(timer); break; } }
      }
    },300);
    socket.on("disconnect",()=>clearInterval(timer));
  });
});
console.log(\`[ws] relay listening on \${port}\`);
TS

# ---------- 8) Verify helper ----------
say "write tools/verify_synapse.sh"
cat > tools/verify_synapse.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail
HOST="${1:-http://127.0.0.1:3000}"
SID=$(curl -s -X POST "$HOST/api/synapse/session" -H 'Content-Type: application/json' -d '{"prompt":"test prompt for CRE"}' | jq -r .sid)
[ "$SID" = "null" ] && { echo "session failed"; exit 2; }
echo "[ok] sid: $SID"
curl -s -N "$HOST/api/synapse/stream?sid=$SID" --max-time 5 | head -n 5
echo "[ok] stream head printed"
SH
chmod +x tools/verify_synapse.sh

say "all done"
