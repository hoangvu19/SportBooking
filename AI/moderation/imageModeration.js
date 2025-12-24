/**
 * Image/Media Moderation Adapter
 * - Supports Azure Content Moderator when enabled via config
 * - Falls back to lightweight heuristics and flags for review otherwise
 */

const fetch = require('node-fetch');
const config = require('../config');
const logger = require('../utils/logger');
const sharp = require('sharp');

async function callAzureModerator(imageUrl) {
  const cfg = config.moderation.externalAPIs.azureModerator;
  if (!cfg || !cfg.enabled || !cfg.apiKey || !cfg.endpoint) {
    throw new Error('Azure Moderator not configured');
  }

  const url = `${cfg.endpoint}/contentmoderator/moderate/v1.0/ProcessImage/Evaluate`;

  const res = await fetch(url + `?cacheImage=true&language=eng`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': cfg.apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ DataRepresentation: 'URL', Value: imageUrl })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure moderator error: ${res.status} ${text}`);
  }

  const data = await res.json();
  // Azure returns AdultClassificationScore, RacyClassificationScore
  return {
    provider: 'azure',
    raw: data,
    adultScore: data.AdultClassificationScore || 0,
    racyScore: data.RacyClassificationScore || 0,
    isAdult: data.IsImageAdultClassified || false,
    isRacy: data.IsImageRacyClassified || false
  };
}

function heuristicCheck(url) {
  const lowered = (url || '').toLowerCase();
  const pornKeywords = ['sex', 'porn', 'nude', 'naked', 'xxx', '18+', 'boobs', 'tits', 'penis', 'vagina', 'nudes'];
  let score = 0;
  for (const k of pornKeywords) {
    if (lowered.includes(k)) score += 0.25;
  }
  // Cap
  score = Math.min(1, score);

  return {
    provider: 'heuristic',
    raw: null,
    adultScore: score,
    racyScore: 0,
    isAdult: score >= 0.8,
    isRacy: score >= 0.5
  };
}

/**
 * Lightweight skin-pixel ratio detector
 * - Downloads image, resizes to small resolution and samples pixels
 * - Uses a simple RGB heuristic to estimate skin tone coverage
 * Returns score between 0 and 1 (higher => more skin exposed)
 */
async function detectSkinRatio(imageUrl) {
  try {
    const res = await fetch(imageUrl, { timeout: 8000 });
    if (!res.ok) {
      throw new Error(`fetch failed ${res.status}`);
    }
    const buffer = await res.buffer();

    // Resize to small image for speed
    const small = await sharp(buffer).resize(128, 128, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const { data, info } = small; // data is Buffer, info has width,height,channels

    const w = info.width; const h = info.height; const channels = info.channels;
    if (channels < 3) return 0;

    let skinCount = 0; let total = 0;
    // sample every 3rd pixel to speed up
    for (let y = 0; y < h; y += 3) {
      for (let x = 0; x < w; x += 3) {
        const idx = (y * w + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // RGB-based skin detection rule (widely used heuristic)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const condition1 = r > 95 && g > 40 && b > 20 && (max - min) > 15 && Math.abs(r - g) > 15 && r > g && r > b;
        const condition2 = r > 200 && g > 210 && b > 170; // light skin

        if (condition1 || condition2) skinCount++;
        total++;
      }
    }

    const ratio = total > 0 ? skinCount / total : 0;
    // normalize and clamp
    return Math.max(0, Math.min(1, ratio));
  } catch (err) {
    logger.warn('ImageModeration', 'skin detection failed', err.message);
    return 0;
  }
}

async function moderateImages(imageUrls = []) {
  const results = [];
  let aggregateScore = 0;

  for (const url of imageUrls) {
    try {
      let res;
      // First, attempt skin-detection heuristic (fast, local) to catch exposed-skin images
      try {
        const skinRatio = await detectSkinRatio(url);
        if (skinRatio >= 0.35) {
          // strong signal: mark high nsfw and skip external call
          res = {
            provider: 'skin-heuristic',
            adultScore: Math.min(1, skinRatio),
            racyScore: 0,
            isAdult: skinRatio >= 0.6,
            isRacy: skinRatio >= 0.4
          };
        }
      } catch (err) {
        logger.warn('ImageModeration', 'skin detection error', err.message);
      }

      if (!res && config.moderation.externalAPIs.azureModerator.enabled) {
        try {
          res = await callAzureModerator(url);
        } catch (err) {
          logger.warn('ImageModeration', 'Azure moderator failed, falling back to heuristic', err.message);
          res = heuristicCheck(url);
        }
      } else {
        // If not using Azure and res not set by skin heuristic, use filename heuristic
        if (!res) res = heuristicCheck(url);
      }

      // Define nsfwScore as max(adultScore, racyScore)
      const nsfwScore = Math.max(res.adultScore || 0, res.racyScore || 0);
      aggregateScore = Math.max(aggregateScore, nsfwScore);

      results.push({ url, nsfwScore, detail: res });
    } catch (error) {
      logger.warn('ImageModeration', 'Failed to moderate image', { url, error: error.message });
      results.push({ url, nsfwScore: 0, detail: { error: error.message } });
    }
  }

  return {
    count: imageUrls.length,
    aggregateScore,
    results
  };
}

module.exports = {
  moderateImages
};
