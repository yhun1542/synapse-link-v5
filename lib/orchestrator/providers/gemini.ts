import { GoogleGenerativeAI } from "@google/generative-ai";
export async function callGemini(prompt:string){
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const modelId = "gemini-2.5-pro";
  const model = genAI.getGenerativeModel({ model: modelId });
  const rsp = await model.generateContent({ contents:[{ role:"user", parts:[{text:prompt}] }] });
  const text = rsp.response.text();
  return { provider:"gemini", model: modelId, text };
}
