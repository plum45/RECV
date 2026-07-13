import { NextResponse } from "next/server";
import { verifyFirebaseIdTokenDetailed, getFirebaseAdminDb } from "../../../../lib/firebaseAdmin";
import { normalizeAlertSettings } from "../../../../lib/alertUtils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { decoded, error: authErr } = await verifyFirebaseIdTokenDetailed(request);
    if (!decoded || !decoded.uid) {
      return NextResponse.json({ success: false, message: `Unauthorized (${authErr || "Invalid token"})` }, { status: 401 });
    }

    const uid = decoded.uid;
    const db = getFirebaseAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, message: "Database not initialized" }, { status: 500 });
    }

    const telegramDoc = await db.collection("users").doc(uid).collection("settings").doc("telegram").get();
    const alertSettingsDoc = await db.collection("users").doc(uid).collection("settings").doc("alertSettings").get();

    const telegramData = telegramDoc.exists ? telegramDoc.data() : { enabled: false, chatId: null };
    const alertSettingsData = alertSettingsDoc.exists ? alertSettingsDoc.data() || {} : {};
    
    const finalAlertSettings = normalizeAlertSettings(alertSettingsData);

    return NextResponse.json({
      success: true,
      telegram: telegramData,
      alertSettings: finalAlertSettings,
    });
  } catch (error: any) {
    console.error("Get settings error:", error.message);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { decoded, error: authErr } = await verifyFirebaseIdTokenDetailed(request);
    if (!decoded || !decoded.uid) {
      return NextResponse.json({ success: false, message: `Unauthorized (${authErr || "Invalid token"})` }, { status: 401 });
    }

    const uid = decoded.uid;
    const db = getFirebaseAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, message: "Database not initialized" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { action, alertSettings } = body;

    if (action === "disconnect") {
      await db.collection("users").doc(uid).collection("settings").doc("telegram").set({
        enabled: false,
        chatId: null,
        disconnectedAt: Date.now(),
      }, { merge: true });
      await db.collection("activeAlertSubscriptions").doc(uid).delete().catch(() => {});
      return NextResponse.json({ success: true, message: "Disconnected Telegram successfully" });
    }

    if (action === "toggle_telegram") {
      const { enabled } = body;
      await db.collection("users").doc(uid).collection("settings").doc("telegram").update({
        enabled: Boolean(enabled),
      });
      if (!enabled) {
        await db.collection("activeAlertSubscriptions").doc(uid).delete().catch(() => {});
      } else {
        const tgDoc = await db.collection("users").doc(uid).collection("settings").doc("telegram").get();
        const alertDoc = await db.collection("users").doc(uid).collection("settings").doc("alertSettings").get();
        const tgData = tgDoc.data() || {};
        const alertData = normalizeAlertSettings(alertDoc.data() || {});
        if (tgData.chatId) {
          await db.collection("activeAlertSubscriptions").doc(uid).set({
            uid,
            chatId: tgData.chatId,
            ...alertData,
            updatedAt: Date.now(),
          }, { merge: true });
        }
      }
      return NextResponse.json({ success: true });
    }

    if (alertSettings) {
      const updatedAlertData = normalizeAlertSettings(alertSettings, Date.now());
      await db.collection("users").doc(uid).collection("settings").doc("alertSettings").set(updatedAlertData, { merge: true });

      const tgDoc = await db.collection("users").doc(uid).collection("settings").doc("telegram").get();
      const tgData = tgDoc.data() || {};
      if (tgData.chatId && tgData.enabled) {
        if (updatedAlertData.enabled) {
          await db.collection("activeAlertSubscriptions").doc(uid).set({
            uid,
            chatId: tgData.chatId,
            ...updatedAlertData,
          }, { merge: true });
        } else {
          await db.collection("activeAlertSubscriptions").doc(uid).delete().catch(() => {});
        }
      }
      return NextResponse.json({ success: true, alertSettings: updatedAlertData });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Post telegram settings error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
