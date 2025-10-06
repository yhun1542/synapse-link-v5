import { NextRequest } from "next/server";
import { callOpenAI } from "@/lib/orchestrator/providers/openai";
import { callAnthropic } from "@/lib/orchestrator/providers/anthropic";
import { callGemini } from "@/lib/orchestrator/providers/gemini";
import { callGrok } from "@/lib/orchestrator/providers/grok";
import { toGraph } from "@/lib/orchestrator/graph";

export const dynamic = "force-dynamic";

type ProviderResult = {
  provider: string;
  model: string;
  text: string;
  error?: string;
};

type CallResult = 
  | { ok: true; r: ProviderResult }
  | { ok: false; e: string };

export async function POST(req: NextRequest){
  const { prompt } = await req.json();
  if(!prompt) return new Response(JSON.stringify({error:"prompt required"}),{ status:400 });

  const stream = new ReadableStream({
    async start(controller){
      const enc = new TextEncoder();
      const send = (obj: Record<string, unknown>)=>controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const results: Array<{provider: string; model: string; text: string}> = [];

      // start
      send({ event_type:"SESSION_START", payload:{ ts: Date.now() } });

      // 병렬 호출 + 격리
      const calls = [
        callGemini(prompt),
        callAnthropic(prompt),
        callGrok(prompt),
        callOpenAI(prompt),
      ].map(p => p.then(r => ({ok:true as const, r})).catch(e => ({ok:false as const, e: String(e)})));

      const settled = await Promise.allSettled(calls);
      for(const s of settled){
        if(s.status === "fulfilled"){
          const v = s.value as CallResult;
          if(v.ok){
            const {provider, model, text} = v.r;
            results.push({provider, model, text});
            send({ event_type:"AGENT_FINISH", payload:{ provider, model, excerpt: (text||"").slice(0,200) } });
          }else{
            send({ event_type:"AGENT_ERROR", payload:{ error: v.e }});
          }
        }else{
          send({ event_type:"AGENT_ERROR", payload:{ error: String(s.reason) }});
        }
      }

      // 합성 → 그래프
      const graph = toGraph(results);
      send({ event_type:"GRAPH_READY", payload: graph });

      // 종료
      send({ event_type:"SESSION_END", payload:{ ts: Date.now() } });
      controller.close();
    }
  });

  return new Response(stream, {
    headers:{
      "Content-Type":"text/event-stream; charset=utf-8",
      "Cache-Control":"no-cache, no-transform",
      "Connection":"keep-alive",
      "X-Accel-Buffering":"no"
    }
  });
}
