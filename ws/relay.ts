import http from "http";
import { Server } from "socket.io";
import { kv } from "@vercel/kv";
const port = Number(process.env.WS_PORT||8787);
const io = new Server(http.createServer().listen(port,{host:"0.0.0.0"}),{cors:{origin:"*"}});
const Q=(sid:string)=>`syn:${sid}:events`;
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
console.log(`[ws] relay listening on ${port}`);
