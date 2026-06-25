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
    
    const papers = await GeneratedPaper.find({}).sort({ createdAt: -1 });
    console.log(`Found ${papers.length} papers`);
    
    for (const paper of papers) {
      console.log(`\n--- Paper: ${paper.title} (Status: ${paper.status}) ---`);
      for (const sec of paper.sections || []) {
        console.log(`Section: ${sec.title}`);
        const imgs = sec.content.match(/<img[^>]+>|!\[[^\]]*\]\([^\)]+\)/g);
        if (imgs) {
          console.log(`  Found images:`, imgs);
        }
      }
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

main();
