import OpenAI from "openai";
export async function callOpenAI(prompt:string){
  let apiKey = (process.env.OPENAI_API_KEY || "").trim();
  // Remove Bearer prefix if present
  if (apiKey.startsWith("Bearer ")) {
    apiKey = apiKey.substring(7).trim();
  }
  const client = new OpenAI({ apiKey });
  const model = "gpt-4o";
  try {
    const rsp = await client.chat.completions.create({ model, messages:[{role:"user", content: prompt}], temperature:0.4 });
    const text = rsp.choices?.[0]?.message?.content ?? "";
    return { provider:"openai", model, text };
  } catch (error: unknown) {
    console.error("[OpenAI] Error:", error);
    return { provider:"openai", model, text:"" };
  }
}
