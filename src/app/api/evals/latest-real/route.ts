import { NextResponse } from "next/server";
import { getLatestSuccessfulRealEval } from "@/lib/studio/real-eval.server";

export async function GET() { return NextResponse.json(await getLatestSuccessfulRealEval()); }
