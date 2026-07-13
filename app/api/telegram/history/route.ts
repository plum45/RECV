import { NextResponse } from "next/server";
import { getFirebaseAdminDb, verifyFirebaseIdTokenDetailed } from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // 1. Enforce Firebase Auth
    const { decoded, error: authErr } = await verifyFirebaseIdTokenDetailed(request);
    if (!decoded || !decoded.uid) {
      return NextResponse.json(
        { 
          error: "Unauthorized", 
          message: `กรุณาเข้าสู่ระบบก่อนใช้งาน: ${authErr || "Token verification failed"}` 
        }, 
        { status: 401 }
      );
    }

    const uid = decoded.uid;
    const db = getFirebaseAdminDb();
    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    // 2. Fetch alertHistoryLogs sorted by sentAt desc (limit to 100)
    const logsSnap = await db.collection("users")
      .doc(uid)
      .collection("alertHistoryLogs")
      .orderBy("sentAt", "desc")
      .limit(100)
      .get();

    const logs: any[] = [];
    logsSnap.forEach((doc) => {
      logs.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return NextResponse.json({
      success: true,
      logs
    });
  } catch (error: any) {
    console.error("Failed to fetch alert history logs:", error.message);
    return NextResponse.json({ error: "Failed to fetch logs", message: error.message }, { status: 500 });
  }
}
