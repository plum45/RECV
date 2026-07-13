import { getApps, getApp, initializeApp, cert, App } from "firebase-admin/app";
import { getAuth, DecodedIdToken } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import crypto from "crypto";

// ── Singleton ────────────────────────────────────────────────────────
let _app: App | null = null;
let googleCertCache: Record<string, string> | null = null;
let googleCertCacheExpiresAt = 0;

// ── Service Account Parser ───────────────────────────────────────────
function parseServiceAccountSafe(jsonStr?: string): Record<string, any> | null {
  if (!jsonStr || typeof jsonStr !== "string") return null;
  let cleanStr = jsonStr.trim();

  // Strip surrounding quotes if present
  if (
    (cleanStr.startsWith("'") && cleanStr.endsWith("'")) ||
    (cleanStr.startsWith('"') && cleanStr.endsWith('"'))
  ) {
    cleanStr = cleanStr.slice(1, -1).trim();
  }

  // Try base64-encoded JSON
  try {
    if (cleanStr.startsWith("ey") && !cleanStr.includes("{")) {
      const decoded = Buffer.from(cleanStr, "base64").toString("utf8");
      const obj = JSON.parse(decoded);
      if (obj?.private_key && typeof obj.private_key === "string") {
        obj.private_key = obj.private_key.replace(/\\n/g, "\n");
      }
      return obj;
    }
  } catch (_) {}

  // Try direct JSON parse
  try {
    const obj = JSON.parse(cleanStr);
    if (obj?.private_key && typeof obj.private_key === "string") {
      obj.private_key = obj.private_key.replace(/\\n/g, "\n");
    }
    return obj;
  } catch (_) {}

  // Try un-escaping before parsing
  try {
    const unescaped = cleanStr.replace(/\\"/g, '"').replace(/\\\\n/g, "\\n");
    const obj = JSON.parse(unescaped);
    if (obj?.private_key && typeof obj.private_key === "string") {
      obj.private_key = obj.private_key.replace(/\\n/g, "\n");
    }
    return obj;
  } catch (_) {}

  return null;
}

// ── Validate Service Account fields ──────────────────────────────────
function validateServiceAccount(
  sa: Record<string, any>,
  expectedProjectId?: string
): { valid: boolean; error?: string } {
  if (!sa.project_id || typeof sa.project_id !== "string") {
    return { valid: false, error: "Service Account ไม่มี project_id" };
  }
  if (!sa.client_email || typeof sa.client_email !== "string") {
    return { valid: false, error: "Service Account ไม่มี client_email" };
  }
  if (!sa.private_key || typeof sa.private_key !== "string") {
    return { valid: false, error: "Service Account ไม่มี private_key" };
  }
  if (expectedProjectId && sa.project_id !== expectedProjectId) {
    return {
      valid: false,
      error: `project_id ไม่ตรง: Service Account = "${sa.project_id}" แต่ NEXT_PUBLIC_FIREBASE_PROJECT_ID = "${expectedProjectId}"`,
    };
  }
  return { valid: true };
}

// ── Firebase Admin Initialization (singleton) ────────────────────────
export function getFirebaseAdminApp(): App | null {
  // Return existing singleton
  if (_app) return _app;

  // Check if already initialized by another module
  const existingApps = getApps();
  if (existingApps.length > 0) {
    _app = existingApps[0];
    return _app;
  }

  const expectedProjectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID;

  // 1. Try FIREBASE_SERVICE_ACCOUNT_JSON
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let serviceAccount = parseServiceAccountSafe(saJson);

  // 2. Fallback: individual env vars
  if (!serviceAccount && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    serviceAccount = {
      type: "service_account",
      project_id: expectedProjectId || "rocket-ai-web",
      private_key: typeof rawKey === "string" ? rawKey.replace(/\\n/g, "\n") : rawKey,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };
  }

  if (!serviceAccount) {
    console.error(
      "[FirebaseAdmin] ❌ ไม่พบ Service Account — กรุณาตั้งค่า FIREBASE_SERVICE_ACCOUNT_JSON บน Render"
    );
    return null;
  }

  // Validate
  const validation = validateServiceAccount(serviceAccount, expectedProjectId);
  if (!validation.valid) {
    console.error(`[FirebaseAdmin] ❌ ${validation.error}`);
    return null;
  }

  try {
    _app = initializeApp({
      credential: cert(serviceAccount as any),
      projectId: serviceAccount.project_id,
    });
    console.log(`[FirebaseAdmin] ✅ Initialized for project: ${serviceAccount.project_id}`);
    return _app;
  } catch (error: any) {
    console.error("[FirebaseAdmin] ❌ initializeApp failed:", error.message);
    return null;
  }
}

// ── Convenience getters (modular API) ────────────────────────────────
export function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  try {
    return getAuth(app);
  } catch (err: any) {
    console.error("[FirebaseAdmin] getAuth() failed:", err.message);
    return null;
  }
}

export function getFirebaseAdminDb(): Firestore | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  try {
    return getFirestore(app);
  } catch (err: any) {
    console.error("[FirebaseAdmin] getFirestore() failed:", err.message);
    return null;
  }
}

// ── Standalone Google Token Verifier (cryptographic, no SDK needed) ──
function base64urlToBuffer(str: string): Buffer {
  if (!str || typeof str !== "string") return Buffer.from([]);
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4 !== 0) b64 += "=";
  return Buffer.from(b64, "base64");
}

async function verifyTokenStandaloneGoogle(
  token: string
): Promise<{ decoded: DecodedIdToken | null; error?: string }> {
  try {
    if (!token || typeof token !== "string" || token.length === 0) {
      return { decoded: null, error: "Token ว่างหรือไม่ถูกต้อง" };
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
      return { decoded: null, error: "โครงสร้าง JWT token ไม่ถูกต้อง" };
    }

    const header = JSON.parse(Buffer.from(parts[0], "base64").toString("utf8"));
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
    const kid = header?.kid;

    if (!kid || header.alg !== "RS256" || !payload?.sub || !payload?.aud) {
      return { decoded: null, error: "JWT header/payload ไม่ครบถ้วน (ต้อง RS256)" };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { decoded: null, error: "Token หมดอายุ กรุณาเข้าสู่ระบบใหม่" };
    }

    // Fetch Google public certs (cached 1 hr)
    if (!googleCertCache || Date.now() > googleCertCacheExpiresAt) {
      const res = await fetch(
        "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
      );
      if (res.ok) {
        googleCertCache = await res.json();
        googleCertCacheExpiresAt = Date.now() + 3600_000;
      }
    }

    const pem = googleCertCache?.[kid];
    if (!pem) {
      return { decoded: null, error: "ไม่พบ Google public certificate สำหรับ kid นี้" };
    }

    const verifier = crypto.createVerify("RSA-SHA256");
    verifier.update(`${parts[0]}.${parts[1]}`);
    const isValid = verifier.verify(pem, base64urlToBuffer(parts[2]));

    if (isValid && payload.iss === `https://securetoken.google.com/${payload.aud}`) {
      return {
        decoded: {
          ...payload,
          uid: payload.user_id || payload.sub,
        } as DecodedIdToken,
      };
    }
    return { decoded: null, error: "ลายเซ็น Token ไม่ถูกต้อง" };
  } catch (err: any) {
    return { decoded: null, error: `Token parse error: ${err.message || "Unknown"}` };
  }
}

// ── Main Token Verifier ──────────────────────────────────────────────
export async function verifyFirebaseIdTokenDetailed(
  request: Request
): Promise<{ decoded: DecodedIdToken | null; error?: string }> {
  try {
    // 1. Extract Bearer token
    const authHeader =
      request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader || typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
      return { decoded: null, error: "กรุณาเข้าสู่ระบบก่อน (Missing Authorization header)" };
    }
    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token || typeof token !== "string" || token.length === 0 || token === "undefined" || token === "null") {
      return { decoded: null, error: "กรุณาเข้าสู่ระบบก่อน (Empty Bearer token)" };
    }

    const expectedProjectId =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

    // 2. Try SDK verification (modular API)
    const authAdmin = getFirebaseAdminAuth();
    if (authAdmin) {
      try {
        const decoded = await authAdmin.verifyIdToken(token);
        // Optional: project_id match check
        if (expectedProjectId && decoded.aud && decoded.aud !== expectedProjectId) {
          return {
            decoded: null,
            error: `Firebase config ผิด: project_id ใน Token (${decoded.aud}) ไม่ตรงกับ ${expectedProjectId}`,
          };
        }
        return { decoded };
      } catch (verifyErr: any) {
        const errMsg = verifyErr?.message || "";
        const errCode = verifyErr?.code || "";

        // Token expired
        if (
          errCode === "auth/id-token-expired" ||
          errMsg.includes("expired") ||
          errMsg.includes("TOKEN_EXPIRED")
        ) {
          return { decoded: null, error: "Token หมดอายุ กรุณาเข้าสู่ระบบใหม่" };
        }

        console.warn("[FirebaseAdmin] verifyIdToken SDK error, falling through to standalone:", errMsg);
      }
    } else {
      console.warn("[FirebaseAdmin] Auth instance not available — Service Account อาจตั้งค่าไม่ถูกต้อง");
    }

    // 3. Standalone fallback (cryptographic RSA-SHA256 verification)
    const standaloneResult = await verifyTokenStandaloneGoogle(token);
    if (standaloneResult.decoded) {
      if (
        expectedProjectId &&
        standaloneResult.decoded.aud &&
        standaloneResult.decoded.aud !== expectedProjectId
      ) {
        return {
          decoded: null,
          error: `Firebase config ผิด: project_id ใน Token (${standaloneResult.decoded.aud}) ไม่ตรงกับ ${expectedProjectId}`,
        };
      }
      return { decoded: standaloneResult.decoded };
    }

    // 4. Determine most helpful error
    if (
      !process.env.FIREBASE_SERVICE_ACCOUNT_JSON &&
      !process.env.FIREBASE_PRIVATE_KEY
    ) {
      return {
        decoded: null,
        error: `Service Account ไม่ได้ตั้งค่า: กรุณาเพิ่ม FIREBASE_SERVICE_ACCOUNT_JSON บน Render`,
      };
    }

    return {
      decoded: null,
      error: standaloneResult.error || "ไม่สามารถตรวจสอบ Token ได้",
    };
  } catch (error: any) {
    const msg = error?.message || "Unknown verification error";
    if (typeof msg === "string" && msg.includes("expired")) {
      return { decoded: null, error: "Token หมดอายุ กรุณาเข้าสู่ระบบใหม่" };
    }
    return { decoded: null, error: `Firebase Admin error: ${msg}` };
  }
}

/**
 * Convenience wrapper — returns decoded token or null.
 */
export async function verifyFirebaseIdToken(request: Request): Promise<DecodedIdToken | null> {
  const result = await verifyFirebaseIdTokenDetailed(request);
  return result.decoded;
}
