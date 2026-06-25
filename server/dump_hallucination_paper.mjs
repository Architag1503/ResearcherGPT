import mongoose from 'mongoose';
import fs from 'fs';

const MONGO_URI = 'mongodb://localhost:27017/researcher_gpt';

async function main() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const paperSchema = new mongoose.Schema({
      projectId: String,
      title: String,
      sections: [{
        title: String,
        heading: String,
        content: String
      }],
      references: [String],
      status: String
    }, { collection: 'generatedpapers' });

    const GeneratedPaper = mongoose.model('GeneratedPaper', paperSchema);
    const paper = await GeneratedPaper.findOne({ title: /Hallucination/i });
    if (!paper) {
      console.error('Hallucination paper not found in database.');
      await mongoose.disconnect();
      return;
    }

    fs.writeFileSync('hallucination_paper.json', JSON.stringify(paper, null, 2), 'utf-8');
    console.log('Successfully wrote hallucination_paper.json');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error running dump_hallucination_paper.mjs:', err);
  }
}

main();
