import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = typeof window !== "undefined" && firebaseConfig.apiKey && getApps().length === 0 
  ? initializeApp(firebaseConfig) 
  : getApps().length > 0 ? getApps()[0] : null;

const auth = app ? getAuth(app) : null as any;
const db = app ? getFirestore(app) : null as any;

export function getAuthErrorMessage(error: any): string {
  const code = error?.code || "";
  switch (code) {
    case "auth/invalid-credential":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    case "auth/user-not-found":
      return "ไม่พบผู้ใช้นี้ในระบบ";
    case "auth/wrong-password":
      return "รหัสผ่านไม่ถูกต้อง";
    case "auth/email-already-in-use":
      return "อีเมลนี้ถูกใช้งานในระบบแล้ว";
    case "auth/invalid-email":
      return "รูปแบบอีเมลไม่ถูกต้อง";
    case "auth/weak-password":
      return "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร";
    case "auth/too-many-requests":
      return "เข้าสู่ระบบล้มเหลวหลายครั้ง บัญชีนี้ถูกระงับชั่วคราว กรุณาลองใหม่ภายหลัง";
    case "auth/user-disabled":
      return "บัญชีผู้ใช้นี้ถูกระงับการใช้งาน";
    case "auth/operation-not-allowed":
      return "ระบบยังไม่เปิดใช้งานการเข้าสู่ระบบด้วยวิธีนี้";
    case "auth/popup-blocked":
      return "ป๊อปอัปถูกบล็อกโดยเบราว์เซอร์ของคุณ";
    case "auth/popup-closed-by-user":
      return "หน้าต่างเข้าสู่ระบบถูกปิดก่อนทำรายการเสร็จ";
    default:
      if (error?.message) {
        // Remove Firebase prefix if present
        return error.message.replace(/^Firebase:\s*/i, "");
      }
      return "เกิดข้อผิดพลาดในการดำเนินการ กรุณาลองใหม่อีกครั้ง";
  }
}

export { app, auth, db };
