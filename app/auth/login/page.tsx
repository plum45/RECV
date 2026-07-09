"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4">
      <div className="panel-card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-white text-center mb-6">เข้าสู่ระบบ</h1>
        
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
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
          
          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-sm text-gray-400">รหัสผ่าน</label>
              <Link href="/auth/forgot-password" className="text-sm text-[#a78bfa] hover:text-[#c4b5fd]">
                ลืมรหัสผ่าน?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#09090b] border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#7c3aed]/50 focus:ring-1 focus:ring-[#7c3aed]/50 transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-analyze py-2.5 mt-2 rounded-lg text-white font-medium disabled:opacity-50"
          >
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          ยังไม่มีบัญชี? <Link href="/auth/register" className="text-[#a78bfa] hover:text-[#c4b5fd]">สมัครสมาชิก</Link>
        </p>
      </div>
    </div>
  );
}
