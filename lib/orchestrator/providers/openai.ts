import OpenAI from "openai";

export async function callOpenAI(prompt: string) {
  try {
    console.log("[OpenAI] Starting API call...");
    
    const rawApiKey = process.env.OPENAI_API_KEY;
    if (!rawApiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    
    // API 키 정리 (Bearer 접두사 제거)
    const apiKey = rawApiKey.replace(/^Bearer\s+/i, '').trim();
    
    console.log("[OpenAI] API Key cleaned");
    
    const client = new OpenAI({ 
      apiKey,
      timeout: 60000,
      maxRetries: 2,
    });
    
    // GPT-4o로 변경
    const model = "gpt-4o";
    console.log("[OpenAI] Model:", model);
    console.log("[OpenAI] Making API request...");
    
    const startTime = Date.now();
    const rsp = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1024,
      temperature: 0.7,
    });
    const duration = Date.now() - startTime;
    
    console.log("[OpenAI] Response received in", duration, "ms");
    const text = rsp.choices?.[0]?.message?.content ?? "";
    console.log("[OpenAI] Response length:", text.length);
    
    return { provider: "openai", model, text };
  } catch (error) {
    console.error("[OpenAI] Error:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
