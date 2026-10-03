import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand") || undefined;
  const district = searchParams.get("district") || undefined;
  const depot = searchParams.get("depot") || undefined;

  const outlets = db.getOutlets({ brand, district, depot });
  return NextResponse.json({
    success: true,
    count: outlets.length,
    outlets,
  });
}
