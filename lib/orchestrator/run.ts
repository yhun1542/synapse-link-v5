import { kv } from "@vercel/kv";
import { callOpenAI } from "@/lib/orchestrator/providers/openai";
import { callAnthropic } from "@/lib/orchestrator/providers/anthropic";
import { callGemini } from "@/lib/orchestrator/providers/gemini";
import { callGrok } from "@/lib/orchestrator/providers/grok";
import { toGraph } from "@/lib/orchestrator/graph";

const Q=(sid:string)=>`syn:${sid}:events`;
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
