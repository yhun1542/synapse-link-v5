import fetch from "cross-fetch";
export async function callGemini(prompt:string){
  const model = "gemini-2.5-pro";
  const key = process.env.GEMINI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const rsp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  });
  if(!rsp.ok) return { provider:"gemini", model, text:"" };
  const json = await rsp.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { provider:"gemini", model, text };
}
