import { Request, Response } from 'express';
import axios from 'axios';
import LearningNode from '../models/LearningNode.js';
import Paper from '../models/Paper.js';
import GeneratedPaper from '../models/GeneratedPaper.js';
import KnowledgeGraph from '../models/Graph.js';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

export const getGraphNodeLearningDetails = async (req: Request, res: Response) => {
  try {
    const { projectId, nodeId } = req.params;
    const { label: queryLabel, type: queryType } = req.query;

    // 1. Check Cache
    const cachedNode = await LearningNode.findOne({ projectId, nodeId });
    if (cachedNode) {
      return res.status(200).json(cachedNode);
    }

    // 2. Fetch KnowledgeGraph to find node details and links
    const graph = await KnowledgeGraph.findOne({ projectId });
    const graphNode = graph?.nodes.find((n) => n.id === nodeId);
    
    const label = (graphNode?.label || queryLabel || 'Unknown Node') as string;
    const type = (graphNode?.type || queryType || 'concept') as string;

    if (!graphNode && !queryLabel) {
      console.warn(`[LearningNodeController] Node ${nodeId} not found in graph, using query fallback.`);
    }

    // 3. Gather Workspace Context
    const uploadedPapers = await Paper.find({ projectId });
    const generatedPapers = await GeneratedPaper.find({ projectId });

    let contextPapers: Array<{ title: string; authors: string[]; abstract: string; content?: string }> = [];

    if (type === 'paper') {
      // Find the specific paper text or metadata
      const dbId = nodeId.replace(/^paper_/, '');
      const targetPaper = uploadedPapers.find((p) => p._id.toString() === dbId) || 
                          generatedPapers.find((p) => p._id.toString() === dbId);
      
      if (targetPaper) {
        let content = '';
        if ('sections' in targetPaper && Array.isArray(targetPaper.sections)) {
          content = targetPaper.sections.map((s: any) => `${s.heading}\n${s.content}`).join('\n\n');
        }
        contextPapers.push({
          title: targetPaper.title,
          authors: 'authors' in targetPaper ? (targetPaper.authors as string[]) : [],
          abstract: 'abstract' in targetPaper ? (targetPaper.abstract as string) : '',
          content: content || 'No section text available.'
        });
      }
    } else if (type === 'author') {
      // Find all papers by this author in the project
      const authorClean = label.trim().toLowerCase();
      uploadedPapers.forEach((p) => {
        const matches = p.authors.some((a) => a.toLowerCase().includes(authorClean));
        if (matches) {
          contextPapers.push({
            title: p.title,
            authors: p.authors,
            abstract: p.abstract || ''
          });
        }
      });
    } else {
      // Method, Dataset, Concept: Scan titles and abstracts for occurrences of label
      const termClean = label.trim().toLowerCase();
      
      uploadedPapers.forEach((p) => {
        const titleMatch = p.title.toLowerCase().includes(termClean);
        const abstractMatch = p.abstract?.toLowerCase().includes(termClean);
        if (titleMatch || abstractMatch) {
          contextPapers.push({
            title: p.title,
            authors: p.authors,
            abstract: p.abstract || ''
          });
        }
      });

      generatedPapers.forEach((p) => {
        const titleMatch = p.title.toLowerCase().includes(termClean);
        const sectionsMatch = p.sections?.some((s) => s.content.toLowerCase().includes(termClean) || s.title.toLowerCase().includes(termClean));
        if (titleMatch || sectionsMatch) {
          contextPapers.push({
            title: p.title,
            authors: [],
            abstract: p.outline?.join('\n') || ''
          });
        }
      });
    }

    // Limit context papers to top 5 to fit prompt limits
    contextPapers = contextPapers.slice(0, 5);

    // 4. Gather connected nodes & relations
    const directLinks = graph?.links.filter((l) => l.source === nodeId || l.target === nodeId) || [];
    const connectedNodes: any[] = [];
    
    directLinks.forEach((link) => {
      const targetId = link.source === nodeId ? link.target : link.source;
      const targetNode = graph?.nodes.find((n) => n.id === targetId);
      if (targetNode) {
        connectedNodes.push({
          id: targetNode.id,
          label: targetNode.label,
          type: targetNode.type
        });
      }
    });

    // 5. Query FastAPI AI service to generate learning content
    console.log(`[LearningNodeController] Generating learning node details from AI service for label: ${label} (${type})`);
    
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/graph/learning-node`, {
      project_id: projectId,
      node_id: nodeId,
      label,
      node_type: type,
      context_papers: contextPapers,
      connected_nodes: connectedNodes,
      connected_links: directLinks.map((l) => ({ source: l.source, target: l.target, label: l.label }))
    });

    const aiData = aiResponse.data;
    if (!aiData || !aiData.success) {
      throw new Error(aiData?.error || 'AI generation failed');
    }

    // 6. Save in cache
    const newLearningNode = new LearningNode({
      projectId,
      nodeId,
      label,
      type,
      explanations: aiData.explanations,
      whySeeingThis: aiData.why_seeing_this,
      connections: aiData.connections,
      typeSpecificData: aiData.type_specific_data,
      learningAssets: aiData.learning_assets
    });

    await newLearningNode.save();
    return res.status(200).json(newLearningNode);

  } catch (error: any) {
    console.error(`[LearningNodeController] Error in getGraphNodeLearningDetails:`, error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const askGraphNodeQuestion = async (req: Request, res: Response) => {
  try {
    const { projectId, nodeId } = req.params;
    const { question } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const learningNode = await LearningNode.findOne({ projectId, nodeId });
    if (!learningNode) {
      return res.status(404).json({ error: 'Learning node details not yet generated. Visit the node first.' });
    }

    // Call FastAPI Ask endpoint
    const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/graph/learning-node/ask`, {
      project_id: projectId,
      node_id: nodeId,
      label: learningNode.label,
      node_type: learningNode.type,
      question,
      node_details: {
        explanations: learningNode.explanations,
        whySeeingThis: learningNode.whySeeingThis,
        typeSpecificData: learningNode.typeSpecificData
      }
    });

    return res.status(200).json({ answer: aiResponse.data.answer });

  } catch (error: any) {
    console.error(`[LearningNodeController] Error in askGraphNodeQuestion:`, error.message);
    return res.status(500).json({ error: error.message });
  }
};
