import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { 
      success: false, 
      error: "This endpoint has been disabled for security reasons. Client-provided tokens are not permitted." 
    }, 
    { status: 403 }
  );
}
