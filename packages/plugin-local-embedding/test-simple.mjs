// Simple test that imports transformers directly to avoid sharp issues
import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.backends.onnx.wasm.proxy = false;

async function testTransformersDirectly() {
  console.log('Testing Transformers.js directly (avoiding sharp issues)...\n');

  try {
    // Initialize pipeline
    console.log('1. Initializing embedding pipeline...');
    const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
    console.log('✅ Pipeline initialized\n');

    // Test embeddings
    console.log('2. Generating embeddings...');
    const texts = ['Hello world', 'I love programming', 'I enjoy coding', 'The weather is nice'];

    const embeddings = [];
    for (const text of texts) {
      console.log(`Processing: "${text}"`);
      const output = await pipe(text, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);
      embeddings.push(embedding);
      console.log(`- Dimensions: ${embedding.length}`);
      console.log(
        `- First 3 values: [${embedding
          .slice(0, 3)
          .map((v) => v.toFixed(4))
          .join(', ')}]`
      );
    }

    // Calculate similarities
    console.log('\n3. Calculating similarities...');
    const cosineSimilarity = (a, b) => {
      const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
      const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
      const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
      return dotProduct / (magnitudeA * magnitudeB);
    };

    console.log(`\nSimilarity scores:`);
    console.log(
      `- "${texts[1]}" vs "${texts[2]}": ${cosineSimilarity(embeddings[1], embeddings[2]).toFixed(4)}`
    );
    console.log(
      `- "${texts[1]}" vs "${texts[3]}": ${cosineSimilarity(embeddings[1], embeddings[3]).toFixed(4)}`
    );

    console.log('\n✅ Test completed successfully!');
    console.log('Transformers.js is working correctly for embeddings.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testTransformersDirectly().catch(console.error);
