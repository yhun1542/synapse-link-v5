import OpenAI from "openai";
export async function callOpenAI(prompt:string){
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const model = "gpt-4o";
  const rsp = await client.chat.completions.create({ model, messages:[{role:"user", content: prompt}], temperature:0.4 });
  const text = rsp.choices?.[0]?.message?.content ?? "";
  return { provider:"openai", model, text };
}
