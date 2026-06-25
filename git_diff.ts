import { execSync } from 'child_process';
try {
  const output = execSync('git diff src/App.tsx', { encoding: 'utf8' });
  console.log('GIT DIFF OUTPUT:\n', output);
} catch (error: any) {
  console.error('Error running git diff:', error.message);
  if (error.stdout) console.log('STDOUT:', error.stdout.toString());
  if (error.stderr) console.error('STDERR:', error.stderr.toString());
}
