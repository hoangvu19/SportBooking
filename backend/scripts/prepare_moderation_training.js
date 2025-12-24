#!/usr/bin/env node
/**
 * Prepare moderation training CSV from exported moderation logs.
 * Usage:
 *   node backend/scripts/prepare_moderation_training.js <export.csv> <out.csv>
 *
 * Output columns: id,text,labels
 * labels is comma-separated list of labels from: spam,sexual,hate,violence,scam,political,other
 */

const fs = require('fs');
const path = require('path');

const INPUT = process.argv[2] || path.resolve(process.cwd(), 'moderation_export.csv');
const OUTPUT = process.argv[3] || path.resolve(process.cwd(), 'moderation_training.csv');

const KNOWN = ['spam','sexual','hate','violence','scam','political','other'];

function parseCSVLine(line) {
  // simple CSV parser for one line, supports quoted fields with double quotes escaping
  const res = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i+1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else { cur += ch; }
    } else {
      if (ch === ',') { res.push(cur); cur = ''; }
      else if (ch === '"') { inQuotes = true; }
      else { cur += ch; }
    }
  }
  res.push(cur);
  return res;
}

function guessLabels(row) {
  // row: map of header->value
  const labels = new Set();

  const reason = (row['Reason'] || row['reason'] || row['ReasonText'] || '').toLowerCase();
  const flagsRaw = row['Flags'] || row['flags'] || '';
  const isClean = (String(row['IsClean'] || row['isClean'] || '')).trim();
  const needsReview = (String(row['NeedsReview'] || row['needsReview'] || '')).trim();
  const confidence = parseFloat(row['Confidence'] || row['confidence'] || '0') || 0;

  // map reason
  if (reason) {
    if (reason.includes('spam')) labels.add('spam');
    if (reason.includes('adult') || reason.includes('sex') || reason.includes('porn')) labels.add('sexual');
    if (reason.includes('hate')) labels.add('hate');
    if (reason.includes('violent') || reason.includes('violence') || reason.includes('bạo')) labels.add('violence');
    if (reason.includes('scam') || reason.includes('fraud') || reason.includes('lừa')) labels.add('scam');
    if (reason.includes('polit') || reason.includes('chính trị') || reason.includes('political')) labels.add('political');
  }

  // parse flags JSON if present
  try {
    if (flagsRaw) {
      const f = typeof flagsRaw === 'string' ? (flagsRaw.trim().startsWith('{') ? JSON.parse(flagsRaw) : flagsRaw) : flagsRaw;
      const flagsStr = typeof f === 'object' ? JSON.stringify(f).toLowerCase() : String(f).toLowerCase();
      if (flagsStr.includes('spam')) labels.add('spam');
      if (flagsStr.includes('sex') || flagsStr.includes('porn') || flagsStr.includes('adult')) labels.add('sexual');
      if (flagsStr.includes('hate')) labels.add('hate');
      if (flagsStr.includes('viol') || flagsStr.includes('bạo')) labels.add('violence');
      if (flagsStr.includes('scam') || flagsStr.includes('lừa')) labels.add('scam');
      if (flagsStr.includes('polit')) labels.add('political');
    }
  } catch (e) {
    // ignore parse errors
  }

  // heuristics: not clean + low confidence -> other
  if ((isClean === '0' || isClean.toLowerCase() === 'false' || needsReview === '1' || needsReview.toLowerCase() === 'true') && labels.size === 0) {
    if (confidence > 0 && confidence < 0.95) labels.add('other');
  }

  return Array.from(labels);
}

async function run() {
  if (!fs.existsSync(INPUT)) {
    console.error('Input file not found:', INPUT);
    process.exit(2);
  }

  const text = fs.readFileSync(INPUT, 'utf8');
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length < 2) { console.error('No data in CSV'); process.exit(2); }

  const header = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    // map header->value
    const map = {};
    for (let j = 0; j < header.length; j++) map[header[j]] = cols[j] || '';
    rows.push(map);
  }

  const outStream = fs.createWriteStream(OUTPUT, { encoding: 'utf8' });
  outStream.write('id,text,labels\n');

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    // choose id
    const id = r['ContentModerationLogID'] || r['ID'] || r['PostID'] || r['CommentID'] || idx + 1;
    const textField = r['Content'] || r['content'] || r['Text'] || r['text'] || '';
    const labels = guessLabels(r);
    const labelsStr = labels.join(',');

    // escape text for CSV
    let t = String(textField).replace(/\r?\n/g, ' ');
    if (t.includes(',') || t.includes('"')) t = '"' + t.replace(/"/g, '""') + '"';

    outStream.write(`${id},${t},"${labelsStr}"\n`);
  }

  outStream.end();
  console.log('Wrote training CSV to', OUTPUT);
}

run();
