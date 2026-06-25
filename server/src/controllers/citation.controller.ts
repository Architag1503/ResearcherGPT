import { Request, Response } from 'express';
import axios from 'axios';
import Citation from '../models/Citation.js';

// Simple helper to generate citation strings fallback
const generateFallbackStyles = (citation: any) => {
  const authorList = citation.authors && citation.authors.length > 0
    ? citation.authors.join(', ')
    : 'Unknown Author';
  const year = citation.year ? `(${citation.year})` : '';
  const title = citation.title || 'Untitled Work';
  const journal = citation.journal ? `*${citation.journal}*` : '';
  const volume = citation.volume ? `, ${citation.volume}` : '';
  const pages = citation.pages ? `, pp. ${citation.pages}` : '';

  return {
    apa: `${authorList} ${year}. ${title}. ${journal}${volume}${pages}.`,
    mla: `${authorList}. "${title}." ${journal || 'Academic Press'}, ${citation.year || 'n.d.'}${pages}.`,
    ieee: `[1] ${authorList}, "${title}," ${journal || 'Academic Press'}${volume}${pages}, ${citation.year || 'n.d.'}.`,
    chicago: `${authorList}. ${citation.year || 'n.d.'}. "${title}." ${journal || 'Academic Press'}${volume}${pages}.`,
    harvard: `${authorList} ${year} '${title}', ${journal || 'Academic Press'}${volume}${pages}.`,
  };
};

export const createCitation = async (req: Request, res: Response) => {
  try {
    const { projectId, doi, title, authors, journal, year, volume, issue, pages, publisher } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    let citationData: any = {
      projectId,
      doi,
      title: title || 'Untitled Citation',
      authors: authors || [],
      journal,
      year: year || new Date().getFullYear(),
      volume,
      issue,
      pages,
      publisher,
    };

    // If DOI is provided, let's fetch metadata from CrossRef API
    if (doi && (!title || !authors || authors.length === 0)) {
      try {
        const cleanDoi = doi.trim().replace(/^https?:\/\/doi\.org\//, '');
        const crossRefResponse = await axios.get(`https://api.crossref.org/works/${cleanDoi}`, {
          headers: { 'User-Agent': 'ResearcherGPT/1.0 (mailto:support@researchergpt.io)' }
        });

        const item = crossRefResponse.data?.message;
        if (item) {
          citationData.title = item.title?.[0] || citationData.title;
          citationData.authors = item.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()) || citationData.authors;
          citationData.journal = item['container-title']?.[0] || citationData.journal;
          citationData.publisher = item.publisher || citationData.publisher;
          citationData.volume = item.volume || citationData.volume;
          citationData.issue = item['journal-issue']?.issue || citationData.issue;
          citationData.pages = item.page || citationData.pages;
          if (item.created?.['date-parts']?.[0]?.[0]) {
            citationData.year = item.created['date-parts'][0][0];
          }
        }
      } catch (err: any) {
        console.warn('CrossRef metadata fetch failed, using manual fields:', err.message);
      }
    }

    // Set key (e.g. Smith2024)
    const primaryAuthor = citationData.authors?.[0]?.split(' ')?.pop() || 'Unknown';
    citationData.key = `${primaryAuthor}${citationData.year}`;

    // Generate formatted text strings
    citationData.styles = generateFallbackStyles(citationData);

    const citation = new Citation(citationData);
    await citation.save();
    return res.status(201).json(citation);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getCitations = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    const citations = await Citation.find({ projectId }).sort({ createdAt: -1 });
    return res.status(200).json(citations);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteCitation = async (req: Request, res: Response) => {
  try {
    const { citationId } = req.params;
    const citation = await Citation.findByIdAndDelete(citationId);
    if (!citation) {
      return res.status(404).json({ error: 'Citation not found' });
    }
    return res.status(200).json({ message: 'Citation deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateCitation = async (req: Request, res: Response) => {
  try {
    const { citationId } = req.params;
    const { doi, title, authors, journal, year, volume, issue, pages, publisher, apa, mla, ieee, chicago, harvard } = req.body;

    const citation = await Citation.findById(citationId);
    if (!citation) {
      return res.status(404).json({ error: 'Citation not found' });
    }

    if (doi !== undefined) citation.doi = doi;
    if (title !== undefined) citation.title = title;
    if (authors !== undefined) citation.authors = authors;
    if (journal !== undefined) citation.journal = journal;
    if (year !== undefined) citation.year = year;
    if (volume !== undefined) citation.volume = volume;
    if (issue !== undefined) citation.issue = issue;
    if (pages !== undefined) citation.pages = pages;
    if (publisher !== undefined) citation.publisher = publisher;

    const styles = generateFallbackStyles(citation);
    citation.styles = {
      apa: apa !== undefined ? apa : (citation.styles?.apa || styles.apa),
      mla: mla !== undefined ? mla : (citation.styles?.mla || styles.mla),
      ieee: ieee !== undefined ? ieee : (citation.styles?.ieee || styles.ieee),
      chicago: chicago !== undefined ? chicago : (citation.styles?.chicago || styles.chicago),
      harvard: harvard !== undefined ? harvard : (citation.styles?.harvard || styles.harvard),
    };

    const primaryAuthor = citation.authors?.[0]?.split(' ')?.pop() || 'Unknown';
    citation.key = `${primaryAuthor}${citation.year}`;

    await citation.save();
    return res.status(200).json(citation);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
