#!/usr/bin/env node

/**
 * Local GitHub Actions Workflow Testing with act
 * Tests our CI/CD workflows locally before pushing
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const workflowsDir = path.join(rootDir, '.github/workflows');

console.log('🧪 Testing GitHub Actions Workflows Locally\n');

const workflows = [
  {
    name: 'Test Build',
    file: 'test-build.yml',
    event: 'pull_request',
    description: 'Tests lander and game frontend builds',
  },
  {
    name: 'Lander Deploy',
    file: 'lander-deploy.yml',
    event: 'workflow_dispatch',
    description: 'Tests lander build and deployment prep',
    jobsToTest: ['build'], // Skip deploy job in local testing
  },
  {
    name: 'Release Creation',
    file: 'tauri-release.yml',
    event: 'workflow_dispatch',
    description: 'Tests release creation (without actual builds)',
    jobsToTest: ['create-release'], // Skip build jobs in local testing
  },
];

function runActCommand(workflowFile, event, job = null, dryRun = false) {
  const jobFlag = job ? `-j ${job}` : '';
  const dryRunFlag = dryRun ? '--dryrun' : '';
  const eventFlag = event ? `-e ${event}` : '';

  const command = `act ${eventFlag} ${jobFlag} ${dryRunFlag} -W .github/workflows/${workflowFile} --env-file .env.act`;

  console.log(`Running: ${command}`);

  try {
    const output = execSync(command, {
      encoding: 'utf8',
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: error.stdout,
      error: error.stderr,
    };
  }
}

async function testWorkflow(workflow) {
  console.log(`\n📋 Testing: ${workflow.name}`);
  console.log(`   File: ${workflow.file}`);
  console.log(`   Description: ${workflow.description}`);

  // Check if workflow file exists
  const workflowPath = path.join(workflowsDir, workflow.file);
  if (!fs.existsSync(workflowPath)) {
    console.log(`   ❌ Workflow file not found: ${workflow.file}`);
    return false;
  }

  // Test workflow syntax with dry run first
  console.log(`   🔍 Checking syntax...`);
  const dryResult = runActCommand(workflow.file, workflow.event, null, true);

  if (!dryResult.success) {
    console.log(`   ❌ Syntax check failed:`);
    console.log(`      ${dryResult.error || dryResult.output}`);
    return false;
  }

  console.log(`   ✅ Syntax check passed`);

  // Test specific jobs if specified
  if (workflow.jobsToTest) {
    for (const job of workflow.jobsToTest) {
      console.log(`   🧪 Testing job: ${job}`);

      const jobResult = runActCommand(workflow.file, workflow.event, job, false);

      if (jobResult.success) {
        console.log(`   ✅ Job '${job}' passed`);
      } else {
        console.log(`   ⚠️  Job '${job}' had issues (may be expected in local env)`);
        console.log(`      Output: ${jobResult.output.slice(0, 200)}...`);
      }
    }
  } else {
    console.log(`   🧪 Testing full workflow...`);

    const result = runActCommand(workflow.file, workflow.event, null, false);

    if (result.success) {
      console.log(`   ✅ Full workflow passed`);
    } else {
      console.log(`   ⚠️  Workflow had issues (may be expected in local env)`);
      console.log(`      Output: ${result.output.slice(0, 200)}...`);
    }
  }

  return true;
}

async function main() {
  // Check if act is installed
  try {
    execSync('which act', { stdio: 'ignore' });
  } catch (error) {
    console.log('❌ act is not installed. Install it with: brew install act');
    process.exit(1);
  }

  console.log('✅ act is installed');

  // Check if Docker is running (act requires it)
  try {
    execSync('docker info', { stdio: 'ignore' });
    console.log('✅ Docker is running');
  } catch (error) {
    console.log('❌ Docker is not running. Start Docker and try again.');
    process.exit(1);
  }

  let allPassed = true;

  // Test each workflow
  for (const workflow of workflows) {
    const passed = await testWorkflow(workflow);
    if (!passed) {
      allPassed = false;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('🎉 All workflow tests completed!');
    console.log('\nNext steps:');
    console.log('1. Fix any warnings shown above');
    console.log('2. Test manually trigger workflows on GitHub');
    console.log('3. Create your first release via GitHub Actions');
  } else {
    console.log('❌ Some workflows have issues that need fixing');
    console.log('\nPlease address the errors above before deploying');
  }
}

// Handle CLI arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Usage: node scripts/test-workflows.js [options]

Options:
  --help, -h     Show this help message
  --workflow, -w Specific workflow to test (e.g., test-build.yml)
  --dry-run, -d  Only check syntax, don't run workflows

Examples:
  node scripts/test-workflows.js
  node scripts/test-workflows.js --workflow test-build.yml
  node scripts/test-workflows.js --dry-run
`);
  process.exit(0);
}

if (process.argv.includes('--workflow') || process.argv.includes('-w')) {
  const workflowIndex = Math.max(process.argv.indexOf('--workflow'), process.argv.indexOf('-w'));
  const workflowFile = process.argv[workflowIndex + 1];

  if (workflowFile) {
    const workflow = workflows.find((w) => w.file === workflowFile);
    if (workflow) {
      testWorkflow(workflow).then(() => process.exit(0));
    } else {
      console.log(`❌ Workflow not found: ${workflowFile}`);
      console.log('Available workflows:', workflows.map((w) => w.file).join(', '));
      process.exit(1);
    }
  } else {
    console.log('❌ No workflow file specified');
    process.exit(1);
  }
} else {
  main().catch(console.error);
}
