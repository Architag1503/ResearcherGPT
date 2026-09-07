import mongoose from 'mongoose';
import axios from 'axios';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://architag1503:Archit1503@cluster0.nuqane7.mongodb.net/researcher_gpt?retryWrites=true&w=majority';
const OPENALEX_API_KEY = '5Xkx8yhWA9211jHYZzQ6TC';
const HEADERS = { 'User-Agent': 'ResearcherGPT/1.0 (mailto:support@researchergpt.io)' };

function generateCitationStyles(paper, index = 1) {
  const authors = paper.authors || [];
  const year = paper.year || 2024;
  const title = paper.title || 'Untitled Work';
  const journal = paper.journal || 'Academic Press';
  const volume = paper.volume || '';
  const issue = paper.issue || '';
  const pages = paper.pages || '';
  const doi = paper.doi || '';
  const url = paper.url || (doi ? `https://doi.org/${doi}` : '');

  let authorsApa = 'Unknown Author';
  let authorsIeee = 'Unknown Author';
  let authorsMla = 'Unknown Author';

  if (authors.length === 1) {
    authorsApa = authors[0];
    authorsIeee = authors[0];
    authorsMla = authors[0];
  } else if (authors.length === 2) {
    authorsApa = `${authors[0]}, & ${authors[1]}`;
    authorsIeee = `${authors[0]} and ${authors[1]}`;
    authorsMla = `${authors[0]}, and ${authors[1]}`;
  } else if (authors.length > 2) {
    authorsApa = `${authors[0]} et al.`;
    authorsIeee = `${authors[0]} et al.`;
    authorsMla = `${authors[0]}, et al.`;
  }

  let volIss = '';
  if (volume && issue) volIss = `, ${volume}(${issue})`;
  else if (volume) volIss = `, ${volume}`;
  if (pages) volIss += `, pp. ${pages}`;

  const doiStr = doi && !doi.startsWith('arXiv') ? ` https://doi.org/${doi}` : (url ? ` ${url}` : '');

  return {
    apa: `${authorsApa} (${year}). ${title}. *${journal}*${volIss}.${doiStr}`.trim(),
    mla: `${authorsMla}. "${title}." *${journal}*${volIss}, ${year}.${doiStr}`.trim(),
    ieee: `[${index}] ${authorsIeee}, "${title}," *${journal}*${volIss}, ${year}.${doiStr}`.trim(),
    chicago: `${authorsMla} ${year}. "${title}." *${journal}*${volIss}.${doiStr}`.trim(),
    harvard: `${authorsApa} ${year}, '${title}', *${journal}*${volIss}.${doiStr}`.trim(),
  };
}

async function fetchRealPapers(query, limit = 6) {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${limit}&api_key=${OPENALEX_API_KEY}`;
  const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  const results = [];

  for (const item of res.data?.results || []) {
    const title = (item.title || '').trim();
    if (!title) continue;

    const authors = (item.authorships || [])
      .map(a => a.author?.display_name)
      .filter(Boolean);

    const pubDate = item.publication_date || String(item.publication_year || 2024);
    const year = item.publication_year || 2024;
    const primaryLoc = item.primary_location || {};
    const journal = primaryLoc.source?.display_name || 'Open Access Repository';
    const publisher = primaryLoc.source?.host_organization_name || item.publisher || '';
    const doi = (item.doi || '').replace('https://doi.org/', '').trim();
    const paperUrl = item.doi || primaryLoc.landing_page_url || (doi ? `https://doi.org/${doi}` : '');

    const biblio = item.biblio || {};
    const volume = String(biblio.volume || '');
    const issue = String(biblio.issue || '');
    const pages = biblio.first_page && biblio.last_page ? `${biblio.first_page}-${biblio.last_page}` : String(biblio.first_page || '');

    const firstAuthor = authors[0] || 'Author';
    const authorLast = firstAuthor.split(' ').pop().replace(/[^\w]/g, '') || 'Ref';
    const key = `${authorLast}${year}`;

    const paperObj = {
      title,
      authors,
      year,
      publishDate: pubDate,
      journal,
      publisher,
      volume,
      issue,
      pages,
      doi,
      url: paperUrl,
      key,
    };
    paperObj.styles = generateCitationStyles(paperObj, results.length + 1);
    results.push(paperObj);
  }
  return results;
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected successfully.');

  const db = mongoose.connection.db;

  const targetProjects = [
    {
      id: new mongoose.Types.ObjectId('6a2d59d1d4f4fe4f30e213d5'),
      name: 'Optimizing Multi-Agent Workflows in LangGraph',
      query: 'Multi-Agent Workflows LangGraph LLM Orchestration',
    },
    {
      id: new mongoose.Types.ObjectId('6a3e3a7ddf0458106b486424'),
      name: 'Neuro-Symbolic Agentic Systems',
      query: 'Neuro-Symbolic AI Agentic Reasoning Decision Making',
    }
  ];

  for (const proj of targetProjects) {
    console.log(`\n======================================================`);
    console.log(`Repairing citations for project: "${proj.name}" (${proj.id})`);
    console.log(`======================================================`);

    const realPapers = await fetchRealPapers(proj.query, 6);
    console.log(`Fetched ${realPapers.length} authentic, verified papers from OpenAlex:`);
    realPapers.forEach((p, idx) => {
      console.log(`  [${idx + 1}] ${p.key}: "${p.title}"`);
      console.log(`      Authors: ${p.authors.join(', ')}`);
      console.log(`      Publish Date: ${p.publishDate} | DOI: ${p.doi || 'N/A'} | Venue: ${p.journal}`);
    });

    // 1. Delete all old synthetic / untitled citations for this project
    const delResult = await db.collection('citations').deleteMany({ projectId: proj.id });
    console.log(`Removed ${delResult.deletedCount} old synthetic/untitled citations from database.`);

    // 2. Insert new authentic verified citations
    const citationDocs = realPapers.map(p => ({
      projectId: proj.id,
      key: p.key,
      doi: p.doi,
      url: p.url,
      title: p.title,
      authors: p.authors,
      journal: p.journal,
      year: p.year,
      publishDate: p.publishDate,
      volume: p.volume,
      issue: p.issue,
      pages: p.pages,
      publisher: p.publisher,
      styles: p.styles,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const insertResult = await db.collection('citations').insertMany(citationDocs);
    console.log(`Inserted ${insertResult.insertedCount} authentic citations into 'citations' collection.`);

    // 3. Update references in generatedpapers for this project
    const newReferences = realPapers.map(p => p.styles.apa || p.styles.ieee);
    const paperUpdate = await db.collection('generatedpapers').updateMany(
      { projectId: proj.id },
      { $set: { references: newReferences } }
    );
    console.log(`Updated references list for ${paperUpdate.modifiedCount} generated paper(s) in project.`);
  }

  console.log('\n--- VERIFYING FINAL CITATIONS IN DATABASE ---');
  const finalCitations = await db.collection('citations').find().toArray();
  console.log(`Total citations in database: ${finalCitations.length}`);
  finalCitations.forEach(c => {
    console.log(`- [${c.key}] "${c.title}"`);
    console.log(`  Authors: ${c.authors.slice(0, 3).join(', ')} | Published: ${c.publishDate || c.year} | DOI: ${c.doi || 'None'}`);
  });

  await mongoose.disconnect();
  console.log('\nDatabase connection closed. All citations repaired successfully!');
}

run().catch(err => {
  console.error('Fatal repair error:', err);
  process.exit(1);
});
