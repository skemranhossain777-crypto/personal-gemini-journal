import http from 'http';
import https from 'https';

const targetUrl = process.env.SMOKE_TARGET_URL || 'http://localhost:3000';
console.log(`[Smoke Test] Target URL: ${targetUrl}`);

async function fetchUrl(urlPath) {
  const fullUrl = new URL(urlPath, targetUrl);
  const client = fullUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(fullUrl.toString(), (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, data });
      });
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${fullUrl} after 25s`));
    });
  });
}

async function runSmokeTests() {
  let failed = false;

  // 1. Health Probe
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

  if (failed) {
    console.error('\n❌ SMOKE TESTS FAILED!');
    process.exit(1);
  } else {
    console.log('\n🎉 ALL SMOKE TESTS PASSED CLEANLY!');
    process.exit(0);
  }
}

runSmokeTests();
