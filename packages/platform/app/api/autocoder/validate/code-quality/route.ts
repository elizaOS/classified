import { NextRequest, NextResponse } from 'next/server';
import { wrapHandlers } from '@/lib/api/route-wrapper';
import { authService } from '@/lib/auth/session';
import { getSql } from '@/lib/database';
import { LLMTestRunner } from '@/lib/testing/llm-test-runner';

interface CodeQualityRequest {
  projectId: string;
  artifacts: any[];
  expectedFeatures: string[];
  useRealLLM?: boolean;
  validationLevel?: 'basic' | 'comprehensive' | 'advanced';
}

async function handlePOST(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: CodeQualityRequest = await request.json();
    const {
      projectId,
      artifacts,
      expectedFeatures,
      useRealLLM = false,
      validationLevel = 'comprehensive',
    } = body;

    if (!projectId || !artifacts || !expectedFeatures) {
      return NextResponse.json(
        {
          error:
            'Missing required fields: projectId, artifacts, expectedFeatures',
        },
        { status: 400 },
      );
    }

    const sql = getSql();

    // Get project details
    const projects = await sql.query(
      'SELECT * FROM autocoder_projects WHERE id = $1 AND user_id = $2',
      [projectId, user.id],
    );

    if (projects.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const project = projects[0];

    // Initialize LLM test runner
    const llmRunner = new LLMTestRunner({
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 4000,
      useRealLLM: useRealLLM && !!process.env.OPENAI_API_KEY,
    });

    // Analyze code quality
    const codeAnalysis = await llmRunner.analyzeCodeQuality(
      projectId,
      artifacts,
      project.description || '',
      expectedFeatures,
    );

    // Generate test scenarios based on validation level
    let testScenarios: any[] = [];
    if (validationLevel === 'comprehensive' || validationLevel === 'advanced') {
      testScenarios = await llmRunner.generateTestScenarios(
        project.description || '',
        project.type || 'general',
        project.complexity || 'moderate',
        expectedFeatures,
      );
    }

    // Validate requirements
    let requirementsValidation = null;
    if (validationLevel === 'advanced') {
      requirementsValidation = await llmRunner.validateRequirements(
        project.description || '',
        artifacts,
        [], // TODO: Get conversation history from database
      );
    }

    // Generate improvement suggestions
    const improvements = await llmRunner.generateImprovements(
      artifacts,
      codeAnalysis,
      project.type || 'general',
    );

    // Store validation results in database
    await sql.query(
      `
      INSERT INTO autocoder_validations (
        id, project_id, user_id, validation_type, results, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [
        `validation-${Date.now()}`,
        projectId,
        user.id,
        'code_quality',
        JSON.stringify({
          codeAnalysis,
          testScenarios,
          requirementsValidation,
          improvements,
          validationLevel,
          timestamp: new Date().toISOString(),
        }),
      ],
    );

    // Calculate overall validation score
    const overallScore = calculateValidationScore(
      codeAnalysis,
      requirementsValidation,
    );

    return NextResponse.json({
      success: true,
      data: {
        projectId,
        validationLevel,
        overallScore,
        codeQuality: codeAnalysis.codeQuality,
        featureCoverage: codeAnalysis.featureCoverage,
        testCoverage: codeAnalysis.testCoverage,
        documentation: codeAnalysis.documentation,
        securityScore: codeAnalysis.securityScore,
        performanceScore: codeAnalysis.performanceScore,
        maintainabilityScore: codeAnalysis.maintainabilityScore,
        issues: codeAnalysis.issues,
        suggestions: codeAnalysis.suggestions,
        testScenarios,
        requirementsValidation,
        improvements,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Code quality validation failed:', error);
    return NextResponse.json({ error: 'Validation failed' }, { status: 500 });
  }
}

async function handleGET(request: NextRequest) {
  const user = await authService.getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
  }

  try {
    const sql = getSql();

    // Get latest validation results
    const validations = await sql.query(
      `
      SELECT * FROM autocoder_validations 
      WHERE project_id = $1 AND user_id = $2 
      ORDER BY created_at DESC 
      LIMIT 1
      `,
      [projectId, user.id],
    );

    if (validations.length === 0) {
      return NextResponse.json(
        { error: 'No validation results found' },
        { status: 404 },
      );
    }

    const validation = validations[0];
    const results = JSON.parse(validation.results);

    return NextResponse.json({
      success: true,
      data: {
        validationId: validation.id,
        projectId: validation.project_id,
        validationType: validation.validation_type,
        createdAt: validation.created_at,
        ...results,
      },
    });
  } catch (error) {
    console.error('Failed to get validation results:', error);
    return NextResponse.json(
      { error: 'Failed to get validation results' },
      { status: 500 },
    );
  }
}

function calculateValidationScore(
  codeAnalysis: any,
  requirementsValidation: any,
): number {
  let score = codeAnalysis.overallScore || 0;

  if (requirementsValidation) {
    // Boost score if requirements are well met
    const requirementsBonus = requirementsValidation.score * 0.2;
    score = Math.min(100, score + requirementsBonus);
  }

  return Math.round(score);
}

export const { GET, POST } = wrapHandlers({
  handleGET,
  handlePOST,
});
