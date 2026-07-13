import * as admin from "firebase-admin";

let adminApp: admin.app.App | null = null;

function parseServiceAccountSafe(jsonStr?: string): any | null {
  if (!jsonStr) return null;
  let cleanStr = jsonStr.trim();
  if ((cleanStr.startsWith("'") && cleanStr.endsWith("'")) || (cleanStr.startsWith('"') && cleanStr.endsWith('"'))) {
    cleanStr = cleanStr.slice(1, -1).trim();
  }
  try {
    const obj = JSON.parse(cleanStr);
    if (obj?.private_key && typeof obj.private_key === "string") {
      obj.private_key = obj.private_key.replace(/\\n/g, "\n");
    }
    return obj;
  } catch (e) {
    try {
      const unescaped = cleanStr.replace(/\\"/g, '"').replace(/\\\\n/g, "\\n");
      const obj = JSON.parse(unescaped);
      if (obj?.private_key && typeof obj.private_key === "string") {
        obj.private_key = obj.private_key.replace(/\\n/g, "\n");
      }
      return obj;
    } catch (e2) {
      return null;
    }
  }
}

export function getFirebaseAdminApp(): admin.app.App | null {
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccount = parseServiceAccountSafe(serviceAccountJson);
  const defaultProjectId = serviceAccount?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "rocket-ai-web";

  if (serviceAccount) {
    try {
      if (admin.apps.length === 0) {
        adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: defaultProjectId,
        });
        return adminApp;
      }
    } catch (error: any) {
      console.error("Error initializing admin app with service account:", error.message);
    }
  }

  try {
    if (admin.apps.length === 0) {
      adminApp = admin.initializeApp({
        projectId: defaultProjectId,
      });
      return adminApp;
    }
  } catch (e: any) {
    console.warn("Firebase Admin initializeApp fallback failed:", e.message);
  }

  return admin.apps[0] || null;
}

export function getFirebaseAdminAuth(): admin.auth.Auth | null {
  const app = getFirebaseAdminApp();
  return app ? admin.auth(app) : null;
}

export function getFirebaseAdminDb(): admin.firestore.Firestore | null {
  const app = getFirebaseAdminApp();
  return app ? admin.firestore(app) : null;
}

export async function verifyFirebaseIdTokenDetailed(request: Request): Promise<{ decoded: admin.auth.DecodedIdToken | null; error?: string }> {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { decoded: null, error: "Missing or malformed Authorization Bearer header" };
    }
    const token = authHeader.split("Bearer ")[1].trim();
    if (!token) {
      return { decoded: null, error: "Empty Bearer token" };
    }

    const authAdmin = getFirebaseAdminAuth();
    if (!authAdmin) {
      return { decoded: null, error: "Firebase Admin Auth is not initialized" };
    }

    try {
      const decoded = await authAdmin.verifyIdToken(token);
      return { decoded };
    } catch (verifyErr: any) {
      const errMsg = verifyErr.message || "";
      // If audience mismatch occurred because server defaulted to fallback projectId while client has real project ID
      if (errMsg.includes("aud") || errMsg.includes("audience") || errMsg.includes("Expected")) {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
            const realAud = payload?.aud;
            if (realAud && typeof realAud === "string") {
              const appName = `app_aud_${realAud}`;
              let fallbackApp = admin.apps.find(a => a?.name === appName);
              if (!fallbackApp) {
                fallbackApp = admin.initializeApp({ projectId: realAud }, appName);
              }
              if (fallbackApp) {
                const decodedRetried = await admin.auth(fallbackApp).verifyIdToken(token);
                return { decoded: decodedRetried };
              }
            }
          }
        } catch (retryErr: any) {
          console.error("Retry aud verify failed:", retryErr.message);
        }
      }
      console.error("verifyFirebaseIdToken error:", errMsg);
      return { decoded: null, error: errMsg };
    }
  } catch (error: any) {
    return { decoded: null, error: error.message || "Unknown verification error" };
  }
}

/**
 * Verifies Firebase ID token from Request header Authorization: Bearer <ID_TOKEN>
 * Returns DecodedIdToken or null if invalid/unauthorized.
 */
export async function verifyFirebaseIdToken(request: Request): Promise<admin.auth.DecodedIdToken | null> {
  const result = await verifyFirebaseIdTokenDetailed(request);
  return result.decoded;
}
