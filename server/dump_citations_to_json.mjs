import mongoose from 'mongoose';
import fs from 'fs';

const MONGO_URI = 'mongodb://localhost:27017/researcher_gpt';

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Read paper_data.json to get the projectId
    const paperData = JSON.parse(fs.readFileSync('paper_data.json', 'utf-8'));
    const projectId = paperData.projectId;
    console.log('Project ID from paper:', projectId);

    const citationSchema = new mongoose.Schema({
      projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
      key: String,
      doi: String,
      title: String,
      authors: [String],
      journal: String,
      year: Number,
      volume: String,
      issue: String,
      pages: String,
      publisher: String,
      styles: {
        ieee: String,
        apa: String,
        mla: String,
        chicago: String,
        harvard: String
      }
    }, { collection: 'citations' });

    const Citation = mongoose.model('Citation', citationSchema);
    const citations = await Citation.find({ projectId: new mongoose.Types.ObjectId(projectId) });
    console.log(`Found ${citations.length} citations for project ${projectId}`);

    fs.writeFileSync('citations_data.json', JSON.stringify(citations, null, 2), 'utf-8');
    console.log('Successfully wrote citations_data.json');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error running dump_citations_to_json.mjs:', err);
  }
}

main();
