import { NextResponse } from "next/server";
import { getPublicFlowiseConfig } from "@/lib/flowise/config";
import { probeFlowise } from "@/lib/flowise/client.server";

export async function GET() {
  return NextResponse.json({ ...getPublicFlowiseConfig(), ...(await probeFlowise()) });
}

export async function POST() {
  return GET();
}
