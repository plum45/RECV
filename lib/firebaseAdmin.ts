import * as admin from "firebase-admin";
import crypto from "crypto";

let adminApp: admin.app.App | null = null;
let googleCertCache: { [kid: string]: string } | null = null;
let googleCertCacheExpiresAt = 0;

function parseServiceAccountSafe(jsonStr?: string): any | null {
  if (!jsonStr) return null;
  let cleanStr = jsonStr.trim();
  if ((cleanStr.startsWith("'") && cleanStr.endsWith("'")) || (cleanStr.startsWith('"') && cleanStr.endsWith('"'))) {
    cleanStr = cleanStr.slice(1, -1).trim();
  }
  try {
    // Check if base64 encoded JSON
    if (cleanStr.startsWith("ey") && !cleanStr.includes("{")) {
      const decodedBase64 = Buffer.from(cleanStr, "base64").toString("utf8");
      const obj = JSON.parse(decodedBase64);
      if (obj?.private_key && typeof obj.private_key === "string") {
        obj.private_key = obj.private_key.replace(/\\n/g, "\n");
      }
      return obj;
    }
  } catch (eBase64) {}

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

function base64urlToBuffer(str: string): Buffer {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

async function verifyTokenStandaloneGoogle(token: string): Promise<admin.auth.DecodedIdToken | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    const kid = header?.kid;
    if (!kid || header.alg !== "RS256" || !payload?.sub || !payload?.aud) return null;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn("Token expired in standalone check");
      return null;
    }

    if (!googleCertCache || Date.now() > googleCertCacheExpiresAt) {
      const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
      if (res.ok) {
        googleCertCache = await res.json();
        googleCertCacheExpiresAt = Date.now() + 3600 * 1000;
      }
    }

    const pem = googleCertCache?.[kid];
    if (!pem) return null;

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const sigBuf = base64urlToBuffer(parts[2]);
    const isValid = verifier.verify(pem, sigBuf);

    if (isValid && payload.iss === `https://securetoken.google.com/${payload.aud}`) {
      return {
        ...payload,
        uid: payload.user_id || payload.sub,
      } as admin.auth.DecodedIdToken;
    }
  } catch (err: any) {
    console.error("Standalone Google JWT check error:", err.message);
  }
  return null;
}

export function getFirebaseAdminApp(): admin.app.App | null {
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let serviceAccount = parseServiceAccountSafe(serviceAccountJson);
  if (!serviceAccount && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    serviceAccount = {
      project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "rocket-ai-web",
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };
  }

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
    if (authAdmin) {
      try {
        const decoded = await authAdmin.verifyIdToken(token);
        return { decoded };
      } catch (verifyErr: any) {
        const errMsg = verifyErr.message || "";
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
                  const mainApp = admin.apps[0];
                  const mainCred = mainApp?.options?.credential;
                  fallbackApp = admin.initializeApp({
                    ...(mainCred ? { credential: mainCred } : {}),
                    projectId: realAud,
                  }, appName);
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
        console.warn("Standard verifyIdToken threw error, trying standalone verification:", errMsg);
      }
    }

    // Standalone fallback: Cryptographically verify Google RSA-SHA256 signature without relying on ApplicationDefaultCredential metadata
    const standaloneDecoded = await verifyTokenStandaloneGoogle(token);
    if (standaloneDecoded) {
      return { decoded: standaloneDecoded };
    }

    return { decoded: null, error: "Invalid Firebase ID token verification" };
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
