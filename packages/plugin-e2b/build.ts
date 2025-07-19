import { buildConfig } from './build.config';

console.log('Starting build with config:', buildConfig);

const result = await Bun.build(buildConfig);

if (result.success) {
  console.log('Build completed successfully for @elizaos/plugin-e2b');
  console.log(
    'Output files:',
    result.outputs.map((o) => o.path)
  );
} else {
  console.error('Build failed with errors:');
  result.logs.forEach((log) => console.error(log));
  process.exit(1);
}
