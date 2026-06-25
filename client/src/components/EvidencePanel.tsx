'use client';

import { useState } from 'react';
import { ShieldCheck, ShieldAlert, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

interface FactCheckSource {
  paperTitle: string;
  pageNumber?: number;
  snippet: string;
  confidenceScore: number;
}

interface Claim {
  claim: string;
  status: 'verified' | 'refuted' | 'unverified';
  confidenceScore: number;
  analysis: string;
  sources: FactCheckSource[];
}

interface EvidencePanelProps {
  claims: Claim[];
}

export default function EvidencePanel({ claims }: EvidencePanelProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
            <ShieldCheck className="w-3.5 h-3.5" /> Verified
          </span>
        );
      case 'refuted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/10">
            <ShieldAlert className="w-3.5 h-3.5" /> Refuted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/10">
            Unverified
          </span>
        );
    }
  };

  if (claims.length === 0) {
    return (
      <div className="p-8 text-center border border-zinc-800 rounded-xl bg-zinc-950/40 text-zinc-500">
        No claims checked yet. Trigger an Agent Run to verify draft claims against paper sources.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {claims.map((c, idx) => (
        <div
          key={idx}
          className="border border-zinc-800 rounded-xl bg-zinc-950/30 overflow-hidden hover:border-zinc-700/50 transition-all"
        >
          {/* Header Bar */}
          <div
            onClick={() => toggleExpand(idx)}
            className="p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-900/10"
          >
            <div className="flex-grow min-w-0 space-y-1">
              <p className="font-semibold text-sm text-zinc-200 truncate">{c.claim}</p>
              <div className="flex items-center gap-3">
                {getStatusBadge(c.status)}
                <span className="text-xs text-zinc-500">
                  Confidence Score: <span className="font-semibold text-zinc-300">{Math.round(c.confidenceScore * 100)}%</span>
                </span>
              </div>
            </div>
            {expandedIndex === idx ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </div>

          {/* Expanded Analysis */}
          {expandedIndex === idx && (
            <div className="p-4 border-t border-zinc-850 bg-zinc-950/60 space-y-4">
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Analysis</h4>
                <p className="text-sm text-zinc-300 leading-relaxed">{c.analysis}</p>
              </div>

              {c.sources && c.sources.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Source References</h4>
                  <div className="space-y-2.5">
                    {c.sources.map((src, sIdx) => (
                      <div key={sIdx} className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-900/30 space-y-2">
                        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5">
                          <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5" /> {src.paperTitle}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            Page {src.pageNumber || 'N/A'} • Match {Math.round(src.confidenceScore * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 italic leading-relaxed">
                          &ldquo;{src.snippet}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
