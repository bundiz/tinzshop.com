// Runs one of the app's job endpoints against a running dev server and prints its JSON answer.
//
//   node --env-file=.env scripts/run-job.mjs <job> [--full]
//   node --env-file=.env scripts/run-job.mjs account-role <email> <role>
//
// Reads JOB_SECRET and APP_URL from the environment (never prints them). APP_URL defaults to
// http://localhost:3003. Exits non-zero when the job does not answer 2xx, so `npm run data:load`
// stops at the first failure.

const JOBS = {
  'shopee-sync': '/api/jobs/shopee-sync',
  'catalogue-activate': '/api/jobs/catalogue-activate',
  'catalogue-categorise': '/api/jobs/catalogue-categorise',
  'news-import': '/api/jobs/news-import',
  'account-role': '/api/jobs/account-role',
};

const [job, flag, roleArg, ...extra] = process.argv.slice(2);
const path = JOBS[job];
if (path === undefined) {
  console.error(`Unknown job "${job ?? ''}". Use one of: ${Object.keys(JOBS).join(', ')}`);
  process.exit(2);
}
if (job === 'account-role') {
  if (flag === undefined || roleArg === undefined || extra.length > 0) {
    console.error('Usage: npm run account:set-role -- <email> <role>');
    process.exit(2);
  }
} else if (flag !== undefined && !(flag === '--full' && job === 'news-import')) {
  console.error('Only news-import takes a flag: --full (re-save every post).');
  process.exit(2);
}

const secret = process.env.JOB_SECRET;
if (!secret) {
  console.error('JOB_SECRET is not set. Add it to .env (see docs/16-local-setup.md, step 3).');
  process.exit(2);
}

const base = (process.env.APP_URL || 'http://localhost:3003').replace(/\/+$/, '');
const url = `${base}${path}${flag === '--full' ? '?full=1' : ''}`;

// account-role sends its two arguments as the JSON body; the email is masked on screen.
const isRole = job === 'account-role';
const maskEmail = (email) => {
  const at = email.lastIndexOf('@');
  return at < 1 ? '…' : `${email.slice(0, 3)}…${email.slice(at)}`;
};
console.log(`→ POST ${url}${isRole ? ` (${maskEmail(flag)} → ${roleArg})` : ''}`);
let response;
try {
  response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(isRole ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(isRole ? { body: JSON.stringify({ email: flag, role: roleArg }) } : {}),
  });
} catch {
  console.error(`Could not reach ${base}. Is the dev server running (npm run dev)?`);
  process.exit(1);
}

const text = await response.text();
console.log(`← ${response.status}`);
console.log(text);
if (!response.ok) process.exit(1);
