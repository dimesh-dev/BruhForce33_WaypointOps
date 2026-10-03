import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const depot = searchParams.get("depot") || undefined;
  const type = searchParams.get("type") || undefined;
  const temp = searchParams.get("temp") || undefined;
  const status = searchParams.get("status") || undefined;

  const vehicles = db.getVehicles({ depot, type, temp, status });
  return NextResponse.json({
    success: true,
    count: vehicles.length,
    vehicles,
  });
}
