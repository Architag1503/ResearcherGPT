'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UserProfile } from '@clerk/nextjs';
import { ArrowLeft, User, Mail, Award, Check } from 'lucide-react';

export default function ProfilePage() {
  const [role, setRole] = useState<'student' | 'researcher' | 'professor' | 'admin'>('researcher');
  const [success, setSuccess] = useState(false);

  const handleRoleChange = (selectedRole: typeof role) => {
    setRole(selectedRole);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header navigation */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">User Profile</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Academic Role Selector */}
          <div className="md:col-span-1 border border-zinc-800 bg-zinc-950/40 p-6 rounded-2xl space-y-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 border border-zinc-700">
                <User className="w-10 h-10" />
              </div>
              <h3 className="font-bold text-base text-zinc-200">Dr. Sarah Jenkins</h3>
              <p className="text-xs text-zinc-500">sarah.jenkins@university.edu</p>
            </div>

            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Select Academic Role</span>
              <div className="grid grid-cols-1 gap-2">
                {(['student', 'researcher', 'professor', 'admin'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => handleRoleChange(r)}
                    className={`h-10 px-3.5 rounded-lg text-xs font-semibold flex items-center justify-between border capitalize transition-all ${role === r ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' : 'bg-zinc-900/10 border-zinc-850 text-zinc-400 hover:text-zinc-200'}`}
                  >
                    <span className="flex items-center gap-2">
                      <Award className="w-4 h-4" /> {r}
                    </span>
                    {role === r && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
              {success && (
                <p className="text-[10px] text-center text-emerald-400 animate-pulse font-medium">Academic Role Updated Successfully!</p>
              )}
            </div>
          </div>

          {/* Clerk Profile Integration */}
          <div className="md:col-span-2 border border-zinc-800 bg-zinc-950/20 p-6 rounded-2xl overflow-hidden">
            <h3 className="font-bold text-base mb-4 text-zinc-200">Account Credentials</h3>
            <UserProfile routing="hash" />
          </div>
        </div>

      </div>
    </div>
  );
}
