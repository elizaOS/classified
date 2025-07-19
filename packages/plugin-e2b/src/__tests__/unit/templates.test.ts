import { describe, it, expect, beforeEach } from 'bun:test';
import {
  JAVASCRIPT_TEMPLATES,
  PYTHON_TEMPLATES,
  getJavaScriptTemplate,
  getPythonTemplate,
  getJavaScriptTemplatesByCategory,
  getPythonTemplatesByCategory,
  getJavaScriptCategories,
  getPythonCategories,
  generateJavaScriptCode,
  generatePythonCode,
  getTemplate,
  generateCode,
  listAllTemplates,
  suggestTemplates,
  getCategories,
  getTemplatesByCategory,
} from '../../templates/index.js';

describe('JavaScript Templates', () => {
  it('should have valid template structure', () => {
    for (const template of JAVASCRIPT_TEMPLATES) {
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('code');
      expect(template).toHaveProperty('category');
      expect(typeof template.name).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(typeof template.code).toBe('string');
      expect(typeof template.category).toBe('string');
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
      expect(template.code.length).toBeGreaterThan(0);
    }
  });

  it('should retrieve templates by name', () => {
    const helloWorld = getJavaScriptTemplate('hello-world');
    expect(helloWorld).toBeDefined();
    expect(helloWorld?.name).toBe('hello-world');
    expect(helloWorld?.code).toContain('Hello, World!');

    const nonExistent = getJavaScriptTemplate('non-existent');
    expect(nonExistent).toBeUndefined();
  });

  it('should retrieve templates by category', () => {
    const basicTemplates = getJavaScriptTemplatesByCategory('basic');
    expect(basicTemplates.length).toBeGreaterThan(0);
    expect(basicTemplates.every((t) => t.category === 'basic')).toBe(true);

    const algorithmTemplates = getJavaScriptTemplatesByCategory('algorithms');
    expect(algorithmTemplates.length).toBeGreaterThan(0);
    expect(algorithmTemplates.every((t) => t.category === 'algorithms')).toBe(true);
  });

  it('should list all categories', () => {
    const categories = getJavaScriptCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories).toContain('basic');
    expect(categories).toContain('algorithms');
    expect(categories).toContain('data-processing');
  });

  it('should generate code from templates', () => {
    const code = generateJavaScriptCode('hello-world');
    expect(code).toContain('Hello, World!');
    expect(code).toContain('console.log');

    expect(() => generateJavaScriptCode('non-existent')).toThrow();
  });

  it('should handle template inputs', () => {
    // Test with a template that has inputs (if any)
    const template = JAVASCRIPT_TEMPLATES.find((t) => t.inputs && t.inputs.length > 0);
    if (template) {
      const inputs: Record<string, any> = {};
      for (const input of template.inputs!) {
        inputs[input.name] = 'test-value';
      }
      const code = generateJavaScriptCode(template.name, inputs);
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
    }
  });
});

describe('Python Templates', () => {
  it('should have valid template structure', () => {
    for (const template of PYTHON_TEMPLATES) {
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('code');
      expect(template).toHaveProperty('category');
      expect(typeof template.name).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(typeof template.code).toBe('string');
      expect(typeof template.category).toBe('string');
      expect(template.name.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
      expect(template.code.length).toBeGreaterThan(0);
    }
  });

  it('should retrieve templates by name', () => {
    const helloWorld = getPythonTemplate('hello-world');
    expect(helloWorld).toBeDefined();
    expect(helloWorld?.name).toBe('hello-world');
    expect(helloWorld?.code).toContain('Hello, World!');

    const nonExistent = getPythonTemplate('non-existent');
    expect(nonExistent).toBeUndefined();
  });

  it('should retrieve templates by category', () => {
    const basicTemplates = getPythonTemplatesByCategory('basic');
    expect(basicTemplates.length).toBeGreaterThan(0);
    expect(basicTemplates.every((t) => t.category === 'basic')).toBe(true);

    const dataScienceTemplates = getPythonTemplatesByCategory('data-science');
    expect(dataScienceTemplates.length).toBeGreaterThan(0);
    expect(dataScienceTemplates.every((t) => t.category === 'data-science')).toBe(true);
  });

  it('should list all categories', () => {
    const categories = getPythonCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories).toContain('basic');
    expect(categories).toContain('data-science');
    expect(categories).toContain('algorithms');
  });

  it('should generate code from templates', () => {
    const code = generatePythonCode('hello-world');
    expect(code).toContain('Hello, World!');
    expect(code).toContain('print');

    expect(() => generatePythonCode('non-existent')).toThrow();
  });

  it('should handle template requirements', () => {
    const templatesWithRequirements = PYTHON_TEMPLATES.filter(
      (t) => t.requirements && t.requirements.length > 0
    );
    expect(templatesWithRequirements.length).toBeGreaterThan(0);

    for (const template of templatesWithRequirements) {
      expect(Array.isArray(template.requirements)).toBe(true);
      expect(template.requirements!.length).toBeGreaterThan(0);
    }
  });

  it('should handle template inputs', () => {
    // Test with a template that has inputs (if any)
    const template = PYTHON_TEMPLATES.find((t) => t.inputs && t.inputs.length > 0);
    if (template) {
      const inputs: Record<string, any> = {};
      for (const input of template.inputs!) {
        inputs[input.name] = 'test-value';
      }
      const code = generatePythonCode(template.name, inputs);
      expect(code).toBeDefined();
      expect(typeof code).toBe('string');
    }
  });
});

describe('Unified Template Interface', () => {
  it('should get templates by language and name', () => {
    const jsTemplate = getTemplate('javascript', 'hello-world');
    expect(jsTemplate).toBeDefined();
    expect(jsTemplate?.code).toContain('console.log');

    const pyTemplate = getTemplate('python', 'hello-world');
    expect(pyTemplate).toBeDefined();
    expect(pyTemplate?.code).toContain('print');

    const invalid = getTemplate('invalid' as any, 'hello-world');
    expect(invalid).toBeUndefined();
  });

  it('should generate code by language', () => {
    const jsCode = generateCode('javascript', 'hello-world');
    expect(jsCode).toContain('console.log');
    expect(jsCode).toContain('Hello, World!');

    const pyCode = generateCode('python', 'hello-world');
    expect(pyCode).toContain('print');
    expect(pyCode).toContain('Hello, World!');

    expect(() => generateCode('invalid' as any, 'hello-world')).toThrow();
  });

  it('should list all templates', () => {
    const allTemplates = listAllTemplates();
    expect(allTemplates.length).toBeGreaterThan(0);

    const jsTemplates = allTemplates.filter((t) => t.language === 'javascript');
    const pyTemplates = allTemplates.filter((t) => t.language === 'python');

    expect(jsTemplates.length).toBe(JAVASCRIPT_TEMPLATES.length);
    expect(pyTemplates.length).toBe(PYTHON_TEMPLATES.length);

    // Check structure
    for (const template of allTemplates) {
      expect(template).toHaveProperty('language');
      expect(template).toHaveProperty('name');
      expect(template).toHaveProperty('description');
      expect(template).toHaveProperty('category');
      expect(['javascript', 'python']).toContain(template.language);
    }
  });

  it('should get categories by language', () => {
    const jsCategories = getCategories('javascript');
    const pyCategories = getCategories('python');
    const invalidCategories = getCategories('invalid' as any);

    expect(jsCategories.length).toBeGreaterThan(0);
    expect(pyCategories.length).toBeGreaterThan(0);
    expect(invalidCategories.length).toBe(0);

    expect(jsCategories).toContain('basic');
    expect(pyCategories).toContain('basic');
  });

  it('should get templates by language and category', () => {
    const jsBasic = getTemplatesByCategory('javascript', 'basic');
    const pyBasic = getTemplatesByCategory('python', 'basic');
    const invalidLang = getTemplatesByCategory('invalid' as any, 'basic');

    expect(jsBasic.length).toBeGreaterThan(0);
    expect(pyBasic.length).toBeGreaterThan(0);
    expect(invalidLang.length).toBe(0);

    expect(jsBasic.every((t) => t.category === 'basic')).toBe(true);
    expect(pyBasic.every((t) => t.category === 'basic')).toBe(true);
  });

  it('should suggest relevant templates', () => {
    const sortingSuggestions = suggestTemplates(['sorting', 'algorithm']);
    expect(sortingSuggestions.length).toBeGreaterThan(0);
    expect(sortingSuggestions.every((s) => s.relevanceScore > 0)).toBe(true);
    expect(sortingSuggestions[0].relevanceScore).toBeGreaterThanOrEqual(
      sortingSuggestions[sortingSuggestions.length - 1].relevanceScore
    );

    const dataSuggestions = suggestTemplates(['data', 'statistics']);
    expect(dataSuggestions.length).toBeGreaterThan(0);

    const noSuggestions = suggestTemplates(['xyz123nonexistent']);
    expect(noSuggestions.length).toBe(0);
  });

  it('should handle empty keyword suggestions', () => {
    const emptySuggestions = suggestTemplates([]);
    expect(emptySuggestions.length).toBe(0);
  });
});

describe('Template Content Validation', () => {
  it('should have unique template names within each language', () => {
    const jsNames = JAVASCRIPT_TEMPLATES.map((t) => t.name);
    const pyNames = PYTHON_TEMPLATES.map((t) => t.name);

    const uniqueJsNames = new Set(jsNames);
    const uniquePyNames = new Set(pyNames);

    expect(uniqueJsNames.size).toBe(jsNames.length);
    expect(uniquePyNames.size).toBe(pyNames.length);
  });

  it('should have valid category names', () => {
    const allTemplates = [...JAVASCRIPT_TEMPLATES, ...PYTHON_TEMPLATES];

    for (const template of allTemplates) {
      expect(template.category).toMatch(/^[a-z0-9-]+$/);
      expect(template.category.length).toBeGreaterThan(0);
    }
  });

  it('should have runnable code samples', () => {
    // Test that basic templates contain expected language constructs
    const jsHelloWorld = getJavaScriptTemplate('hello-world');
    expect(jsHelloWorld?.code).toMatch(/console\.log/);

    const pyHelloWorld = getPythonTemplate('hello-world');
    expect(pyHelloWorld?.code).toMatch(/print/);
  });

  it('should have proper code formatting', () => {
    const allTemplates = [...JAVASCRIPT_TEMPLATES, ...PYTHON_TEMPLATES];

    for (const template of allTemplates) {
      // Code should not have leading/trailing whitespace
      expect(template.code).toBe(template.code.trim());

      // Code should contain actual content
      expect(template.code.length).toBeGreaterThan(10);
    }
  });
});

describe('Template Error Handling', () => {
  it('should handle invalid template names gracefully', () => {
    expect(() => generateJavaScriptCode('')).toThrow();
    expect(() => generatePythonCode('')).toThrow();
    expect(() => generateCode('javascript', '')).toThrow();
    expect(() => generateCode('python', '')).toThrow();
  });

  it('should handle invalid languages gracefully', () => {
    expect(() => generateCode('invalid' as any, 'hello-world')).toThrow();
  });

  it('should handle malformed inputs gracefully', () => {
    // These should not throw errors, just return reasonable defaults
    expect(getTemplatesByCategory('javascript', 'nonexistent')).toEqual([]);
    expect(getTemplatesByCategory('python', 'nonexistent')).toEqual([]);
    expect(suggestTemplates([])).toEqual([]);
  });
});
