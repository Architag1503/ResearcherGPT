import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://architag1503:Archit1503@cluster0.nuqane7.mongodb.net/researcher_gpt?retryWrites=true&w=majority';

const TYPE_COLORS = {
  paper: '#6366f1',       // Indigo
  author: '#10b981',      // Emerald Green
  method: '#f59e0b',      // Amber Orange
  dataset: '#ec4899',     // Pink / Magenta
  concept: '#06b6d4',     // Cyan / Sky
  technology: '#8b5cf6',  // Purple / Violet
  metric: '#14b8a6',      // Teal
  result: '#22c55e',      // Bright Lime Green
  institution: '#3b82f6'  // Blue
};

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected successfully.');

  const db = mongoose.connection.db;
  const graphs = await db.collection('knowledgegraphs').find().toArray();
  console.log(`Found ${graphs.length} knowledge graph(s) to normalize.`);

  for (const g of graphs) {
    console.log(`\nProcessing graph for project ${g.projectId}:`);
    const nodes = g.nodes || [];
    let updatedCount = 0;

    const newNodes = nodes.map(n => {
      const type = (n.type || 'concept').toLowerCase();
      const properColor = TYPE_COLORS[type] || '#06b6d4';
      
      let label = n.label || '';
      if (label.startsWith('Received: 20 July 2025')) {
        label = 'Agentic Modal Logic Framework';
      }

      let val = n.val || 2;
      if (type === 'paper') val = 4;
      else if (type === 'method' || type === 'technology') val = 3;
      else if (type === 'author' || type === 'dataset') val = 2.5;

      if (n.color !== properColor || n.label !== label) {
        updatedCount++;
      }

      return {
        ...n,
        type,
        label,
        val,
        color: properColor
      };
    });

    await db.collection('knowledgegraphs').updateOne(
      { _id: g._id },
      { $set: { nodes: newNodes, updatedAt: new Date() } }
    );
    console.log(`  Updated ${updatedCount} nodes with correct authentic colors.`);

    // Summary of present node types & their colors
    const typeSummary = {};
    for (const n of newNodes) {
      if (!typeSummary[n.type]) {
        typeSummary[n.type] = { count: 0, color: n.color };
      }
      typeSummary[n.type].count++;
    }
    console.log('  Active Node Types in Graph:');
    Object.entries(typeSummary).forEach(([t, info]) => {
      console.log(`    - ${t.toUpperCase()}: ${info.count} nodes (Color: ${info.color})`);
    });
  }

  await mongoose.disconnect();
  console.log('\nAll knowledge graphs updated successfully!');
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
