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
    const scannerStatusDoc = await db.collection("systemStatus").doc("alertScanner").get();

    const telegramData = telegramDoc.exists ? telegramDoc.data() : { enabled: false, chatId: null };
    const alertSettingsData = alertSettingsDoc.exists ? alertSettingsDoc.data() || {} : {};
    
    const finalAlertSettings = normalizeAlertSettings(alertSettingsData);

    // Repair subscriptions created before the multi-user scanner existed or after
    // an interrupted settings save. A connected user should not have to reopen and
    // manually save the advanced form before receiving cloud alerts.
    if (telegramData?.enabled && telegramData?.chatId && finalAlertSettings.enabled) {
      await db.collection("activeAlertSubscriptions").doc(uid).set({
        uid,
        chatId: telegramData.chatId,
        ...finalAlertSettings,
        updatedAt: Date.now(),
      }, { merge: true });
    }

    return NextResponse.json({
      success: true,
      telegram: telegramData,
      alertSettings: finalAlertSettings,
      scannerStatus: scannerStatusDoc.exists ? scannerStatusDoc.data() : null,
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
      await db.collection("users").doc(uid).collection("settings").doc("telegram").set({
        enabled: Boolean(enabled),
      }, { merge: true });
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
