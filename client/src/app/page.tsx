'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  ArrowRight, BookOpen, Brain, GitBranch, ShieldCheck, Sparkles, 
  Check, CheckCircle, MessageSquare, Layers, Table, Bookmark, 
  AlertTriangle, FileText, Edit, Shield, Info, ArrowUpRight
} from 'lucide-react';

// Upgraded Interactive 3D Particle Constellation canvas using 3D projection matrix math
function InteractiveConstellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Particle object in 3D
    interface Particle3D {
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      radius: number;
      color: string;
    }

    const particleCount = Math.min(100, Math.floor((width * height) / 15000));
    const particles: Particle3D[] = [];
    const colors = ['#6366f1', '#06b6d4', '#10b981', '#a855f7'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 800,
        y: (Math.random() - 0.5) * 800,
        z: (Math.random() - 0.5) * 800,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        vz: (Math.random() - 0.5) * 0.8,
        radius: Math.random() * 2 + 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;
    let rotationX = 0;
    let rotationY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX - width / 2) / (width / 2);
      mouseY = (e.clientY - height / 2) / (height / 2);
      targetRotationY = mouseX * 0.4;
      targetRotationX = -mouseY * 0.4;
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('resize', handleResize);

    const fov = 400; // Camera field of view (zoom)

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth rotation dampening
      rotationX += (targetRotationX - rotationX) * 0.05;
      rotationY += (targetRotationY - rotationY) * 0.05;

      const cosX = Math.cos(rotationX);
      const sinX = Math.sin(rotationX);
      const cosY = Math.cos(rotationY);
      const sinY = Math.sin(rotationY);

      // Project particles to 2D
      const projected = particles.map((p) => {
        // Apply velocity
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Boundaries check with soft reflection
        if (Math.abs(p.x) > 400) p.vx *= -1;
        if (Math.abs(p.y) > 400) p.vy *= -1;
        if (Math.abs(p.z) > 400) p.vz *= -1;

        // Rotate Y axis
        let x1 = p.x * cosY - p.z * sinY;
        let z1 = p.z * cosY + p.x * sinY;

        // Rotate X axis
        let y2 = p.y * cosX - z1 * sinX;
        let z2 = z1 * cosX + p.y * sinX;

        // Zoom offset
        const zCamera = z2 + 800;

        // 3D projection formula
        const scale = fov / zCamera;
        const projX = x1 * scale + width / 2;
        const projY = y2 * scale + height / 2;

        return { x: projX, y: projY, z: zCamera, rawZ: z2, scale, color: p.color, radius: p.radius };
      });

      // Sort projected particles by Z (depth buffer painting)
      projected.sort((a, b) => b.z - a.z);

      // Draw connection lines
      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];
        for (let j = i + 1; j < projected.length; j++) {
          const p2 = projected[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          
          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.12 * (p1.scale * p2.scale);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw node spheres
      projected.forEach((p) => {
        if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.scale, 0, Math.PI * 2);
        
        // Depth-based color transparency
        const opacity = Math.max(0.1, Math.min(0.8, p.scale));
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.globalAlpha = opacity;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />;
}

export default function Home() {
  const [activeFeatureTab, setActiveFeatureTab] = useState('agent');
  const [hoveredPricing, setHoveredPricing] = useState<string | null>(null);

  const capabilities = [
    {
      id: 'agent',
      title: 'LangGraph Synthesizer',
      icon: Layers,
      description: 'Trigger autonomous multi-agent pipelines linking research retrieval, matrix synthesis, and outline compilers.',
      badge: 'Advanced Workflow',
      features: ['Real-time status updates', 'Step-by-step logs', 'Interactive results map', 'Export to editor canvas']
    },
    {
      id: 'rag',
      title: 'AI RAG Chat',
      icon: MessageSquare,
      description: 'Chat directly with your vector library of parsed PDFs to locate exact references and clarify claims.',
      badge: 'Academic QA',
      features: ['Source-verifiable snippets', 'Vector chunk lookups', 'Dynamic context indexing', 'Session persistence']
    },
    {
      id: 'graph',
      title: '3D Knowledge Graph',
      icon: GitBranch,
      description: 'Interact with visual 3D maps showcasing author linkages, methodology clusters, and topic node relationships.',
      badge: 'Concept Mapping',
      features: ['Force-directed nodes', 'Custom node scaling', 'Topic categorization', 'Click-to-highlight node trails']
    },
    {
      id: 'litreview',
      title: 'Literature Review Matrix',
      icon: Table,
      description: 'Automate grid reviews comparing datasets, research problems, and exact values reported by previous papers.',
      badge: 'Synthesis Matrix',
      features: ['Custom table columns', 'Row editing controls', 'Value confirmation', 'Export synthesis matrix to Word/PDF']
    },
    {
      id: 'citations',
      title: 'Zotero Reference Library',
      icon: Bookmark,
      description: 'Persist academic bibliographies in APA, IEEE, ACM, Springer, MLA, Harvard, or Chicago styles.',
      badge: 'Bibliography Core',
      features: ['Manual DOI additions', 'Direct metadata generation', 'Custom key mappings', 'Live output templates']
    },
    {
      id: 'gaps',
      title: 'Open Research Gaps',
      icon: AlertTriangle,
      description: 'Spot critical methodology limitations, future scope suggestions, and contradictory claims across papers.',
      badge: 'Ideation Board',
      features: ['AI gap categorization', 'Evidence tracing snippets', 'Impact & Feasibility rating', 'Custom gap cards']
    },
    {
      id: 'editor',
      title: 'Notion Canvas',
      icon: Edit,
      description: 'Draft your manuscript using a Notion-like text canvas featuring automatic citation formatting and AI auto-correction.',
      badge: 'Writing Canvas',
      features: ['LaTeX math preview', 'Table auto-builder', 'AI formatting toggles', 'Export to standard PDF formats']
    },
    {
      id: 'plagiarism',
      title: 'Plagiarism & AI Checkers',
      icon: Shield,
      description: 'Verify draft originality with integrated AI detection, perplexity scores, burstiness index, and executive summaries.',
      badge: 'Integrity Check',
      features: ['Detailed probability charts', 'Burstiness evaluations', 'Summary overview box', 'Plagiarism source matches']
    }
  ];

  const pricingPlans = [
    {
      id: 'free',
      name: 'Free Trial',
      price: '$0',
      period: 'forever',
      description: 'Perfect for individual students starting simple academic papers.',
      features: [
        'Upload up to 3 PDF papers',
        '10MB maximum file size limit',
        '3D Knowledge Graph viewer',
        'Basic Notion-like text editor',
        '10 RAG chat questions / month',
        'Standard IEEE/APA templates'
      ],
      cta: 'Get Started',
      popular: false,
      color: 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700/50'
    },
    {
      id: 'pro',
      name: 'Independent Pro',
      price: '$25',
      period: 'per month',
      description: 'Best for active researchers, graduate scholars, and PhD candidates.',
      features: [
        'Unlimited PDF uploads & database space',
        '15 multi-agent LangGraph syntheses / mo',
        'Priority premium model execution (Claude/Gemini)',
        'Unlimited RAG chat Q&A questions',
        '5 Plagiarism & AI detection checks / mo',
        'Custom template exports (ACM, Springer)',
        'Premium support channels'
      ],
      cta: 'Go Pro',
      popular: true,
      color: 'border-indigo-500/40 bg-indigo-950/10 shadow-lg shadow-indigo-500/5 hover:border-indigo-400'
    },
    {
      id: 'team',
      name: 'Lab & Team',
      price: '$89',
      period: 'per month',
      description: 'Engineered for collaborative research groups and small departments.',
      features: [
        'Includes up to 5 user licenses',
        'Shared vector databases & paper libraries',
        '60 multi-agent LangGraph syntheses / mo',
        '30 Plagiarism & AI detection checks / mo',
        'Collaborative 3D graph sharing controls',
        'Shared workspace editor drafting',
        'Advanced team usage metrics'
      ],
      cta: 'Deploy Lab Tier',
      popular: false,
      color: 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700/50'
    },
    {
      id: 'enterprise',
      name: 'Institutional',
      price: 'Custom',
      period: 'tailored annual contract',
      description: 'For university libraries, colleges, and corporate R&D hubs.',
      features: [
        'SSO/Shibboleth campus-wide login integrations',
        'Unlimited multi-agent LangGraph runs',
        'Bring Your Own Key (BYOK) API connections',
        'Unlimited plagiarism & AI contents verification',
        'Dedicated server hosting options',
        'FERPA & GDPR data isolation compliance',
        'SLA guaranteed priority support'
      ],
      cta: 'Contact Sales',
      popular: false,
      color: 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700/50'
    }
  ];

  return (
    <div className="relative min-h-screen bg-[#09090b] text-zinc-100 overflow-hidden flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* 3D Background Constellation */}
      <InteractiveConstellation />

      {/* Background gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-950/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-950/20 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-800/40 backdrop-blur-md bg-zinc-950/30 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 via-cyan-500 to-emerald-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/10">
              R
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
              ResearcherGPT
            </span>
          </div>
          
          <nav className="flex items-center gap-6">
            <Link href="/dashboard" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-100 transition-colors">
              Features
            </Link>
            <a href="#pricing" className="text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-100 transition-colors">
              Pricing
            </a>
            <Link href="/dashboard" className="px-4 h-9 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-xs font-semibold hover:brightness-110 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10">
              Enter Platform <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-grow z-10">
        <div className="max-w-7xl mx-auto px-6 py-24 flex flex-col items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/40 border border-indigo-800/30 text-indigo-400 text-xs font-semibold mb-8 backdrop-blur-sm shadow-inner shadow-indigo-500/5"
          >
            <Sparkles className="w-3.5 h-3.5" /> The Smartest Academic Workspace
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-5xl md:text-8xl font-black tracking-tight mb-8 leading-[1.05]"
          >
            The Ultimate Engine for <br />
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-sm">
              Academic Syntheses
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.0, delay: 0.3 }}
            className="text-base md:text-lg text-zinc-400 mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Empowering scholars, PhD candidates, and research labs. Upload PDFs to auto-build knowledge graphs, literature review matrices, citation structures, gap analysis lists, and verify claim originality with multi-agent LangGraph pipelines.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto"
          >
            <Link href="/dashboard" className="w-full sm:w-auto px-8 h-12 rounded-full bg-zinc-100 text-zinc-950 font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-white/5">
              Launch Workspace <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/dashboard" className="w-full sm:w-auto px-8 h-12 rounded-full border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800/40 transition-colors flex items-center justify-center text-zinc-300 font-semibold">
              Explore Demo Platform
            </Link>
          </motion.div>
        </div>

        {/* Feature Hub Section */}
        <div className="max-w-7xl mx-auto px-6 py-20 border-t border-zinc-900">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Fully Loaded Research Suite</h2>
            <p className="text-sm md:text-base text-zinc-500">Every tool is engineered to follow strict academic formatting, citation traces, and verifiable claims.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Feature Tab Selector */}
            <div className="lg:col-span-4 space-y-2.5">
              {capabilities.map((cap) => {
                const Icon = cap.icon;
                const isActive = activeFeatureTab === cap.id;
                return (
                  <button
                    key={cap.id}
                    onClick={() => setActiveFeatureTab(cap.id)}
                    className={`w-full p-4 rounded-xl border text-left flex items-start gap-4 transition-all ${
                      isActive 
                        ? 'bg-zinc-900 border-indigo-500/40 shadow-lg shadow-indigo-500/5' 
                        : 'border-zinc-800/40 bg-zinc-950/20 hover:border-zinc-800/80'
                    }`}
                  >
                    <div className={`p-2 rounded-lg border ${
                      isActive 
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                        : 'bg-zinc-900 text-zinc-500 border-zinc-850'
                    }`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h4 className={`font-bold text-sm ${isActive ? 'text-zinc-100' : 'text-zinc-400'}`}>{cap.title}</h4>
                      <p className="text-[11px] text-zinc-500 truncate max-w-[220px] mt-0.5">{cap.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Feature Details Viewer */}
            <div className="lg:col-span-8 p-8 rounded-2xl border border-zinc-800 bg-zinc-900/10 backdrop-blur-sm h-full flex flex-col justify-between min-h-[420px]">
              <AnimatePresence mode="wait">
                {capabilities.map((cap) => {
                  if (cap.id !== activeFeatureTab) return null;
                  const Icon = cap.icon;
                  return (
                    <motion.div
                      key={cap.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.4 }}
                      className="space-y-6 flex-grow flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/10">
                            {cap.badge}
                          </span>
                        </div>
                        <h3 className="text-2xl md:text-4xl font-extrabold flex items-center gap-3 text-zinc-100">
                          <Icon className="w-7 h-7 text-indigo-400" /> {cap.title}
                        </h3>
                        <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-2xl">{cap.description}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8">
                        {cap.features.map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 p-3 rounded-lg border border-zinc-900 bg-zinc-950/40">
                            <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="text-xs text-zinc-300 font-semibold">{feat}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end pt-8">
                        <Link 
                          href="/dashboard" 
                          className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 group"
                        >
                          Launch this tool <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                        </Link>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Pricing Plan Tiers */}
        <div id="pricing" className="max-w-7xl mx-auto px-6 py-20 border-t border-zinc-900 scroll-mt-10">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Flexible, Transparent Pricing</h2>
            <p className="text-sm md:text-base text-zinc-500">Pick a plan suited for your research workflow. Academic discounts are applied automatically.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {pricingPlans.map((plan) => (
              <motion.div
                key={plan.id}
                onMouseEnter={() => setHoveredPricing(plan.id)}
                onMouseLeave={() => setHoveredPricing(null)}
                animate={{
                  scale: hoveredPricing === plan.id ? 1.02 : 1.0,
                  y: hoveredPricing === plan.id ? -4 : 0
                }}
                className={`relative flex flex-col justify-between p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 ${plan.color}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md shadow-indigo-500/20">
                    Most Popular
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-zinc-200 text-lg">{plan.name}</h3>
                    <p className="text-[11px] text-zinc-500 mt-1 h-8 leading-snug">{plan.description}</p>
                  </div>

                  <div className="flex items-baseline gap-1.5 py-2 border-y border-zinc-900">
                    <span className="text-4xl font-extrabold tracking-tight text-zinc-100">{plan.price}</span>
                    <span className="text-xs text-zinc-500 font-medium">/ {plan.period}</span>
                  </div>

                  <ul className="space-y-2.5 pt-2">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[11px] text-zinc-400 leading-normal">
                        <CheckCircle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${plan.popular ? 'text-indigo-400' : 'text-zinc-600'}`} />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-zinc-900">
                  <Link
                    href="/dashboard"
                    className={`w-full h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                      plan.popular 
                        ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 hover:brightness-110 text-white' 
                        : 'bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-12 p-4 rounded-xl border border-zinc-900 bg-zinc-950/40 max-w-2xl mx-auto flex gap-3.5 items-start">
            <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-zinc-500 leading-relaxed">
              <strong>Need a student verification discount?</strong> Contact our help desk with your <code>.edu</code> or academic institutional email address to request a 40% reduction on the Independent Pro subscription tier.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-8 text-center text-xs text-zinc-600 z-10 relative">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>&copy; {new Date().getFullYear()} ResearcherGPT Platform. All rights reserved.</span>
          <div className="flex gap-4">
            <span className="hover:text-zinc-400 cursor-pointer">Terms of Service</span>
            <span className="hover:text-zinc-400 cursor-pointer">Privacy Policy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
