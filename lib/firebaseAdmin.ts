import * as admin from "firebase-admin";

let adminApp: admin.app.App | null = null;

export function getFirebaseAdminApp(): admin.app.App | null {
  if (admin.apps.length > 0 && admin.apps[0]) {
    return admin.apps[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    try {
      if (admin.apps.length === 0) {
        adminApp = admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "rocket-ai-web",
        });
        return adminApp;
      }
    } catch (e: any) {
      console.warn("Firebase Admin initializeApp failed without service account:", e.message);
      return null;
    }
    return admin.apps[0] || null;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (admin.apps.length === 0) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else {
      adminApp = admin.apps[0];
    }
    return adminApp || null;
  } catch (error: any) {
    console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_JSON or initializing admin app:", error.message);
    try {
      if (admin.apps.length === 0) {
        adminApp = admin.initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "rocket-ai-web",
        });
        return adminApp;
      }
    } catch (e) {
      // ignore
    }
    return admin.apps[0] || null;
  }
}

export function getFirebaseAdminAuth(): admin.auth.Auth | null {
  const app = getFirebaseAdminApp();
  return app ? admin.auth(app) : null;
}

export function getFirebaseAdminDb(): admin.firestore.Firestore | null {
  const app = getFirebaseAdminApp();
  return app ? admin.firestore(app) : null;
}

/**
 * Verifies Firebase ID token from Request header Authorization: Bearer <ID_TOKEN>
 * Returns DecodedIdToken or null if invalid/unauthorized.
 */
export async function verifyFirebaseIdToken(request: Request): Promise<admin.auth.DecodedIdToken | null> {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const token = authHeader.split("Bearer ")[1].trim();
    if (!token) return null;

    const authAdmin = getFirebaseAdminAuth();
    if (!authAdmin) {
      console.error("Firebase Admin Auth is not initialized.");
      return null;
    }

    const decoded = await authAdmin.verifyIdToken(token);
    return decoded;
  } catch (error: any) {
    console.error("verifyFirebaseIdToken error:", error.message);
    return null;
  }
}
