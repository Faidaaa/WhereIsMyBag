/**
 * Barcode Generator Utility for WhereIsMyBag
 *
 * Generates scannable Code 128 barcode images for 10-digit baggage tags.
 * Preserves exact tag string formatting, including leading zeroes (e.g., "0055123456").
 *
 * Requirements:
 *  - Code 128 barcode format
 *  - Returns PNG Buffers or base64 Data URLs
 *  - Strict tag input validation (10 digits)
 *
 * Reference: CONTRACT.md Section 11
 */

'use strict';

const bwipjs = require('bwip-js');
const { isValidTagFormat } = require('./tagParser');

/**
 * List of standard demo baggage tags required by specification
 */
const DEMO_TAG_NUMBERS = [
  '0055123456',
  '0055123457',
  '0055123458'
];

/**
 * Generates a PNG Buffer containing a Code 128 barcode for a 10-digit baggage tag.
 *
 * @param {string} tagNumber - Exact 10-digit tag string (must preserve leading zeroes)
 * @param {Object} [options={}] - Custom rendering options
 * @param {number} [options.scale=3] - Image scale multiplier
 * @param {number} [options.height=10] - Barcode bar height in mm
 * @param {boolean} [options.includeText=true] - Whether to include human-readable text below barcode
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateBarcodePngBuffer(tagNumber, options = {}) {
  const sanitizedTag = String(tagNumber || '').trim();

  if (!isValidTagFormat(sanitizedTag)) {
    throw new Error(`Invalid tag number for barcode generation: tagNumber must be exactly 10 numeric digits (e.g. "0055123456").`);
  }

  const bwipOptions = {
    bcid: 'code128',
    text: sanitizedTag, // String ensures leading zeroes are NOT stripped
    scale: options.scale || 3,
    height: options.height || 10,
    includetext: options.includeText !== false,
    textxalign: 'center',
    textsize: options.textSize || 13,
    paddingwidth: options.paddingWidth || 10,
    paddingheight: options.paddingHeight || 10,
    backgroundcolor: 'FFFFFF'
  };

  try {
    const buffer = await bwipjs.toBuffer(bwipOptions);
    return buffer;
  } catch (err) {
    throw new Error(`Failed to generate Code 128 barcode for tag ${sanitizedTag}: ${err.message}`);
  }
}

/**
 * Generates a base64 Data URL (data:image/png;base64,...) for embedding in HTML.
 *
 * @param {string} tagNumber - 10-digit tag string
 * @param {Object} [options={}] - Rendering options
 * @returns {Promise<string>} Base64 data URL
 */
async function generateBarcodeDataUrl(tagNumber, options = {}) {
  const buffer = await generateBarcodePngBuffer(tagNumber, options);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

/**
 * Generates barcode data URLs for all three standard demo tags.
 *
 * @param {Object} [options={}] - Options passed to generator
 * @returns {Promise<Array<{tagNumber: string, dataUrl: string, formattedTag: string}>>}
 */
async function generateDemoBarcodes(options = {}) {
  const results = [];
  for (const tagNumber of DEMO_TAG_NUMBERS) {
    const dataUrl = await generateBarcodeDataUrl(tagNumber, options);
    results.push({
      tagNumber,
      dataUrl,
      formattedTag: tagNumber
    });
  }
  return results;
}

module.exports = {
  DEMO_TAG_NUMBERS,
  generateBarcodePngBuffer,
  generateBarcodeDataUrl,
  generateDemoBarcodes
};
