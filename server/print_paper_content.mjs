import mongoose from 'mongoose';

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
      status: String
    }, { collection: 'generatedpapers' });
    
    const GeneratedPaper = mongoose.model('GeneratedPaper', paperSchema);
    
    const paper = await GeneratedPaper.findOne({ title: /Temporal-Aware/i });
    if (!paper) {
      console.log('Paper not found');
      return;
    }
    
    console.log(`=== Paper: ${paper.title} ===`);
    for (const sec of paper.sections || []) {
      if (sec.title.includes('Architecture') || sec.title.includes('Details') || sec.title.includes('Future Work')) {
        console.log(`\n--- Section: ${sec.title} ---`);
        console.log(sec.content);
      }
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

main();
