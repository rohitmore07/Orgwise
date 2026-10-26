// Local smoke test for the Lambda bundle: boots the NestJS app with the given
// env vars and issues a mock GET /api/v1/health request.
//
// Usage: node scripts/boot-test-lambda.cjs <path-to-unzipped-package> <env-json-path>
//
// It exits non-zero if the bundle fails to load, Nest fails to boot, or the
// request returns an HTTP 5xx — so a broken zip can never pass CI. The env
// JSON may contain dummy-but-Joi-valid values (e.g. an unreachable
// DATABASE_URL): the app still boots and the health check degrades gracefully.
const fs = require('fs');
const path = require('path');

const pkgDir = path.resolve(process.argv[2]);
const envPath = path.resolve(process.argv[3]);
const env = JSON.parse(fs.readFileSync(envPath, 'utf8'));
Object.assign(process.env, env);
process.env.NODE_ENV = 'production';

const { handler } = require(path.join(pkgDir, 'dist', 'lambda.js'));
const event = {
  version: '2.0',
  routeKey: 'GET /api/v1/health',
  rawPath: '/api/v1/health',
  rawQueryString: '',
  headers: { host: 'localhost' },
  requestContext: {
    http: { method: 'GET', path: '/api/v1/health', protocol: 'HTTP/1.1' },
    requestId: 'test-1',
  },
  isBase64Encoded: false,
};
const timeout = setTimeout(() => {
  console.error('BOOT TIMEOUT after 90s');
  process.exit(2);
}, 90000);
handler(event, {})
  .then((res) => {
    clearTimeout(timeout);
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', res.body);
    process.exit(res.statusCode >= 500 ? 1 : 0);
  })
  .catch((err) => {
    clearTimeout(timeout);
    console.error('HANDLER ERROR:', err.message);
    process.exit(1);
  });
