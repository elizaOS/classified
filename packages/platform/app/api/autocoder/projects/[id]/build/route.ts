import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from '@/lib/auth/config'
import { authOptions } from '@/lib/auth/config'
import { getSql } from '@/lib/database'
import { AutocoderAgentService } from '@/lib/autocoder/agent-service'
import { BuildQueueManager } from '@/lib/autocoder/build-queue-manager'
import { randomUUID } from 'crypto'

interface StartBuildRequest {
  specification: {
    name: string
    description: string
    type: string
    dependencies: string[]
    features: string[]
    testCases: string[]
    securityRequirements: string[]
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const projectId = id
    const body: StartBuildRequest = await request.json()

    // Verify project ownership and current status
    const adapter = getSql();
    const sql = adapter.getSqlClient();
    const project = await sql`
      SELECT * FROM autocoder_projects 
      WHERE id = ${projectId} AND user_id = ${session.user.id}
    `

    if (project.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const currentProject = project[0]

    // Check if project is already building
    if (currentProject.status === 'building' || currentProject.status === 'testing') {
      return NextResponse.json({ 
        error: 'Project is already being built' 
      }, { status: 409 })
    }

    // Validate specification
    if (!body.specification.name || !body.specification.description) {
      return NextResponse.json({ 
        error: 'Specification must include name and description' 
      }, { status: 400 })
    }

    // Update project with specification and status
    await sql`
      UPDATE autocoder_projects 
      SET specification = ${JSON.stringify(body.specification)}, status = 'building', updated_at = NOW()
      WHERE id = ${projectId}
    `

    // Create build record
    const buildId = randomUUID()
    await sql`
      INSERT INTO autocoder_builds (
        id, project_id, user_id, specification, status, started_at, created_at
      ) VALUES (${buildId}, ${projectId}, ${session.user.id}, ${JSON.stringify(body.specification)}, 'queued', NOW(), NOW())
    `

    // Initialize agent service for this build
    const agentService = new AutocoderAgentService()
    
    // Add build to queue
    const buildQueue = BuildQueueManager.getInstance()
    await buildQueue.addBuild({
      id: buildId,
      projectId,
      userId: session.user.id,
      specification: body.specification,
      priority: 'normal'
    })

    // Log build start
    await logBuildEvent(projectId, buildId, 'info', 'Build started - analyzing specification and planning implementation')

    // Start the build process asynchronously
    processAutocodeGeneration(projectId, buildId, body.specification, session.user.id)
      .catch(error => {
        console.error('Build process failed:', error)
        logBuildEvent(projectId, buildId, 'error', `Build failed: ${error.message}`)
      })

    // Return updated project
    const updatedProject = {
      id: currentProject.id,
      name: currentProject.name,
      description: currentProject.description,
      type: currentProject.type,
      status: 'building',
      specification: body.specification,
      result: null,
      createdAt: currentProject.created_at,
      updatedAt: new Date()
    }

    return NextResponse.json(updatedProject)
  } catch (error) {
    console.error('Failed to start build:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function processAutocodeGeneration(
  projectId: string, 
  buildId: string, 
  specification: any, 
  userId: string
) {
  try {
    const agentService = new AutocoderAgentService()
    
    // Phase 1: Research and Analysis
    await logBuildEvent(projectId, buildId, 'info', 'Phase 1: Researching existing solutions and best practices...')
    
    const researchResults = await agentService.performResearch({
      projectType: specification.type,
      features: specification.features,
      dependencies: specification.dependencies
    })

    await logBuildEvent(projectId, buildId, 'info', `Research complete: Found ${researchResults.references.length} relevant references`)

    // Phase 2: Detailed Planning
    await logBuildEvent(projectId, buildId, 'info', 'Phase 2: Creating detailed implementation plan...')
    
    const implementationPlan = await agentService.createImplementationPlan({
      specification,
      researchResults
    })

    await logBuildEvent(projectId, buildId, 'info', `Implementation plan created with ${implementationPlan.steps.length} steps`)

    // Phase 3: Code Generation
    await logBuildEvent(projectId, buildId, 'info', 'Phase 3: Generating code and project structure...')
    
    const codeGeneration = await agentService.generateCode({
      specification,
      plan: implementationPlan,
      researchContext: researchResults
    })

    await logBuildEvent(projectId, buildId, 'info', `Code generation complete: ${Object.keys(codeGeneration.files).length} files generated`)

    // Phase 4: Test Generation
    await logBuildEvent(projectId, buildId, 'info', 'Phase 4: Generating comprehensive test suite...')
    
    const testSuite = await agentService.generateTests({
      specification,
      code: codeGeneration,
      testCases: specification.testCases
    })

    await logBuildEvent(projectId, buildId, 'info', `Test suite generated: ${testSuite.tests.length} tests created`)

    // Phase 5: Quality Analysis
    await logBuildEvent(projectId, buildId, 'info', 'Phase 5: Analyzing code quality and security...')
    
    const qualityAnalysis = await agentService.analyzeQuality({
      code: codeGeneration,
      tests: testSuite,
      securityRequirements: specification.securityRequirements
    })

    // Update project status to testing
    const testingSqlAdapter = getSql();
    const testingSql = testingSqlAdapter.getSqlClient();
    await testingSql`
      UPDATE autocoder_projects 
      SET status = 'testing', updated_at = NOW()
      WHERE id = ${projectId}
    `

    await logBuildEvent(projectId, buildId, 'info', 'Phase 6: Running tests and validation...')

    // Phase 6: Test Execution in E2B Container
    let testResults
    try {
      // Try to execute tests in E2B container for real validation
      const { E2BContainerService } = await import('@/lib/autocoder/e2b-container-service')
      const containerService = E2BContainerService.getInstance()
      
      const containerSessionId = await containerService.createSession(projectId, userId)
      
      try {
        const containerResult = await containerService.executeCodeBuild(containerSessionId, {
          projectId,
          userId,
          files: codeGeneration.files,
          packageJson: codeGeneration.packageJson,
          buildCommands: ['npm run build'],
          testCommands: ['npm test']
        })

        if (containerResult.success && containerResult.testResults) {
          testResults = {
            results: containerResult.testResults.details || [],
            summary: {
              total: containerResult.testResults.total,
              passed: containerResult.testResults.passed,
              failed: containerResult.testResults.failed,
              skipped: 0,
              coverage: containerResult.testResults.coverage
            }
          }
          
          await logBuildEvent(projectId, buildId, 'info', `Container tests completed: ${containerResult.testResults.passed}/${containerResult.testResults.total} passed`)
        } else {
          throw new Error('Container build failed')
        }

        // Clean up container session
        await containerService.terminateSession(containerSessionId)
        
      } catch (containerError) {
        const errorMessage = containerError instanceof Error ? containerError.message : 'Unknown error'
        await logBuildEvent(projectId, buildId, 'warn', `Container execution failed, using agent simulation: ${errorMessage}`)
        await containerService.terminateSession(containerSessionId).catch(() => {})
        
        // Fallback to agent-based test execution
        testResults = await agentService.runTests({
          code: codeGeneration,
          tests: testSuite
        })
      }
      
    } catch (importError) {
      await logBuildEvent(projectId, buildId, 'warn', 'E2B container not available, using agent simulation')
      
      // Fallback to agent-based test execution
      testResults = await agentService.runTests({
        code: codeGeneration,
        tests: testSuite
      })
    }

    // Create final build result
    const buildResult = {
      id: buildId,
      files: codeGeneration.files,
      packageJson: codeGeneration.packageJson,
      tests: testResults.results,
      quality: {
        codeQuality: qualityAnalysis.codeQuality,
        testCoverage: qualityAnalysis.testCoverage,
        security: qualityAnalysis.security,
        performance: qualityAnalysis.performance,
        documentation: qualityAnalysis.documentation
      },
      researchResults,
      implementationPlan
    }

    // Update project with final result
    const completionSqlAdapter = getSql();
    const completionSql = completionSqlAdapter.getSqlClient();
    await completionSql`
      UPDATE autocoder_projects 
      SET status = 'completed', build_result = ${JSON.stringify(buildResult)}, updated_at = NOW()
      WHERE id = ${projectId}
    `

    // Update build record
    await completionSql`
      UPDATE autocoder_builds 
      SET status = 'completed', result = ${JSON.stringify(buildResult)}, completed_at = NOW()
      WHERE id = ${buildId}
    `

    await logBuildEvent(projectId, buildId, 'info', '🎉 Build completed successfully! Your plugin is ready for preview and testing.')

    console.log(`Build ${buildId} completed successfully for project ${projectId}`)
    
  } catch (error) {
    console.error('Build process failed:', error)
    
    // Update project status to failed
    const errorSqlAdapter = getSql();
    const errorSql = errorSqlAdapter.getSqlClient();
    await errorSql`
      UPDATE autocoder_projects 
      SET status = 'failed', updated_at = NOW()
      WHERE id = ${projectId}
    `

    // Update build record
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await errorSql`
      UPDATE autocoder_builds 
      SET status = 'failed', error = ${errorMessage}, completed_at = NOW()
      WHERE id = ${buildId}
    `

    await logBuildEvent(projectId, buildId, 'error', `Build failed: ${errorMessage}`)
  }
}

async function logBuildEvent(
  projectId: string, 
  buildId: string, 
  level: 'info' | 'warn' | 'error' | 'debug', 
  message: string
) {
  try {
    const logId = randomUUID()
    
    const logSqlAdapter = getSql();
    const logSql = logSqlAdapter.getSqlClient();
    await logSql`
      INSERT INTO autocoder_build_logs (
        id, project_id, build_id, level, message, timestamp, source
      ) VALUES (${logId}, ${projectId}, ${buildId}, ${level}, ${message}, NOW(), 'autocoder-agent')
    `

    console.log(`[${level.toUpperCase()}] Build ${buildId}: ${message}`)
  } catch (error) {
    console.error('Failed to log build event:', error)
  }
}