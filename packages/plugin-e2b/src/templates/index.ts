/**
 * E2B Code Interpreter Templates
 * Exports all available code templates for JavaScript and Python
 */

export * from './javascript-templates.js';
export * from './python-templates.js';

import {
  JAVASCRIPT_TEMPLATES,
  getJavaScriptTemplate,
  getJavaScriptTemplatesByCategory,
  getJavaScriptCategories,
  generateJavaScriptCode,
  type JavaScriptTemplate,
} from './javascript-templates.js';

import {
  PYTHON_TEMPLATES,
  getPythonTemplate,
  getPythonTemplatesByCategory,
  getPythonCategories,
  generatePythonCode,
  type PythonTemplate,
} from './python-templates.js';

export type CodeTemplate = JavaScriptTemplate | PythonTemplate;

export interface TemplateCollection {
  javascript: JavaScriptTemplate[];
  python: PythonTemplate[];
}

/**
 * All available templates organized by language
 */
export const ALL_TEMPLATES: TemplateCollection = {
  javascript: JAVASCRIPT_TEMPLATES,
  python: PYTHON_TEMPLATES,
};

/**
 * Get template by name and language
 */
export function getTemplate(
  language: 'javascript' | 'python',
  name: string
): CodeTemplate | undefined {
  switch (language) {
    case 'javascript':
      return getJavaScriptTemplate(name);
    case 'python':
      return getPythonTemplate(name);
    default:
      return undefined;
  }
}

/**
 * Get templates by language and category
 */
export function getTemplatesByCategory(
  language: 'javascript' | 'python',
  category: string
): CodeTemplate[] {
  switch (language) {
    case 'javascript':
      return getJavaScriptTemplatesByCategory(category);
    case 'python':
      return getPythonTemplatesByCategory(category);
    default:
      return [];
  }
}

/**
 * Get all available categories for a language
 */
export function getCategories(language: 'javascript' | 'python'): string[] {
  switch (language) {
    case 'javascript':
      return getJavaScriptCategories();
    case 'python':
      return getPythonCategories();
    default:
      return [];
  }
}

/**
 * Generate runnable code from template
 */
export function generateCode(
  language: 'javascript' | 'python',
  templateName: string,
  inputs?: Record<string, any>
): string {
  switch (language) {
    case 'javascript':
      return generateJavaScriptCode(templateName, inputs);
    case 'python':
      return generatePythonCode(templateName, inputs);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}

/**
 * List all templates with metadata
 */
export function listAllTemplates(): {
  language: string;
  name: string;
  description: string;
  category: string;
}[] {
  const result: {
    language: string;
    name: string;
    description: string;
    category: string;
  }[] = [];

  // Add JavaScript templates
  for (const template of JAVASCRIPT_TEMPLATES) {
    result.push({
      language: 'javascript',
      name: template.name,
      description: template.description,
      category: template.category,
    });
  }

  // Add Python templates
  for (const template of PYTHON_TEMPLATES) {
    result.push({
      language: 'python',
      name: template.name,
      description: template.description,
      category: template.category,
    });
  }

  return result;
}

/**
 * Get template suggestions based on keywords
 */
export function suggestTemplates(keywords: string[]): {
  language: string;
  name: string;
  description: string;
  category: string;
  relevanceScore: number;
}[] {
  const allTemplates = listAllTemplates();
  const suggestions = [];

  for (const template of allTemplates) {
    let score = 0;
    const searchText =
      `${template.name} ${template.description} ${template.category}`.toLowerCase();

    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    if (score > 0) {
      suggestions.push({
        ...template,
        relevanceScore: score,
      });
    }
  }

  return suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
