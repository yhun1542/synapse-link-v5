import fetch from "cross-fetch";
export async function callGrok(prompt:string){
  const model = "grok-4-0709";
  const key = process.env.XAI_API_KEY!;
  const rsp = await fetch("https://api.x.ai/v1/chat/completions",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${key}`, "Content-Type":"application/json" },
    body: JSON.stringify({ model, messages:[{role:"user", content: prompt}], max_tokens:1024, temperature:0.4 })
  });
  if(!rsp.ok) return { provider:"xai", model, text:"" };
  const json = await rsp.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  return { provider:"xai", model, text };
}

