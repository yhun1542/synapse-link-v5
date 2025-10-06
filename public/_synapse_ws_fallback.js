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
