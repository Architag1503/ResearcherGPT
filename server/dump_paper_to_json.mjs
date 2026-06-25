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
    const paper = await GeneratedPaper.findById('6a393c6087653771b1bad746');
    if (!paper) {
      console.error('Paper 6a393c6087653771b1bad746 not found in database.');
      await mongoose.disconnect();
      return;
    }

    fs.writeFileSync('paper_data.json', JSON.stringify(paper, null, 2), 'utf-8');
    console.log('Successfully wrote paper_data.json');

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error running dump_paper_to_json.mjs:', err);
  }
}

main();
