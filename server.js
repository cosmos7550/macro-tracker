'use strict';
const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

// Load .env file
try {
  const envLines = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n');
  for (const line of envLines) {
    const m = line.match(/^\s*([\w]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
} catch (_) {}

const PORT     = parseInt(process.env.PORT || '3000', 10);
const API_KEY  = process.env.ANTHROPIC_API_KEY || '';
const PUBLIC   = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readData(filename) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8')); }
  catch (_) { return null; }
}
function writeData(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data), 'utf8');
}
function listDataDates(prefix) {
  return fs.readdirSync(DATA_DIR)
    .filter(function(f) { return f.startsWith(prefix) && f.endsWith('.json'); })
    .map(function(f) { return f.slice(prefix.length, -5); })
    .sort();
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml'
};

const SYSTEM_PROMPT =
  'You are a macro tracking assistant. Return ONLY a JSON object — no explanation, no markdown, no trailing text.\n\n' +
  'LOOKUP PRIORITY:\n' +
  'For named restaurants, search for official nutrition data first (restaurant websites > MyFitnessPal/FatSecret > recipe estimates). Only estimate if no published data found.\n\n' +
  'CONFIDENCE (per item):\n' +
  '- "high" → published data found, or exact weight given\n' +
  '- "medium" → well-known dish with standard portion, or reasonable ingredient-based estimate\n' +
  '- "low" → vague input, ambiguous portion, or no reliable source\n\n' +
  'ESTIMATION RULES:\n' +
  '- Never underestimate restaurant portions or calorie-dense preparations (fried, breaded, sauced)\n' +
  '- Sauced/glazed items: add 100–300 cal for sauce\n' +
  '- Named dishes: assume full plating (protein + included sides/sauce)\n\n' +
  'CLARIFICATION: Ask only if ambiguity would shift total calories >15%. Use:\n' +
  '{"clarification":"[single specific question]"}\n' +
  'Triggers: cooking method for high-fat items, completely unspecified portion on calorie-dense meals, ambiguous protein source.\n' +
  'Non-triggers: sauce on side, seasoning, minor toppings, drinks.\n\n' +
  'OUTPUT FORMAT:\n' +
  '{"title":"[General category label — max 30 chars, short, no brand, e.g. \'Greek Yogurt\' or \'Chicken Bowl\']","items":[{"name":"[Specific product/brand + serving size used, e.g. \'Kirkland 0% Greek Yogurt (200g / ~¼ cup)\']","cal":[n],"p":[n],"c":[n],"f":[n],"conf":"[high|medium|low]"}]}\n\n' +
  'Title rules: use a short generic food category (no brand names), MUST be 30 characters or fewer. Item name rules: include the specific brand/product and the serving size (weight in grams if known, plus a common household measure if applicable; include whichever measures are known).\n\n' +
  'All macro values are integers. cal=calories, p=protein(g), c=carbs(g), f=fat(g).';

function callClaude(food, clarification, cb) {
  const userContent = 'Food: "' + food + '"' + (clarification ? '\nClarification: ' + clarification : '');
  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userContent }]
  });
  const req = https.request({
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body)
    }
  }, (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.error) return cb(new Error(json.error.message));
        const u = json.usage || {};
        if (u.cache_read_input_tokens) console.log(`  cache hit: ${u.cache_read_input_tokens} tokens read`);
        else if (u.cache_creation_input_tokens) console.log(`  cache write: ${u.cache_creation_input_tokens} tokens stored`);
        const textBlock = json.content.find(b => b.type === 'text');
        if (!textBlock) return cb(new Error('No text in response'));
        cb(null, textBlock.text);
      } catch (e) { cb(e); }
    });
  });
  req.on('error', cb);
  req.write(body);
  req.end();
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/api/estimate') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        const { food, clarification } = JSON.parse(body);
        if (!food) { res.writeHead(400); res.end('Missing food'); return; }
        callClaude(food, clarification || null, (err, text) => {
          if (err) { res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); return; }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ text }));
        });
      } catch (e) { res.writeHead(400); res.end('Bad JSON'); }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/prompt') {
    const food = url.searchParams.get('food') || '';
    const clarification = url.searchParams.get('clarification') || '';
    const userContent = 'Food: "' + food + '"' + (clarification ? '\nClarification: ' + clarification : '');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ system: SYSTEM_PROMPT, user: userContent }));
    return;
  }

  // ── Data API ────────────────────────────────────────────────────────────────

  if (req.method === 'GET' && url.pathname === '/api/journal/dates') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(listDataDates('journal_')));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/journal/')) {
    const date = url.pathname.slice('/api/journal/'.length);
    const data = readData('journal_' + date + '.json');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data || { date, entries: [] }));
    return;
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/journal/')) {
    const date = url.pathname.slice('/api/journal/'.length);
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        writeData('journal_' + date + '.json', JSON.parse(body));
        res.writeHead(204); res.end();
      } catch (_) { res.writeHead(400); res.end('Bad JSON'); }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/goals/dates') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(listDataDates('goals_')));
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/goals/')) {
    const date = url.pathname.slice('/api/goals/'.length);
    const dates = listDataDates('goals_');
    let best = null;
    for (let i = dates.length - 1; i >= 0; i--) {
      if (dates[i] <= date) { best = dates[i]; break; }
    }
    const data = best ? readData('goals_' + best + '.json') : null;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/goals/')) {
    const date = url.pathname.slice('/api/goals/'.length);
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        writeData('goals_' + date + '.json', JSON.parse(body));
        res.writeHead(204); res.end();
      } catch (_) { res.writeHead(400); res.end('Bad JSON'); }
    });
    return;
  }

  // ── Static files ─────────────────────────────────────────────────────────────

  const filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const ext      = path.extname(filePath).toLowerCase();
  try {
    const content = fs.readFileSync(path.join(PUBLIC, filePath));
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch (_) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, () => console.log(`\nMacro Tracker → http://localhost:${PORT}\n`));
