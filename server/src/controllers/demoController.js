/**
 * Demo Controller for WhereIsMyBag
 *
 * Provides endpoints for viewing/printing Code 128 baggage barcodes
 * and retrieving simulated BSM (Baggage Source Messages).
 *
 * Reference: CONTRACT.md Section 2 & 11
 */

'use strict';

const {
  generateBarcodePngBuffer,
  generateBarcodeDataUrl,
  DEMO_TAG_NUMBERS
} = require('../utils/barcodeGenerator');

const {
  generateBsmForTag,
  generateAllDemoBsms,
  DEMO_DATA_DISCLAIMER
} = require('../services/bsmGenerator');

const { FIXTURE_SCENARIOS } = require('../data/fixtures');

/**
 * Controller: Render printable HTML demo page displaying Code 128 barcodes
 * and simulated BSM source messages for all 3 demo baggage tags.
 *
 * GET /api/demo/barcodes
 */
async function renderBarcodesDemoPage(req, res, next) {
  try {
    const demoItems = [];

    for (const tagNumber of DEMO_TAG_NUMBERS) {
      const dataUrl = await generateBarcodeDataUrl(tagNumber, { scale: 3, height: 12 });
      const bsm = generateBsmForTag(tagNumber);
      const fixture = Object.values(FIXTURE_SCENARIOS).find(f => f.tagNumber === tagNumber);

      demoItems.push({
        tagNumber,
        dataUrl,
        bsm,
        fixture
      });
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhereIsMyBag — Demo Barcodes & Simulated BSM Messages</title>
  <style>
    :root {
      --bg-dark: #0f172a;
      --card-bg: #1e293b;
      --border-color: #334155;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent-blue: #38bdf8;
      --accent-amber: #f59e0b;
      --tag-bg: #ffffff;
      --tag-text: #0f172a;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-dark);
      color: var(--text-main);
      padding: 2rem 1rem;
      line-height: 1.5;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 2rem;
      text-align: center;
    }

    h1 {
      font-size: 2rem;
      color: var(--text-main);
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--text-muted);
      font-size: 1rem;
    }

    .disclaimer-banner {
      background-color: rgba(245, 158, 11, 0.15);
      border: 1px solid var(--accent-amber);
      color: #fcd34d;
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
      font-weight: 600;
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }

    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
    }

    .btn-print {
      background-color: var(--accent-blue);
      color: #0f172a;
      border: none;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 700;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .btn-print:hover {
      background-color: #7dd3fc;
    }

    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    @media (max-width: 768px) {
      .card {
        grid-template-columns: 1fr;
      }
    }

    .barcode-section {
      background-color: var(--tag-bg);
      color: var(--tag-text);
      border-radius: 8px;
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }

    .airline-brand {
      font-size: 0.85rem;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #475569;
      margin-bottom: 0.5rem;
    }

    .barcode-img {
      max-width: 100%;
      height: auto;
      margin: 0.5rem 0;
    }

    .tag-number-display {
      font-family: 'Courier New', Courier, monospace;
      font-size: 1.4rem;
      font-weight: 800;
      letter-spacing: 0.15em;
      color: #0f172a;
      margin-top: 0.25rem;
    }

    .passenger-info {
      font-size: 0.85rem;
      color: #334155;
      text-align: center;
      margin-top: 0.5rem;
    }

    .bsm-section {
      display: flex;
      flex-direction: column;
    }

    .bsm-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--accent-blue);
      margin-bottom: 0.5rem;
    }

    .bsm-box {
      background-color: #090d16;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 1rem;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.85rem;
      color: #34d399;
      white-space: pre-wrap;
      word-break: break-all;
      flex-grow: 1;
    }

    .demo-label {
      font-size: 0.75rem;
      color: var(--accent-amber);
      font-weight: bold;
      margin-top: 0.5rem;
      text-transform: uppercase;
    }

    /* Print Stylesheet */
    @media print {
      body {
        background-color: #ffffff;
        color: #000000;
        padding: 0;
      }
      .disclaimer-banner, .action-bar, .bsm-section, header, .demo-label {
        display: none !important;
      }
      .card {
        background-color: #ffffff;
        border: 2px dashed #000000;
        grid-template-columns: 1fr;
        margin-bottom: 1rem;
        page-break-inside: avoid;
        padding: 1rem;
      }
      .barcode-section {
        box-shadow: none;
        border: none;
        padding: 0;
      }
      .barcode-img {
        max-width: 80%;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>WhereIsMyBag — Demo Baggage Barcodes</h1>
      <p class="subtitle">Scannable Code 128 Barcodes &amp; Simulated Baggage Source Messages (BSM)</p>
    </header>

    <div class="disclaimer-banner">
      ⚠️ ${DEMO_DATA_DISCLAIMER}
    </div>

    <div class="action-bar">
      <span>Generating 3 fixture baggage tags with leading zeroes preserved</span>
      <button class="btn-print" onclick="window.print()">🖨️ Print Barcode Tags</button>
    </div>

    ${demoItems.map(item => `
      <div class="card">
        <div class="barcode-section">
          <div class="airline-brand">Nimbus Airways (NB) — Baggage Tag</div>
          <img class="barcode-img" src="${item.dataUrl}" alt="Code 128 Barcode for tag ${item.tagNumber}" />
          <div class="tag-number-display">${item.tagNumber}</div>
          <div class="passenger-info">
            <strong>${item.fixture ? item.fixture.passengerFullName : 'PASSENGER'}</strong> | PNR: <strong>${item.fixture ? item.fixture.pnr : 'N/A'}</strong><br/>
            Flight: <strong>${item.fixture ? item.fixture.currentFlight : ''}</strong> (${item.fixture ? item.fixture.origin : ''} &rarr; ${item.fixture ? item.fixture.destination : ''})
          </div>
        </div>

        <div class="bsm-section">
          <div class="bsm-title">Simulated Baggage Source Message (BSM)</div>
          <div class="bsm-box">${escapeHtml(item.bsm.rawBsmText)}</div>
          <div class="demo-label">Simulated BSM Demo Data</div>
        </div>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (err) {
    next(err);
  }
}

/**
 * Controller: Directly serve PNG barcode image for a specific tag.
 *
 * GET /api/barcodes/:tagNumber.png
 */
async function getBarcodePng(req, res, next) {
  try {
    const tagNumber = req.params.tagNumber ? req.params.tagNumber.replace('.png', '') : '';
    const buffer = await generateBarcodePngBuffer(tagNumber, { scale: 3, height: 10 });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.status(200).send(buffer);
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

/**
 * Controller: Retrieve simulated BSM data JSON for a specific tag or all demo tags.
 *
 * GET /api/bsm/:tagNumber?
 */
function getBsmData(req, res, next) {
  try {
    const { tagNumber } = req.params;

    if (tagNumber) {
      const bsm = generateBsmForTag(tagNumber);
      return res.status(200).json(bsm);
    }

    const bsms = generateAllDemoBsms();
    return res.status(200).json({
      isSimulatedDemoData: true,
      disclaimer: DEMO_DATA_DISCLAIMER,
      count: bsms.length,
      messages: bsms
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      error: err.message
    });
  }
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = {
  renderBarcodesDemoPage,
  getBarcodePng,
  getBsmData
};
