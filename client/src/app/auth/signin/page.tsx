'use client';

import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background decoration blur */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-indigo-950/20 rounded-full blur-[90px] pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-white shadow-md">
              R
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              ResearcherGPT
            </span>
          </Link>
          <h2 className="text-xl font-bold mt-4">Welcome back</h2>
          <p className="text-xs text-zinc-500">Sign in to your academic research workspace.</p>
        </div>

        {/* Clerk Sign-in Component */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-2xl backdrop-blur-sm shadow-xl space-y-4">
          <SignIn 
            routing="hash"
            signUpUrl="/auth/signup" 
            forceRedirectUrl="/dashboard"
          />

          {/* Dev Bypass Section */}
          <div className="border-t border-zinc-800/80 pt-4 flex flex-col gap-2">
            <p className="text-[10px] text-center text-zinc-600 font-semibold tracking-wider uppercase">Developer Environment</p>
            <Link 
              href="/dashboard"
              className="w-full h-10 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-xs font-semibold flex items-center justify-center text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Bypass Auth (Local Sandbox)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
