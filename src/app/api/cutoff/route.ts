import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const config = db.getCutoffConfig();
  return NextResponse.json({
    success: true,
    cutoff: config,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = db.updateCutoffConfig(body);
    return NextResponse.json({
      success: true,
      message: `Cutoff configuration updated. Cutoff passed: ${updated.cutoff_passed}`,
      cutoff: updated,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to update cutoff" }, { status: 500 });
  }
}
