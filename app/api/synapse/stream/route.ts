import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const Q=(sid:string)=>`syn:${sid}:events`;

export async function GET(req:NextRequest){
  const {searchParams}= new URL(req.url);
  const sid=searchParams.get("sid");
  if(!sid) return new Response("sid required",{status:400});
  const enc=new TextEncoder();
  const stream=new ReadableStream({
    async start(controller){
      const send=(o:unknown)=>controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
      send({event_type:"STREAM_OPEN", payload:{sid}});
      let offset=0, alive=true; const kill=setTimeout(()=>{alive=false}, 1000*60*5);
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
        }catch(e){ send({event_type:"AGENT_DIAG", payload:{model:"system",status:"FAILURE",errorType:"API_ERROR_5XX",message:String(e)}}); }
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
