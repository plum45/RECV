import * as admin from "firebase-admin";
import crypto from "crypto";

let adminApp: admin.app.App | null = null;
let googleCertCache: { [kid: string]: string } | null = null;
let googleCertCacheExpiresAt = 0;

function parseServiceAccountSafe(jsonStr?: string): any | null {
  if (!jsonStr || typeof jsonStr !== "string") return null;
  let cleanStr = jsonStr.trim();
  if ((cleanStr.startsWith("'") && cleanStr.endsWith("'")) || (cleanStr.startsWith('"') && cleanStr.endsWith('"'))) {
    cleanStr = cleanStr.slice(1, -1).trim();
  }
  try {
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
  if (!str || typeof str !== "string") return Buffer.from([]);
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

async function verifyTokenStandaloneGoogle(token: string): Promise<{ decoded: admin.auth.DecodedIdToken | null; error?: string }> {
  try {
    if (!token || typeof token !== "string" || token.length === 0) {
      return { decoded: null, error: "ผู้ใช้ยังไม่ได้ล็อกอิน (Invalid or empty token string)" };
    }
    const parts = token.split(".");
    if (!parts || !Array.isArray(parts) || parts.length !== 3) {
      return { decoded: null, error: "ผู้ใช้ยังไม่ได้ล็อกอิน (Malformed JWT token structure)" };
    }

    const header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    const kid = header?.kid;
    if (!kid || header.alg !== "RS256" || !payload?.sub || !payload?.aud) {
      return { decoded: null, error: "ผู้ใช้ยังไม่ได้ล็อกอิน (Missing RS256 algorithm or key id)" };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { decoded: null, error: "token หมดอายุ กรุณาเข้าสู่ระบบใหม่ (ID token has expired)" };
    }

    if (!googleCertCache || Date.now() > googleCertCacheExpiresAt) {
      const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
      if (res.ok) {
        googleCertCache = await res.json();
        googleCertCacheExpiresAt = Date.now() + 3600 * 1000;
      }
    }

    const pem = googleCertCache?.[kid];
    if (!pem) {
      return { decoded: null, error: "Firebase config ผิด (Cannot match Google public certificate for kid)" };
    }

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const sigBuf = base64urlToBuffer(parts[2]);
    const isValid = verifier.verify(pem, sigBuf);

    if (isValid && payload.iss === `https://securetoken.google.com/${payload.aud}`) {
      return {
        decoded: {
          ...payload,
          uid: payload.user_id || payload.sub,
        } as admin.auth.DecodedIdToken
      };
    }
    return { decoded: null, error: "Firebase config ผิด หรือลายเซ็น Token ไม่ถูกต้อง (Invalid cryptographic signature)" };
  } catch (err: any) {
    return { decoded: null, error: `Firebase config ผิด (Token parse error: ${err.message || "Unknown"})` };
  }
}

export function getFirebaseAdminApp(): admin.app.App | null {
  if (admin.apps && Array.isArray(admin.apps) && admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let serviceAccount = parseServiceAccountSafe(serviceAccountJson);
  if (!serviceAccount && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    serviceAccount = {
      project_id: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "rocket-ai-web",
      private_key: typeof rawKey === "string" ? rawKey.replace(/\\n/g, "\n") : rawKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };
  }

  const defaultProjectId = serviceAccount?.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "rocket-ai-web";

  if (serviceAccount) {
    try {
      if (!admin.apps || !Array.isArray(admin.apps) || admin.apps.length === 0) {
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
    if (!admin.apps || !Array.isArray(admin.apps) || admin.apps.length === 0) {
      adminApp = admin.initializeApp({
        projectId: defaultProjectId,
      });
      return adminApp;
    }
  } catch (e: any) {
    console.warn("Firebase Admin initializeApp fallback failed:", e.message);
  }

  return (admin.apps && Array.isArray(admin.apps) && admin.apps.length > 0) ? admin.apps[0] : null;
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
    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      return { decoded: null, error: "ผู้ใช้ยังไม่ได้ล็อกอิน (Missing or malformed Authorization Bearer header)" };
    }
    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token || typeof token !== "string" || token.length === 0 || token === "undefined" || token === "null") {
      return { decoded: null, error: "ผู้ใช้ยังไม่ได้ล็อกอิน (Empty or invalid Bearer token string)" };
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const serviceAccount = parseServiceAccountSafe(serviceAccountJson);
    const expectedProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

    // Check project_id match
    if (serviceAccount && expectedProjectId && serviceAccount.project_id && serviceAccount.project_id !== expectedProjectId) {
      console.warn(`Project ID mismatch: Service Account (${serviceAccount.project_id}) vs Frontend (${expectedProjectId})`);
    }

    const authAdmin = getFirebaseAdminAuth();
    if (!authAdmin && !serviceAccount) {
      console.warn("Service Account missing or not initialized properly");
    }

    if (authAdmin && token && typeof token === "string" && token.length > 0) {
      try {
        const decoded = await authAdmin.verifyIdToken(token);
        // Verify project match if check is needed
        if (expectedProjectId && decoded.aud && decoded.aud !== expectedProjectId) {
          return { decoded: null, error: `Firebase config ผิด: project_id ใน Token (${decoded.aud}) ไม่ตรงกับ frontend project (${expectedProjectId})` };
        }
        return { decoded };
      } catch (verifyErr: any) {
        const errMsg = verifyErr?.message || "";
        if (typeof errMsg === "string" && (errMsg.includes("expired") || errMsg.includes("TOKEN_EXPIRED") || verifyErr?.code === "auth/id-token-expired")) {
          return { decoded: null, error: "token หมดอายุ กรุณาเข้าสู่ระบบใหม่" };
        }
        if (typeof errMsg === "string" && (errMsg.includes("aud") || errMsg.includes("audience") || errMsg.includes("Expected"))) {
          try {
            const parts = token.split(".");
            if (parts && Array.isArray(parts) && parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
              const realAud = payload?.aud;
              if (realAud && typeof realAud === "string") {
                if (expectedProjectId && realAud !== expectedProjectId) {
                  return { decoded: null, error: `Firebase config ผิด: project_id ของผู้ใช้ (${realAud}) ไม่ตรงกับ ${expectedProjectId}` };
                }
                const appName = `app_aud_${realAud}`;
                let fallbackApp = (admin.apps && Array.isArray(admin.apps)) ? admin.apps.find(a => a?.name === appName) : undefined;
                if (!fallbackApp) {
                  const mainApp = (admin.apps && Array.isArray(admin.apps) && admin.apps.length > 0) ? admin.apps[0] : null;
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
            console.error("Retry aud verify failed:", retryErr?.message);
          }
        }
        console.warn("Standard verifyIdToken threw error, trying standalone verification:", errMsg);
      }
    }

    // Standalone fallback: Cryptographically verify Google RSA-SHA256 signature without relying on ApplicationDefaultCredential metadata
    const standaloneResult = await verifyTokenStandaloneGoogle(token);
    if (standaloneResult.decoded) {
      if (expectedProjectId && standaloneResult.decoded.aud && standaloneResult.decoded.aud !== expectedProjectId) {
        return { decoded: null, error: `Firebase config ผิด: project_id ใน Token (${standaloneResult.decoded.aud}) ไม่ตรงกับ frontend project (${expectedProjectId})` };
      }
      return { decoded: standaloneResult.decoded };
    }

    if (!serviceAccountJson && !process.env.FIREBASE_PRIVATE_KEY) {
      return { decoded: null, error: `Service Account หาย: กรุณาตั้งค่า FIREBASE_SERVICE_ACCOUNT_JSON บน Render (${standaloneResult.error || "Token verification failed"})` };
    }

    return { decoded: null, error: standaloneResult.error || "Firebase config ผิด หรือไม่สามารถตรวจสอบ ID token ได้" };
  } catch (error: any) {
    const errorMsg = error?.message || "Unknown verification error";
    if (typeof errorMsg === "string" && errorMsg.includes("expired")) {
      return { decoded: null, error: "token หมดอายุ กรุณาเข้าสู่ระบบใหม่" };
    }
    return { decoded: null, error: `Firebase config ผิด หรือเกิดข้อผิดพลาด: ${errorMsg}` };
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
