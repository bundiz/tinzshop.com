// Runs one of the app's job endpoints against a running dev server and prints its JSON answer.
//
//   node --env-file=.env scripts/run-job.mjs <job> [--full]
//
// Reads JOB_SECRET and APP_URL from the environment (never prints them). APP_URL defaults to
// http://localhost:3000. Exits non-zero when the job does not answer 2xx, so `npm run data:load`
// stops at the first failure.

const JOBS = {
  'shopee-sync': '/api/jobs/shopee-sync',
  'catalogue-activate': '/api/jobs/catalogue-activate',
  'catalogue-categorise': '/api/jobs/catalogue-categorise',
  'news-import': '/api/jobs/news-import',
};

const [job, flag] = process.argv.slice(2);
const path = JOBS[job];
if (path === undefined) {
  console.error(`Unknown job "${job ?? ''}". Use one of: ${Object.keys(JOBS).join(', ')}`);
  process.exit(2);
}
if (flag !== undefined && !(flag === '--full' && job === 'news-import')) {
  console.error('Only news-import takes a flag: --full (re-save every post).');
  process.exit(2);
}

const secret = process.env.JOB_SECRET;
if (!secret) {
  console.error('JOB_SECRET is not set. Add it to .env (see docs/16-local-setup.md, step 3).');
  process.exit(2);
}

const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const url = `${base}${path}${flag === '--full' ? '?full=1' : ''}`;

console.log(`→ POST ${url}`);
let response;
try {
  response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });
} catch {
  console.error(`Could not reach ${base}. Is the dev server running (npm run dev)?`);
  process.exit(1);
}

const text = await response.text();
console.log(`← ${response.status}`);
console.log(text);
if (!response.ok) process.exit(1);
