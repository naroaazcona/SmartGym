const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'testing-html');
const OUTPUT_HTML = path.join(OUTPUT_DIR, 'test-report.html');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'test-report.json');

const SERVICES = [
  { name: 'auth-service', relPath: 'auth-service' },
  { name: 'gym-service', relPath: 'gym-service' },
  { name: 'api-gateway', relPath: 'api-gateway' },
  { name: 'training-service', relPath: 'training-service' },
  { name: 'frontend', relPath: 'frontend' },
];

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function toNum(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseCoverage(servicePath) {
  const summaryPath = path.join(servicePath, 'coverage', 'coverage-summary.json');
  const summary = readJsonIfExists(summaryPath);
  if (!summary || !summary.total) return null;

  const total = summary.total;
  return {
    lines: {
      pct: toNum(total.lines && total.lines.pct),
      covered: toNum(total.lines && total.lines.covered),
      total: toNum(total.lines && total.lines.total),
    },
    statements: {
      pct: toNum(total.statements && total.statements.pct),
      covered: toNum(total.statements && total.statements.covered),
      total: toNum(total.statements && total.statements.total),
    },
    functions: {
      pct: toNum(total.functions && total.functions.pct),
      covered: toNum(total.functions && total.functions.covered),
      total: toNum(total.functions && total.functions.total),
    },
    branches: {
      pct: toNum(total.branches && total.branches.pct),
      covered: toNum(total.branches && total.branches.covered),
      total: toNum(total.branches && total.branches.total),
    },
  };
}

function parseJestResults(servicePath) {
  const resultsPath = path.join(servicePath, 'coverage', 'test-results.json');
  const json = readJsonIfExists(resultsPath);
  if (!json) return null;

  return {
    total: toNum(json.numTotalTests, 0),
    passed: toNum(json.numPassedTests, 0),
    failed: toNum(json.numFailedTests, 0),
    pending: toNum(json.numPendingTests, 0),
    suitesTotal: toNum(json.numTotalTestSuites, 0),
    suitesFailed: toNum(json.numFailedTestSuites, 0),
  };
}

function runTestsForService(servicePath, packageJson) {
  const isWin = process.platform === 'win32';
  const npmCmd = 'npm';
  const hasJest = Boolean(
    (packageJson.devDependencies && packageJson.devDependencies.jest) ||
      (packageJson.dependencies && packageJson.dependencies.jest) ||
      String(packageJson.scripts.test || '').includes('jest')
  );

  const args = hasJest
    ? [
        'test',
        '--',
        '--runInBand',
        '--coverage',
        '--coverageReporters=json-summary',
        '--json',
        '--outputFile=coverage/test-results.json',
      ]
    : ['test'];

  return spawnSync(npmCmd, args, {
    cwd: servicePath,
    encoding: 'utf8',
    shell: isWin,
  });
}

function statusMeta(status) {
  if (status === 'passed') return { label: 'PASS', cls: 'ok' };
  if (status === 'failed') return { label: 'FAIL', cls: 'fail' };
  return { label: 'NO CONFIG', cls: 'na' };
}

function pctText(value) {
  return value === null || value === undefined ? 'N/A' : `${value.toFixed(1)}%`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml(report) {
  const cards = report.services
    .map((svc) => {
      const meta = statusMeta(svc.status);
      const covPct = svc.coverage && svc.coverage.lines ? svc.coverage.lines.pct : null;
      const tests = svc.tests;

      const testsText = tests
        ? `${tests.passed}/${tests.total} tests OK${tests.failed ? ` (${tests.failed} failed)` : ''}`
        : 'Sin resultados de tests';

      const detailRows = svc.coverage
        ? [
            ['Lineas', pctText(svc.coverage.lines.pct)],
            ['Statements', pctText(svc.coverage.statements.pct)],
            ['Funciones', pctText(svc.coverage.functions.pct)],
            ['Branches', pctText(svc.coverage.branches.pct)],
          ]
            .map(([k, v]) => `<div class="metric"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`)
            .join('')
        : '<div class="metric"><span>Cobertura</span><strong>N/A</strong></div>';

      return `
        <section class="card ${meta.cls}">
          <header>
            <h2>${esc(svc.name)}</h2>
            <span class="badge ${meta.cls}">${meta.label}</span>
          </header>
          <p class="path">${esc(svc.path)}</p>
          <p class="tests">${esc(testsText)}</p>
          <div class="coverage">
            <div class="coverage-top">
              <span>Coverage (lineas)</span>
              <strong>${esc(pctText(covPct))}</strong>
            </div>
            <div class="bar">
              <span style="width:${covPct === null ? 0 : Math.max(0, Math.min(100, covPct))}%;"></span>
            </div>
          </div>
          <div class="metrics">${detailRows}</div>
          ${svc.note ? `<p class="note">${esc(svc.note)}</p>` : ''}
        </section>
      `;
    })
    .join('\n');

  const total = report.services.length;
  const pass = report.services.filter((s) => s.status === 'passed').length;
  const fail = report.services.filter((s) => s.status === 'failed').length;
  const na = report.services.filter((s) => s.status === 'not_configured').length;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>SmartGym Test Report</title>
  <style>
    :root {
      --bg: #f4f6f8;
      --surface: #ffffff;
      --txt: #1b2430;
      --muted: #5a6472;
      --ok: #1f9d55;
      --ok-soft: #e8f7ee;
      --fail: #d64545;
      --fail-soft: #fdecec;
      --na: #9aa3af;
      --na-soft: #f1f3f5;
      --border: #dbe1e8;
      --brand: #1e3a5f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Segoe UI, Arial, sans-serif;
      color: var(--txt);
      background: radial-gradient(circle at 0% 0%, #ffffff 0%, var(--bg) 45%);
    }
    main {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 16px 40px;
    }
    .top {
      background: var(--brand);
      color: #fff;
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .top h1 {
      margin: 0 0 6px;
      font-size: 24px;
    }
    .top p {
      margin: 0;
      opacity: .9;
      font-size: 14px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 10px;
      margin: 14px 0 6px;
    }
    .box {
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.28);
      border-radius: 10px;
      padding: 10px;
    }
    .box .v {
      font-size: 24px;
      font-weight: 700;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
    }
    .card {
      background: var(--surface);
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 12px;
    }
    .card.ok { border-color: #b9e5c9; background: linear-gradient(180deg, #fff, var(--ok-soft)); }
    .card.fail { border-color: #f4b3b3; background: linear-gradient(180deg, #fff, var(--fail-soft)); }
    .card.na { border-color: #e2e7ec; background: linear-gradient(180deg, #fff, var(--na-soft)); }
    .card header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .card h2 {
      margin: 0;
      font-size: 18px;
    }
    .badge {
      font-size: 11px;
      font-weight: 700;
      padding: 5px 8px;
      border-radius: 999px;
      color: #fff;
    }
    .badge.ok { background: var(--ok); }
    .badge.fail { background: var(--fail); }
    .badge.na { background: var(--na); }
    .path {
      margin: 4px 0 10px;
      color: var(--muted);
      font-size: 12px;
    }
    .tests {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 600;
    }
    .coverage-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 6px;
    }
    .bar {
      width: 100%;
      height: 8px;
      border-radius: 999px;
      background: #e5ebf0;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .bar span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, #2f80ed, #27ae60);
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
    }
    .metric {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 6px;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      background: #fff;
    }
    .note {
      margin: 10px 0 0;
      font-size: 12px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <main>
    <section class="top">
      <h1>SmartGym - Estado de tests y cobertura</h1>
      <p>Generado: ${esc(report.generatedAt)}</p>
      <div class="summary">
        <div class="box"><div>Total servicios</div><div class="v">${total}</div></div>
        <div class="box"><div>PASS</div><div class="v">${pass}</div></div>
        <div class="box"><div>FAIL</div><div class="v">${fail}</div></div>
        <div class="box"><div>Sin config</div><div class="v">${na}</div></div>
      </div>
    </section>
    <section class="grid">${cards}</section>
  </main>
</body>
</html>`;
}

function run() {
  const report = {
    generatedAt: new Date().toISOString(),
    services: [],
  };

  for (const svc of SERVICES) {
    const servicePath = path.join(ROOT, svc.relPath);
    const pkgPath = path.join(servicePath, 'package.json');
    const pkg = readJsonIfExists(pkgPath);

    const entry = {
      name: svc.name,
      path: svc.relPath,
      status: 'not_configured',
      tests: null,
      coverage: null,
      note: '',
    };

    if (!fs.existsSync(servicePath)) {
      entry.note = 'Carpeta no encontrada';
      report.services.push(entry);
      continue;
    }

    if (!pkg || !pkg.scripts || !pkg.scripts.test) {
      entry.note = 'Sin script de test en package.json';
      report.services.push(entry);
      continue;
    }

    const runResult = runTestsForService(servicePath, pkg);
    const parsedTests = parseJestResults(servicePath);
    if (parsedTests) {
      entry.tests = parsedTests;
    }

    entry.coverage = parseCoverage(servicePath);

    if (parsedTests) {
      const hasFailures = (parsedTests.failed || 0) > 0 || (parsedTests.suitesFailed || 0) > 0;
      entry.status = hasFailures ? 'failed' : 'passed';
      if (runResult.error) {
        entry.note = `No se pudo ejecutar automaticamente (${runResult.error.code || 'error'}). Mostrando el ultimo resultado disponible.`;
      }
    } else {
      entry.status = runResult.status === 0 ? 'passed' : 'failed';
    }

    if (entry.status === 'failed' && !entry.note) {
      const raw = runResult.error
        ? runResult.error.message
        : runResult.stderr || runResult.stdout || 'Fallo al ejecutar tests';
      const msg = `${raw}`.trim();
      entry.note = msg.slice(0, 180);
    }

    report.services.push(entry);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), 'utf8');
  fs.writeFileSync(OUTPUT_HTML, buildHtml(report), 'utf8');

  console.log(`[OK] Report JSON: ${path.relative(ROOT, OUTPUT_JSON)}`);
  console.log(`[OK] Report HTML: ${path.relative(ROOT, OUTPUT_HTML)}`);
}

run();
