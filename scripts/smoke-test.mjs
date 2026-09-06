import http from 'http';
import https from 'https';

const targetUrl = process.env.SMOKE_TARGET_URL || 'http://localhost:3000';
console.log(`[Smoke Test] Target URL: ${targetUrl}`);

async function fetchUrl(urlPath, { method = 'GET', headers = {}, body } = {}) {
  const fullUrl = new URL(urlPath, targetUrl);
  const client = fullUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      fullUrl.toString(),
      { method, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', (err) => reject(err));
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${fullUrl} after 25s`));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function runSmokeTests() {
  let failed = false;

  // 1. Health Probe (also validates Firebase runtime project-ID configuration)
  try {
    console.log('[Smoke Test] Testing GET /health ...');
    const res = await fetchUrl('/health');
    if (res.statusCode !== 200) {
      console.error(`❌ Health check failed with HTTP ${res.statusCode}`);
      failed = true;
    } else {
      const json = JSON.parse(res.data);
      if (json.status !== 'ok') {
        console.error(`❌ Health check returned invalid status: ${json.status}`);
        failed = true;
      } else {
        console.log(`✅ GET /health OK (Uptime: ${json.uptimeSeconds}s, Memory: ${json.memory.heapUsedMb}MB)`);
      }

      // Firebase project ID must be configured at runtime. This is the exact
      // regression that previously broke token verification on Cloud Run.
      const firebaseConfigured =
        json.services?.firebaseProjectIdConfigured ?? json.firebaseProjectIdConfigured;
      if (firebaseConfigured !== true) {
        console.error('❌ Health check failed: firebaseProjectIdConfigured is not true (runtime Firebase project ID missing — Firebase ID tokens will be rejected)');
        failed = true;
      } else {
        console.log('✅ firebaseProjectIdConfigured: true');
      }

      const geminiConfigured = json.services?.geminiKeyConfigured ?? json.geminiKeyConfigured;
      if (geminiConfigured !== true) {
        console.error('❌ Health check failed: geminiKeyConfigured is not true (Gemini key missing)');
        failed = true;
      } else {
        console.log('✅ geminiKeyConfigured: true');
      }

      // Firestore must resolve to the canonical named database. This guard
      // prevents releasing a server silently pointed back at "(default)".
      const firestoreConfigured =
        json.services?.firestoreDatabaseConfigured ?? json.firestoreDatabaseConfigured;
      if (firestoreConfigured !== true) {
        console.error('❌ Health check failed: firestoreDatabaseConfigured is not true (no Firestore database id resolved)');
        failed = true;
      } else {
        console.log('✅ firestoreDatabaseConfigured: true');
      }

      const firestoreNamed =
        json.services?.firestoreNamedDatabaseConfigured ?? json.firestoreNamedDatabaseConfigured;
      if (firestoreNamed !== true) {
        console.error('❌ Health check failed: firestoreNamedDatabaseConfigured is not true (server resolving to default database, not the named database)');
        failed = true;
      } else {
        console.log('✅ firestoreNamedDatabaseConfigured: true');
      }
    }
  } catch (err) {
    console.error(`❌ Health check exception: ${err.message}`);
    failed = true;
  }

  // 2. API Health Endpoint
  try {
    console.log('[Smoke Test] Testing GET /api/health ...');
    const res = await fetchUrl('/api/health');
    if (res.statusCode !== 200) {
      console.error(`❌ API Health check failed with HTTP ${res.statusCode}`);
      failed = true;
    } else {
      console.log('✅ GET /api/health OK');
    }
  } catch (err) {
    console.error(`❌ API Health check exception: ${err.message}`);
    failed = true;
  }

  // 3. Root SPA serving
  try {
    console.log('[Smoke Test] Testing GET / ...');
    const res = await fetchUrl('/');
    if (res.statusCode !== 200) {
      console.error(`❌ Root URL failed with HTTP ${res.statusCode}`);
      failed = true;
    } else if (!res.data.includes('<html') && !res.data.includes('JOURNAL')) {
      console.error('❌ Root URL did not return expected HTML document');
      failed = true;
    } else {
      console.log('✅ GET / SPA HTML served OK');
    }
  } catch (err) {
    console.error(`❌ Root URL exception: ${err.message}`);
    failed = true;
  }

  // 4. Authenticated Diagnostics — only runs when a token is supplied.
  // CI does NOT ship a long-lived token; a valid mechanism must exist before
  // this is promoted to a hard gate. Absent a token we report it as skipped.
  const smokeToken = process.env.SMOKE_FIREBASE_ID_TOKEN;
  if (smokeToken) {
    try {
      console.log('[Smoke Test] Testing GET /api/auth/verify with supplied token ...');
      const res = await fetchUrl('/api/auth/verify', {
        headers: { Authorization: `Bearer ${smokeToken}` },
      });
      if (res.statusCode !== 200) {
        console.error(`❌ Authenticated check failed with HTTP ${res.statusCode}`);
        failed = true;
      } else {
        const json = JSON.parse(res.data);
        if (json.authenticated !== true) {
          console.error('❌ Authenticated check returned unexpected payload');
          failed = true;
        } else {
          console.log('✅ GET /api/auth/verify authenticated OK');
        }
      }
    } catch (err) {
      console.error(`❌ Authenticated check exception: ${err.message}`);
      failed = true;
    }
  } else {
    console.log('\nℹ️ Authenticated smoke: NOT EXECUTED — token not supplied (set SMOKE_FIREBASE_ID_TOKEN to enable)');
  }

  if (failed) {
    console.error('\n❌ SMOKE TESTS FAILED!');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL SMOKE TESTS PASSED CLEANLY!');
    process.exit(0);
  }
}

runSmokeTests();
