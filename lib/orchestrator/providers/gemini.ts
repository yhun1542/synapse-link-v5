import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

export async function callGemini(prompt:string){
  const modelId = "gemini-2.5-pro";
  const rsp = await model.generateContent({ contents:[{ role:"user", parts:[{text:prompt}] }] });
  const text = rsp.response.text();
  return { provider:"gemini", model: modelId, text };
}
