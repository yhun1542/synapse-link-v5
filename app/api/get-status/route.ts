import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(){
  // 필요 시 KV 연동. 지금은 기본 상태 반환
  return NextResponse.json({ ok:true, status:"ready" });
}
