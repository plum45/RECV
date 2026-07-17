"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, TrendingUp, Activity, Menu, X, ArrowRightCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Fade-up animation variant
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] as any },
  }),
};

// SVG Logo Component
const Logo = () => (
  <svg width="32" height="32" viewBox="0 0 256 256" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M 64 128 L 64.5 128 L 32 95 L 0 64 L 0 0 L 64 0 L 128 64 L 128 64.5 L 161 32 L 192 0 L 256 0 L 256 64 L 192 128 L 128 128 L 128 192 L 96 223 L 63.5 256 L 0 256 L 0 192 Z M 256 192 L 224 223 L 191.5 256 L 128 256 L 128 192 L 192 128 L 256 128 Z" />
  </svg>
);

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="relative min-h-screen bg-slate-950 overflow-hidden font-body">
      {/* Background Video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 z-0 w-full h-full object-cover opacity-60 mix-blend-screen"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260606_131516_eca35265-ea66-4fbd-8d52-22aae6e1a503.mp4"
      />

      {/* Navbar */}
      <nav className="relative z-10 max-w-[1280px] mx-auto px-5 sm:px-8 py-4 sm:py-5 flex justify-between items-center">
        {/* Left: Logo */}
        <div className="flex items-center gap-3 text-white">
          <Logo />
          <span className="font-heading text-xl font-bold tracking-tight">iVES</span>
        </div>

        {/* Center: Desktop Nav */}
        <div className="hidden md:flex gap-8">
          <Link href="/public" className="text-sm font-medium text-white/90 hover:opacity-70 transition-opacity">Public Market</Link>
          {["Features", "Pro Plans", "News", "Help"].map((item) => (
            <a key={item} href="#" className="text-sm font-medium text-white/90 hover:opacity-70 transition-opacity">
              {item}
            </a>
          ))}
        </div>

        {/* Right: Desktop Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-semibold px-5 py-2.5 rounded-full text-slate-900 bg-[var(--color-login-bg)] hover:bg-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="text-sm font-semibold px-5 py-2.5 rounded-full text-white bg-[var(--color-accent)] hover:shadow-lg hover:shadow-[var(--color-accent)]/30 active:scale-95 transition-all"
          >
            Start For Free
          </Link>
        </div>

        {/* Mobile Hamburger */}
        <button className="md:hidden text-white" onClick={() => setIsMenuOpen(true)}>
          <Menu size={28} />
        </button>
      </nav>

      {/* Mobile Menu Slide-in */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-[#192837]/35 backdrop-blur-[4px]"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%", transition: { duration: 0.35, ease: [0.55, 0, 1, 0.45] as any } }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as any }}
              className="fixed top-0 right-0 z-50 w-[min(88vw,360px)] h-[100dvh] bg-[#CFC8C5] shadow-[-12px_0_48px_rgba(25,40,55,0.18)] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3 text-[var(--color-text)]">
                  <Logo />
                  <span className="font-heading text-xl font-bold">iVES</span>
                </div>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsMenuOpen(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-[#192837]/10 text-[#192837]"
                >
                  <X size={20} />
                </motion.button>
              </div>

              <div className="h-[1px] bg-[#192837]/10 mx-6 mb-4" />

              {/* Nav Links */}
              <div className="flex flex-col px-4 gap-1">
                {["Features", "Pro Plans", "News", "Help"].map((item, i) => (
                  <motion.a
                    key={item}
                    custom={i}
                    variants={{
                      hidden: { x: 24, opacity: 0 },
                      visible: (i: number) => ({
                        x: 0, opacity: 1, transition: { delay: 0.18 + i * 0.07, duration: 0.4 },
                      }),
                    }}
                    initial="hidden"
                    animate="visible"
                    href="#"
                    className="text-[1.1rem] font-medium text-[#192837] p-4 rounded-xl hover:bg-black/10 transition-colors"
                  >
                    {item}
                  </motion.a>
                ))}
              </div>

              <div className="mt-auto p-6 space-y-3">
                <Link
                  href="/auth/register"
                  className="flex justify-center w-full bg-[var(--color-accent)] text-white py-3.5 rounded-full text-[0.95rem] font-semibold"
                >
                  Start For Free
                </Link>
                <Link
                  href="/auth/login"
                  className="flex justify-center w-full bg-[var(--color-login-bg)] text-[#192837] py-3.5 rounded-full text-[0.95rem] font-semibold border border-black/5"
                >
                  Sign In
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hero Content */}
      <div className="relative z-10 max-w-[1280px] mx-auto px-5 pt-[clamp(40px,8vw,72px)] pb-12">
        <div className="max-w-[700px] mx-auto flex flex-col items-center">
          <motion.h1
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="font-heading text-[clamp(1.8rem,5vw,3.5rem)] leading-[1.05] tracking-[-0.01em] text-white text-center drop-shadow-md"
          >
            AI <Zap size={36} className="inline-block relative -top-1 mx-1 text-amber-400 drop-shadow" /> Powered <TrendingUp size={36} className="inline-block relative -top-1 mx-1 text-emerald-400 drop-shadow" /> Stock Analysis <br />
            with Ironclad Precision <Activity size={32} className="inline-block relative -top-1 ml-1.5 text-indigo-400 drop-shadow" />
          </motion.h1>

          <motion.p
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="mt-6 text-[clamp(0.95rem,2.5vw,1.15rem)] text-white/90 max-w-[580px] leading-[1.65] text-center drop-shadow-sm font-medium"
          >
            Maximize your profits and minimize risks. Real-time market data, AI-driven insights, and pro-grade technical analysis tools for your non-stop trading.
          </motion.p>

          <motion.div custom={2} variants={fadeUp} initial="hidden" animate="visible" className="mt-10">
            <button
              onClick={() => router.push("/auth/register")}
              className="flex items-center justify-between gap-8 bg-[var(--color-accent)] text-white text-[clamp(0.9rem,2vw,1.1rem)] font-semibold px-6 py-4 rounded-[50px] min-w-[210px] shadow-[0_4px_24px_rgba(115,66,226,0.4)] hover:scale-[1.04] hover:brightness-110 active:scale-95 transition-all duration-300"
            >
              <span>Get It Free</span>
              <ArrowRightCircle size={22} />
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
