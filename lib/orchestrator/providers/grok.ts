import fetch from "cross-fetch";

export async function callGrok(prompt: string) {
  try {
    // grok-4 alias 사용 (더 안정적)
    const model = "grok-4";
    const key = process.env.XAI_API_KEY!;
    
    if (!key) {
      throw new Error("XAI_API_KEY is not set");
    }
    
    // API 키 정리 (Bearer 접두사 제거)
    const cleanKey = key.replace(/^Bearer\s+/i, '').trim();
    
    console.log("[Grok] Starting API call...");
    console.log("[Grok] Model:", model);
    console.log("[Grok] API Key length:", cleanKey.length);
    
    const rsp = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cleanKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 2048,
        temperature: 0.4
        // presencePenalty, frequencyPenalty, stop 등은 제거 (grok-4에서 미지원)
      })
    });
    
    if (!rsp.ok) {
      const errorText = await rsp.text();
      console.error("[Grok] API error status:", rsp.status);
      console.error("[Grok] API error body:", errorText);
      
      let errorJson;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        errorJson = { error: errorText };
      }
      
      return { 
        provider: "xai", 
        model, 
        text: "", 
        error: errorJson.error || errorText 
      };
    }
    
    const json = await rsp.json();
    console.log("[Grok] Response received");
    
    const text = json?.choices?.[0]?.message?.content ?? "";
    console.log("[Grok] Response length:", text.length);
    
    return { provider: "xai", model, text };
  } catch (error) {
    console.error("[Grok] Exception:", error);
    throw error;
  }
}
