import { execFileSync } from 'node:child_process';

const git = (...args) =>
  execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const stopDeploy = (message) => {
  console.error(`\nDeployment canceled: ${message}\n`);
  process.exit(1);
};

const isGitRepository = () => {
  try {
    return git('rev-parse', '--is-inside-work-tree') === 'true';
  } catch {
    return false;
  }
};

const checkDeploy = () => {
  if (!isGitRepository()) {
    console.warn(
      'Deploy check skipped: no Git repository was found. Build ID will use the package version.'
    );
    return;
  }

  const changes = git('status', '--porcelain');
  if (changes) {
    stopDeploy(
      'there are uncommitted changes. Commit them before deploying so the Build ID matches the deployed source.'
    );
  }

  console.log('Deploy check passed: clean Git checkout detected.');
};

try {
  checkDeploy();
} catch (error) {
  if (error instanceof Error) {
    stopDeploy(`the Git check failed. ${error.message}`);
  }

  stopDeploy('the Git check failed.');
}
