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
    const { projectId, doi, title, authors, journal, year, publishDate, url, volume, issue, pages, publisher } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    let citationData: any = {
      projectId,
      doi,
      url: url || (doi ? (doi.startsWith('http') ? doi : `https://doi.org/${doi}`) : ''),
      title: title || 'Untitled Citation',
      authors: authors || [],
      journal,
      year: year || new Date().getFullYear(),
      publishDate: publishDate || (year ? String(year) : new Date().toISOString().split('T')[0]),
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
          if (item.issued?.['date-parts']?.[0]?.[0]) {
            const parts = item.issued['date-parts'][0];
            citationData.year = parts[0];
            const m = parts[1] ? String(parts[1]).padStart(2, '0') : '01';
            const d = parts[2] ? String(parts[2]).padStart(2, '0') : '01';
            citationData.publishDate = `${parts[0]}-${m}-${d}`;
          }
          if (cleanDoi && !citationData.url) {
            citationData.url = `https://doi.org/${cleanDoi}`;
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

export const searchAcademicPapers = async (req: Request, res: Response) => {
  try {
    const { query, limit = 5 } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'query is required' });
    }
    const openalexKey = process.env.OPENALEX_API_KEY || '';
    let oaUrl = `https://api.openalex.org/works?search=${encodeURIComponent(String(query))}&per_page=${limit}`;
    if (openalexKey) oaUrl += `&api_key=${openalexKey}`;

    const oaRes = await axios.get(oaUrl, {
      headers: { 'User-Agent': 'ResearcherGPT/1.0 (mailto:support@researchergpt.io)' },
      timeout: 10000,
    });

    const papers: any[] = [];
    for (const item of oaRes.data?.results || []) {
      const title = item.title;
      if (!title) continue;
      const authors = (item.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean);
      const pubDate = item.publication_date || String(item.publication_year || 2024);
      const year = item.publication_year || 2024;
      const primaryLoc = item.primary_location || {};
      const journal = primaryLoc.source?.display_name || '';
      const publisher = primaryLoc.source?.host_organization_name || item.publisher || '';
      const doi = (item.doi || '').replace('https://doi.org/', '');
      const url = item.doi || primaryLoc.landing_page_url || '';

      const authorShort = authors[0]?.split(' ')?.pop() || 'Author';
      const key = `${authorShort}${year}`;

      const citationObj = {
        title,
        authors,
        year,
        publishDate: pubDate,
        journal,
        publisher,
        doi,
        url,
        key,
        styles: generateFallbackStyles({ title, authors, year, journal, volume: item.biblio?.volume, pages: item.biblio?.first_page })
      };
      papers.push(citationObj);
    }
    return res.status(200).json(papers);
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
