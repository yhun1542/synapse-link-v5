import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function callAnthropic(prompt:string){
  const model = "claude-sonnet-4-5-20250929";
  const rsp = await client.messages.create({ model, max_tokens:1024, messages:[{ role:"user", content: prompt }], temperature:0.3 });
  const text = rsp.content?.map(c => ('text' in c ? c.text : "")).join("") ?? "";
  return { provider:"anthropic", model, text };
}
