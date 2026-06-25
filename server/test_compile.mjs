import mongoose from 'mongoose';
import fs from 'fs';
import { FormaTeXService } from './dist/services/formatex.service.js';

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

    console.log('Found paper:', paper.title);

    const sourceManuscript = {
      title: paper.title,
      sections: paper.sections,
      references: paper.references,
    };

    console.log('Formatting manuscript to IEEE style...');
    const formatResult = await FormaTeXService.formatIEEE(sourceManuscript);
    
    console.log('Generated LaTeX source length:', formatResult.latex.length);
    fs.writeFileSync('test_generated_source.tex', formatResult.latex, 'utf-8');
    console.log('Saved LaTeX source to test_generated_source.tex');

    console.log('Compiling LaTeX to PDF...');
    const compileResult = await FormaTeXService.compileLatex(formatResult.latex, 'pdflatex', 'IEEE');
    console.log('Compile Result:', compileResult);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error in test_compile.mjs:', err);
  }
}

main();
