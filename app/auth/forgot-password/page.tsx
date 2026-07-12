"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth, getAuthErrorMessage } from "../../../lib/firebase";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      if (!auth) {
        throw new Error("ยังไม่ได้ตั้งค่า Firebase ในไฟล์ .env.local");
      }
      await sendPasswordResetEmail(auth, email);
      setMessage("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว โปรดตรวจสอบกล่องข้อความ");
    } catch (err: any) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4">
      <div className="panel-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-white text-center mb-2">ลืมรหัสผ่าน?</h1>
        <p className="text-gray-400 text-center text-sm mb-6">
          ใส่อีเมลของคุณเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
        </p>
        
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>}
        {message && <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-lg mb-4 text-sm">{message}</div>}

        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">อีเมล</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#7c3aed]/50 focus:ring-1 focus:ring-[#7c3aed]/50 transition-all"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-analyze py-2.5 mt-2 rounded-lg text-white font-medium disabled:opacity-50"
          >
            {loading ? "กำลังส่ง..." : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          <Link href="/auth/login" className="text-[#a78bfa] hover:text-[#c4b5fd]">กลับไปหน้าเข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  );
}
