import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { chromium } from 'playwright-core';
import Project from '../models/Project.js';
import Paper from '../models/Paper.js';
import Gap from '../models/Gap.js';
import FactCheck from '../models/FactCheck.js';
import GeneratedPaper from '../models/GeneratedPaper.js';
import KnowledgeGraph from '../models/Graph.js';
import Citation from '../models/Citation.js';
import AgentRun from '../models/AgentRun.js';
import Note from '../models/Note.js';
import LearningNode from '../models/LearningNode.js';
import PlagiarismReport from '../models/PlagiarismReport.js';
import { Queue } from 'bullmq';
import { bullConfig } from '../config/redis.js';
import axios from 'axios';
import { FormaTeXService } from '../services/formatex.service.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

let graphQueue: Queue | null = null;
if (process.env.DISABLE_QUEUE !== 'true') {
  try {
    graphQueue = new Queue('knowledge-graph-generation', bullConfig);
    graphQueue.on('error', (err) => {
      console.warn('[project.controller] Queue error:', err.message);
    });
  } catch (err: any) {
    console.warn('[project.controller] BullMQ Queue init failed:', err.message);
  }
}

export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    // In production, req.user will be populated by auth middleware
    const userId = (req as any).user?.id || 'mock_user_id';

    let finalDescription = description;
    if (!finalDescription || !finalDescription.trim()) {
      try {
        const aiRes = await axios.post(`${AI_SERVICE_URL}/api/project/generate-description`, { name });
        if (aiRes.data && aiRes.data.success) {
          finalDescription = aiRes.data.description;
        }
      } catch (err) {
        console.warn('Failed to automatically generate description via AI:', err);
        finalDescription = `Research workspace focusing on ${name}.`;
      }
    }

    const project = new Project({
      name,
      description: finalDescription,
      userId,
    });

    await project.save();
    return res.status(201).json(project);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getProjects = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'mock_user_id';
    const projects = await Project.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json(projects);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    return res.status(200).json(project);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findByIdAndDelete(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    // Delete all papers, citations, gaps, agent runs, manuscripts, and other entities associated with the project
    await Promise.all([
      Paper.deleteMany({ projectId }),
      Citation.deleteMany({ projectId }),
      Gap.deleteMany({ projectId }),
      AgentRun.deleteMany({ projectId }),
      GeneratedPaper.deleteMany({ projectId }),
      FactCheck.deleteMany({ projectId }),
      KnowledgeGraph.deleteMany({ projectId }),
      Note.deleteMany({ projectId }),
      LearningNode.deleteMany({ projectId }),
      PlagiarismReport.deleteMany({ projectId }),
    ]);
    return res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const triggerGraphUpdate = async (req: Request, res: Response) => {
  try {
    if (!graphQueue) {
      return res.status(503).json({ error: 'Background job queue unavailable (Redis not connected).' });
    }
    const { projectId } = req.params;
    // Add a job to the graph generation queue
    const job = await graphQueue.add('knowledge-graph-generation', { projectId });
    return res.status(202).json({ message: 'Knowledge graph generation triggered', jobId: job.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getProjectGaps = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const gaps = await Gap.find({ projectId }).sort({ createdAt: -1 });
    return res.status(200).json(gaps);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const generateAIGaps = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const aiRes = await axios.post(`${AI_SERVICE_URL}/api/project/generate-gaps`, {
      name: project.name,
      description: project.description || '',
    });

    let gapsArray = aiRes.data?.gaps;
    if (gapsArray && !Array.isArray(gapsArray)) {
      if (Array.isArray(gapsArray.gaps)) {
        gapsArray = gapsArray.gaps;
      } else if (Array.isArray(gapsArray.research_gaps)) {
        gapsArray = gapsArray.research_gaps;
      }
    }

    if (aiRes.data && aiRes.data.success && Array.isArray(gapsArray)) {
      const savedGaps = [];
      for (const g of gapsArray) {
        const gap = new Gap({
          projectId,
          title: g.title || g.gap_title || 'Mined Gap',
          description: g.description || 'No description provided.',
          evidence: g.evidence || [],
          category: (() => {
            const cat = String(g.category || 'other').toLowerCase().trim();
            if (cat.startsWith('methodolog')) return 'methodological';
            if (cat.startsWith('theor')) return 'theoretical';
            if (cat.startsWith('empiric')) return 'empirical';
            if (cat === 'dataset' || cat === 'data') return 'dataset';
            return 'other';
          })(),
          impactScore: typeof g.impactScore === 'number' ? g.impactScore : 5,
          feasibilityScore: typeof g.feasibilityScore === 'number' ? g.feasibilityScore : 5,
          confidence: typeof g.confidence === 'number' ? g.confidence : 0.8,
        });
        await gap.save();
        savedGaps.push(gap);
      }
      return res.status(201).json(savedGaps);
    } else {
      return res.status(500).json({ error: aiRes.data?.error || 'AI generation failed' });
    }
  } catch (error: any) {
    console.error('[generateAIGaps] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const createProjectGap = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { title, description, category, impactScore, feasibilityScore, evidence } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const gap = new Gap({
      projectId,
      title: title || 'Mined Gap',
      description: description || 'No description provided.',
      category: category || 'other',
      impactScore: typeof impactScore === 'number' ? impactScore : 5,
      feasibilityScore: typeof feasibilityScore === 'number' ? feasibilityScore : 5,
      evidence: evidence || [],
    });

    await gap.save();
    return res.status(201).json(gap);
  } catch (error: any) {
    console.error('[createProjectGap] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const generateSingleAIGap = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const aiRes = await axios.post(`${AI_SERVICE_URL}/api/project/generate-single-gap`, {
      name: project.name,
      description: project.description || '',
    });

    if (aiRes.data && aiRes.data.success && aiRes.data.gap) {
      return res.status(200).json(aiRes.data.gap);
    } else {
      return res.status(500).json({ error: aiRes.data?.error || 'AI generation failed' });
    }
  } catch (error: any) {
    console.error('[generateSingleAIGap] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const getProjectFactChecks = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const checks = await FactCheck.find({ projectId }).sort({ createdAt: -1 });
    return res.status(200).json(checks);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};



export const getProjectGeneratedPapers = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const papers = await GeneratedPaper.find({ projectId }).sort({ createdAt: -1 });
    return res.status(200).json(papers);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateProjectGeneratedPaper = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { paperId, title, sections, references, outline } = req.body;

    let paper;
    if (paperId) {
      paper = await GeneratedPaper.findById(paperId);
    } else {
      paper = await GeneratedPaper.findOne({ projectId }).sort({ createdAt: -1 });
    }

    if (paper) {
      if (title !== undefined) paper.title = title;
      if (sections !== undefined) paper.sections = sections;
      if (references !== undefined) paper.references = references;
      if (outline !== undefined) paper.outline = outline;
      paper.status = 'draft';
      await paper.save();
    } else {
      paper = new GeneratedPaper({
        projectId,
        title: title || 'Untitled Research Manuscript',
        sections: sections || [],
        references: references || [],
        outline: outline || (sections ? sections.map((s: any) => s.title) : []),
        status: 'draft',
      });
      await paper.save();
    }
    return res.status(200).json(paper);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteProjectGeneratedPaper = async (req: Request, res: Response) => {
  try {
    const { paperId } = req.params;
    await GeneratedPaper.findByIdAndDelete(paperId);
    return res.status(200).json({ message: 'Paper deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};


export const getProjectGraph = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const graph = await KnowledgeGraph.findOne({ projectId });
    if (!graph) {
      return res.status(200).json({ nodes: [], links: [] });
    }
    return res.status(200).json(graph);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateProjectGap = async (req: Request, res: Response) => {
  try {
    const { gapId } = req.params;
    const { title, description, category, impactScore, feasibilityScore, evidence } = req.body;

    const gap = await Gap.findById(gapId);
    if (!gap) {
      return res.status(404).json({ error: 'Gap not found' });
    }

    if (title !== undefined) gap.title = title;
    if (description !== undefined) gap.description = description;
    if (category !== undefined) gap.category = category;
    if (impactScore !== undefined) gap.impactScore = impactScore;
    if (feasibilityScore !== undefined) gap.feasibilityScore = feasibilityScore;
    if (evidence !== undefined) gap.evidence = evidence;

    await gap.save();
    return res.status(200).json(gap);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteProjectGap = async (req: Request, res: Response) => {
  try {
    const { gapId } = req.params;
    const gap = await Gap.findByIdAndDelete(gapId);
    if (!gap) {
      return res.status(404).json({ error: 'Gap not found' });
    }
    return res.status(200).json({ message: 'Gap deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { name, description } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;

    await project.save();
    return res.status(200).json(project);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const generateAIDescription = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    const aiRes = await axios.post(`${AI_SERVICE_URL}/api/project/generate-description`, { name });
    if (aiRes.data && aiRes.data.success) {
      return res.status(200).json({ description: aiRes.data.description });
    } else {
      return res.status(500).json({ error: aiRes.data.error || 'AI generation failed' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

function parseHtmlToManuscript(html: string): { title: string; sections: { title: string; content: string }[]; references: string[] } {
  let title = "Untitled Manuscript";
  const titleMatch = html.match(/<h1[^>]*class="doc-title"[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
  }

  const sections: { title: string; content: string }[] = [];
  const references: string[] = [];

  // Match all <section> wrapper elements if they exist
  const sectionRegex = /<section[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*<div[^>]*>([\s\S]*?)<\/div>\s*<\/section>/gi;
  let match;
  let hasWrappedSections = false;

  while ((match = sectionRegex.exec(html)) !== null) {
    hasWrappedSections = true;
    const secTitle = match[1].replace(/<[^>]*>/g, '').trim();
    const secContent = match[2].trim();

    if (secTitle.toLowerCase() === 'references' || secTitle.toLowerCase().includes('bibliography')) {
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(secContent)) !== null) {
        references.push(liMatch[1].replace(/<[^>]*>/g, '').trim());
      }
      if (references.length === 0) {
        const lines = secContent.split(/<p>|<br\/?>/i);
        lines.forEach(line => {
          const cleanLine = line.replace(/<[^>]*>/g, '').trim();
          if (cleanLine) references.push(cleanLine);
        });
      }
    } else {
      sections.push({ title: secTitle, content: secContent });
    }
  }

  // If no wrapped sections were found, parse flat h2 tags
  if (!hasWrappedSections) {
    const parts = html.split(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
    
    // Abstract check in first part
    const abstractMatch = html.match(/<div[^>]*class="abstract-section"[^>]*>([\s\S]*?)<\/div>/i) || html.match(/<strong>ABSTRACT<\/strong>([\s\S]*?)(?:<strong>|$)/i);
    if (abstractMatch) {
      sections.push({
        title: "Abstract",
        content: abstractMatch[1].replace(/<[^>]*>/g, '').trim()
      });
    }

    for (let i = 1; i < parts.length; i += 2) {
      const secTitle = parts[i].replace(/<[^>]*>/g, '').trim();
      const secContent = (parts[i + 1] || '').trim();

      if (secTitle.toLowerCase() === 'references' || secTitle.toLowerCase().includes('bibliography')) {
        const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let liMatch;
        while ((liMatch = liRegex.exec(secContent)) !== null) {
          references.push(liMatch[1].replace(/<[^>]*>/g, '').trim());
        }
      } else {
        sections.push({ title: secTitle, content: secContent });
      }
    }
  }

  return { title, sections, references };
}

export const exportProjectPaperPDF = async (req: Request, res: Response) => {
  let tempFilePath = '';
  try {
    const { htmlContent, format } = req.body;
    if (!htmlContent) {
      return res.status(400).json({ error: 'htmlContent is required' });
    }

    // Attempt to format and compile via FormaTeX API
    try {
      console.log(`[exportProjectPaperPDF] Attempting FormaTeX compilation for format: ${format || 'IEEE'}`);
      const manuscript = parseHtmlToManuscript(htmlContent);
      let latex = '';
      
      const styleUpper = (format || 'IEEE').toUpperCase();
      switch (styleUpper) {
        case 'SPRINGER':
          const springerRes = await FormaTeXService.formatSpringer(manuscript);
          latex = springerRes.latex;
          break;
        case 'ACM':
          const acmRes = await FormaTeXService.formatACM(manuscript);
          latex = acmRes.latex;
          break;
        case 'ELSEVIER':
          const elsevierRes = await FormaTeXService.formatElsevier(manuscript);
          latex = elsevierRes.latex;
          break;
        case 'HARVARD':
          const harvardRes = await FormaTeXService.formatHarvard(manuscript);
          latex = harvardRes.latex;
          break;
        case 'APA':
          const apaRes = await FormaTeXService.formatAPA(manuscript);
          latex = apaRes.latex;
          break;
        case 'IEEE':
        default:
          const ieeeRes = await FormaTeXService.formatIEEE(manuscript);
          latex = ieeeRes.latex;
          break;
      }
      
      if (latex) {
        const compileRes = await FormaTeXService.compileLatex(latex, 'pdflatex', format || 'IEEE');
        if (compileRes && compileRes.filePath && fs.existsSync(compileRes.filePath)) {
          const pdfBuffer = fs.readFileSync(compileRes.filePath);
          
          // Cleanup compiled file
          try {
            fs.unlinkSync(compileRes.filePath);
          } catch (e) {}

          console.log('[exportProjectPaperPDF] FormaTeX compilation successful!');
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'attachment; filename=research_paper.pdf');
          return res.send(pdfBuffer);
        }
      }
    } catch (err: any) {
      console.warn('[exportProjectPaperPDF] FormaTeX compilation failed, falling back to local Chromium print-to-pdf:', err.message);
    }

    // --- FALLBACK: Local Chromium Print-to-PDF ---
    console.log('[exportProjectPaperPDF] Initiating local Chromium print-to-pdf fallback...');
    
    // Convert absolute uploads URL to relative uploads/ paths
    let processedHtml = htmlContent.replace(
      /https?:\/\/[^\/]+(:\d+)?\/uploads\//g,
      'uploads/'
    );

    // Get the absolute base path for file:// origin in Chromium
    const uploadsPath = path.resolve('uploads');
    const projectRootPath = path.dirname(uploadsPath).replace(/\\/g, '/');
    const fileBaseUrl = `file://${projectRootPath}/`;

    // Inject base href tag as the very first element in <head>
    processedHtml = processedHtml.replace(
      '<head>',
      `<head>\n<base href="${fileBaseUrl}">`
    );

    // Write HTML to a temporary file in the project root to bypass Chromium CORS file blocks
    const tempFileName = `temp_export_${Date.now()}_${Math.round(Math.random() * 1e9)}.html`;
    tempFilePath = path.join(projectRootPath, tempFileName);
    fs.writeFileSync(tempFilePath, processedHtml, 'utf-8');

    // Launch Chromium headlessly using the system browser package in Alpine
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
      args: [
        '--headless',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--font-render-hinting=none'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1200, height: 1600 }
    });
    const page = await context.newPage();

    // Navigate to the file:// URL directly to allow local file references
    const fileUrl = `file://${path.resolve(tempFilePath).replace(/\\/g, '/')}`;
    await page.goto(fileUrl, { waitUntil: 'load' });

    // Wait for KaTeX and Mermaid scripts to evaluate and render their targets
    await page.waitForTimeout(2000);

    // Render the A4 page layout based on standard template CSS
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true
    });

    await browser.close();

    // Cleanup temp file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      tempFilePath = '';
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=research_paper.pdf');
    return res.send(pdfBuffer);
  } catch (error: any) {
    console.error('[exportProjectPaperPDF] Local fallback failed:', error);
    // Ensure cleanup in case of error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {}
    }
    return res.status(500).json({ error: error.message });
  }
};
