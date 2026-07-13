import { NextResponse } from "next/server";
import { verifyFirebaseIdTokenDetailed, getFirebaseAdminDb } from "../../../../lib/firebaseAdmin";

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
    
    const finalAlertSettings = {
      enabled: true,
      symbols: ["BTC-USD", "ETH-USD", "SOL-USD"],
      rsiEnabled: true,
      macdEnabled: true,
      srFlipEnabled: true,
      supportEnabled: true,
      cooldownMinutes: 120,
      quietHours: { enabled: false, start: "22:00", end: "06:00" },
      configs: {},
      ...alertSettingsData,
    };

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
        const alertData = alertDoc.data() || {};
        if (tgData.chatId) {
          await db.collection("activeAlertSubscriptions").doc(uid).set({
            uid,
            chatId: tgData.chatId,
            enabled: Boolean(alertData.enabled !== undefined ? alertData.enabled : true),
            symbols: Array.isArray(alertData.symbols) ? alertData.symbols : ["BTC-USD", "ETH-USD", "SOL-USD"],
            rsiEnabled: alertData.rsiEnabled !== undefined ? Boolean(alertData.rsiEnabled) : true,
            macdEnabled: alertData.macdEnabled !== undefined ? Boolean(alertData.macdEnabled) : true,
            srFlipEnabled: alertData.srFlipEnabled !== undefined ? Boolean(alertData.srFlipEnabled) : true,
            supportEnabled: alertData.supportEnabled !== undefined ? Boolean(alertData.supportEnabled) : true,
            cooldownMinutes: typeof alertData.cooldownMinutes === "number" ? alertData.cooldownMinutes : 120,
            updatedAt: Date.now(),
          }, { merge: true });
        }
      }
      return NextResponse.json({ success: true });
    }

    if (alertSettings) {
      const updatedAlertData = {
        enabled: alertSettings.enabled !== undefined ? Boolean(alertSettings.enabled) : true,
        symbols: Array.isArray(alertSettings.symbols) ? alertSettings.symbols : ["BTC-USD", "ETH-USD", "SOL-USD"],
        rsiEnabled: alertSettings.rsiEnabled !== undefined ? Boolean(alertSettings.rsiEnabled) : true,
        macdEnabled: alertSettings.macdEnabled !== undefined ? Boolean(alertSettings.macdEnabled) : true,
        srFlipEnabled: alertSettings.srFlipEnabled !== undefined ? Boolean(alertSettings.srFlipEnabled) : true,
        supportEnabled: alertSettings.supportEnabled !== undefined ? Boolean(alertSettings.supportEnabled) : true,
        cooldownMinutes: typeof alertSettings.cooldownMinutes === "number" && alertSettings.cooldownMinutes >= 15 ? alertSettings.cooldownMinutes : 120,
        quietHours: alertSettings.quietHours || { enabled: false, start: "22:00", end: "06:00" },
        configs: alertSettings.configs || {},
        updatedAt: Date.now(),
      };
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
      return NextResponse.json({ success: true, alertSettings });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Post telegram settings error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
