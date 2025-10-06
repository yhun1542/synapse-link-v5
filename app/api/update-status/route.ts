import { NextRequest, NextResponse } from "next/server";
export async function POST(req:NextRequest){
  const data = await req.json();
  // KV 연동시 여기서 write
  return NextResponse.json({ ok:true, received: data });
}
