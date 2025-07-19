#!/usr/bin/env bun

/**
 * Simple verification script for E2B templates
 */

import {
  JAVASCRIPT_TEMPLATES,
  PYTHON_TEMPLATES,
  getTemplate,
  generateCode,
  listAllTemplates,
  suggestTemplates,
  getCategories,
} from './src/templates/index.js';

console.log('🔧 E2B Templates Verification Script');
console.log('=====================================\n');

// Test 1: Template Counts
console.log('📊 Template Statistics:');
console.log(`JavaScript templates: ${JAVASCRIPT_TEMPLATES.length}`);
console.log(`Python templates: ${PYTHON_TEMPLATES.length}`);
console.log(`Total templates: ${JAVASCRIPT_TEMPLATES.length + PYTHON_TEMPLATES.length}\n`);

// Test 2: Categories
console.log('📁 Available Categories:');
const jsCategories = getCategories('javascript');
const pyCategories = getCategories('python');
console.log(`JavaScript: ${jsCategories.join(', ')}`);
console.log(`Python: ${pyCategories.join(', ')}\n`);

// Test 3: Sample Templates
console.log('🧪 Sample Template Tests:');

// Test JavaScript Hello World
try {
  const jsHello = getTemplate('javascript', 'hello-world');
  if (jsHello) {
    const jsCode = generateCode('javascript', 'hello-world');
    console.log('✅ JavaScript hello-world template found and generated');
    console.log(`   Code preview: ${jsCode.substring(0, 50)}...`);
  } else {
    console.log('❌ JavaScript hello-world template not found');
  }
} catch (error) {
  console.log(`❌ JavaScript hello-world test failed: ${error.message}`);
}

// Test Python Hello World
try {
  const pyHello = getTemplate('python', 'hello-world');
  if (pyHello) {
    const pyCode = generateCode('python', 'hello-world');
    console.log('✅ Python hello-world template found and generated');
    console.log(`   Code preview: ${pyCode.substring(0, 50)}...`);
  } else {
    console.log('❌ Python hello-world template not found');
  }
} catch (error) {
  console.log(`❌ Python hello-world test failed: ${error.message}`);
}

// Test 4: Template Suggestions
console.log('\n💡 Template Suggestions Test:');
const suggestions = suggestTemplates(['sorting', 'algorithm']);
console.log(`Found ${suggestions.length} suggestions for "sorting algorithm"`);
if (suggestions.length > 0) {
  console.log(`Top suggestion: ${suggestions[0].name} (${suggestions[0].language})`);
}

// Test 5: All Templates List
console.log('\n📋 All Templates Summary:');
const allTemplates = listAllTemplates();
const byLanguage = allTemplates.reduce(
  (acc, template) => {
    if (!acc[template.language]) acc[template.language] = [];
    acc[template.language].push(template);
    return acc;
  },
  {} as Record<string, any[]>
);

Object.entries(byLanguage).forEach(([language, templates]) => {
  console.log(`${language.toUpperCase()}: ${templates.length} templates`);
  const categories = [...new Set(templates.map((t) => t.category))];
  console.log(`  Categories: ${categories.join(', ')}`);
});

// Test 6: Complex Templates
console.log('\n🔬 Complex Template Tests:');

// Test Python data science template
try {
  const pyDataScience = getTemplate('python', 'basic-statistics');
  if (pyDataScience) {
    console.log('✅ Python data science template (basic-statistics) found');
    console.log(`   Requirements: ${pyDataScience.requirements?.join(', ') || 'None'}`);
  } else {
    console.log('❌ Python basic-statistics template not found');
  }
} catch (error) {
  console.log(`❌ Python data science test failed: ${error.message}`);
}

// Test JavaScript algorithm template
try {
  const jsAlgorithm = getTemplate('javascript', 'sorting-algorithms');
  if (jsAlgorithm) {
    console.log('✅ JavaScript sorting algorithms template found');
    console.log(`   Category: ${jsAlgorithm.category}`);
  } else {
    console.log('❌ JavaScript sorting-algorithms template not found');
  }
} catch (error) {
  console.log(`❌ JavaScript algorithm test failed: ${error.message}`);
}

console.log('\n🎉 Template verification completed!');
console.log('\nTo use templates in the E2B plugin, try these commands:');
console.log('- "List all available templates"');
console.log('- "Run template hello-world in Python"');
console.log('- "Run template array-operations in JavaScript"');
console.log('- "Suggest templates for data analysis"');
console.log('- "Show me JavaScript data processing templates"');
