import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { v4 as uuid } from "uuid";
import { runSession } from "@/lib/orchestrator/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Q=(sid:string)=>`syn:${sid}:events`; const P=(sid:string)=>`syn:${sid}:prompt`;

export async function POST(req:NextRequest){
  const { prompt } = await req.json().catch(()=>({}));
  if(!prompt || String(prompt).length<4) return NextResponse.json({error:"prompt required"},{status:400});
  const sid = uuid();
  await kv.set(P(sid), String(prompt));
  await kv.del(Q(sid));
  await kv.lpush(Q(sid), JSON.stringify({event_type:"SESSION_START", payload:{sid, ts:Date.now()}}));
  (async()=>{ try{ await runSession(sid, String(prompt)); }catch(e){
    await kv.lpush(Q(sid), JSON.stringify({event_type:"AGENT_DIAG", payload:{model:"system",status:"FAILURE",errorType:"UNKNOWN",message:String(e)}}));
    await kv.lpush(Q(sid), JSON.stringify({event_type:"SESSION_END", payload:{}}));
  }})();
  return NextResponse.json({ sid },{status:200});
}
