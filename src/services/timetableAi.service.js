/**
 * Timetable AI Service — Gemini 1.5 Flash vision extraction.
 *
 * Takes a timetable image (Buffer + mimeType) and returns a normalised JSON
 * structure: { section, slots[] }. The model is told exactly what shape to
 * return so the controller can iterate without further parsing.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';
import { BadRequestError } from '../utils/errors.js';

const MODEL_NAME = 'gemini-2.5-flash';
// Force v1 (stable) endpoint — this key's project has free-tier quota only on v1, not v1beta
const API_VERSION = 'v1';

/**
 * The prompt is intentionally strict: JSON only, fixed schema, explicit rules
 * for merged cells and shift suffixes. Loosening any of these tends to make
 * Gemini wrap the response in markdown fences or add commentary.
 */
const PROMPT = `You are extracting class data from a university timetable image.

Return JSON ONLY (no markdown, no commentary, no code fences). Use this exact schema:
{
  "section": {
    "rawTitle": "<the title text shown at the top of the image>",
    "program": "<e.g. BSIT, BSCS, BSAI — null if not present>",
    "semester": <integer 1-12 or null>,
    "section": "<single letter A/B/C... or null>",
    "shift": "<I or II or null>"
  },
  "slots": [
    {
      "day": "MON|TUE|WED|THU|FRI|SAT|SUN",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "course": "<course name as printed, no department prefix>",
      "teacher": "<full teacher name with title (Mr/Ms/Dr) if present, no department prefix>",
      "department": "<dept code printed before the name, e.g. CS / HUM / MGT — null if absent>",
      "room": "<room as printed, strip any '(Shift-...)' suffix>",
      "isLab": <true if the cell text contains 'Lab' or spans multiple time columns, else false>
    }
  ]
}

Rules:
- All times in 24-hour HH:MM format.
- Merged cells (one block spanning multiple time columns) MUST produce ONE slot whose
  startTime is the leftmost column start and endTime is the rightmost column end.
- "(Shift-I)" / "(Shift-II)" suffixes belong in section.shift, NOT in room.
- If a cell is empty, do not add a slot for it.
- If the day column header uses abbreviations (Mo/Tu/We/Th/Fr), still output the 3-letter
  form (MON/TUE/WED/THU/FRI).
- Trim the department prefix (e.g. "CS-Mr Yasir" → teacher="Mr Yasir", department="CS").
- Output JSON only. No \`\`\`json fences. No prose.`;

/**
 * Retry a Gemini call on 429. Parses the retryDelay from the error body
 * and waits the recommended time before retrying (capped at 60 s).
 */
async function callWithRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.message?.includes('429') || err.status === 429;
      if (!is429 || attempt === maxRetries) throw err;

      // Extract recommended delay from error body ("retryDelay":"21s")
      const match = err.message?.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
      const waitMs = match ? Math.ceil(parseFloat(match[1])) * 1000 + 500 : (2 ** attempt) * 3000;
      await new Promise((r) => setTimeout(r, Math.min(waitMs, 60_000)));
    }
  }
}

/**
 * Strip markdown code fences that Gemini sometimes adds despite being told not to.
 * Returns the inner JSON string.
 */
function stripCodeFence(text) {
  const trimmed = text.trim();
  // ```json ... ``` or ``` ... ```
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

/**
 * Validate one slot. Returns null if the slot is unusable, otherwise a cleaned copy.
 * Filters out hallucinated fields and normalises day codes / times.
 */
function cleanSlot(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const dayRaw = String(raw.day || '').toUpperCase().slice(0, 3);
  const validDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  if (!validDays.includes(dayRaw)) return null;

  const timeRe = /^([01]?\d|2[0-3]):([0-5]\d)$/;
  if (!timeRe.test(raw.startTime) || !timeRe.test(raw.endTime)) return null;

  // Pad single-digit hours so "9:00" → "09:00" for consistent string compare
  const pad = (t) => {
    const [h, m] = t.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  };

  const course = (raw.course ?? '').toString().trim();
  if (!course) return null;

  return {
    day: dayRaw,
    startTime: pad(raw.startTime),
    endTime: pad(raw.endTime),
    course,
    teacher: (raw.teacher ?? '').toString().trim() || null,
    department: (raw.department ?? '').toString().trim() || null,
    room: (raw.room ?? '').toString().trim() || null,
    isLab: Boolean(raw.isLab),
  };
}

/**
 * Run Gemini extraction. Throws if the API key is missing or the response
 * cannot be parsed into the expected shape.
 */
export async function extractTimetableFromImage(imageBuffer, mimeType) {
  if (!env.GEMINI_API_KEY) {
    throw new BadRequestError('GEMINI_API_KEY is not set on the server. Add it to .env and restart.');
  }
  if (!Buffer.isBuffer(imageBuffer) || imageBuffer.length === 0) {
    throw new BadRequestError('Empty image buffer');
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel(
    { model: MODEL_NAME, generationConfig: { temperature: 0.1 } },
    { apiVersion: API_VERSION },   // use v1 stable — v1beta has 0 free-tier quota for this key
  );

  let result;
  try {
    result = await callWithRetry(() =>
      model.generateContent([
        PROMPT,
        { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
      ])
    );
  } catch (err) {
    if (err.message?.includes('429')) {
      throw new BadRequestError(
        'Gemini API quota exceeded. The free tier allows ~15 requests/min and 1 500/day. ' +
        'Wait a minute and try again, or upgrade to a paid Gemini API plan.'
      );
    }
    throw err;
  }

  const text = result.response.text();
  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch (e) {
    throw new BadRequestError(
      `AI response was not valid JSON. First 200 chars: ${text.slice(0, 200)}`
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new BadRequestError('AI returned a non-object response');
  }

  const slots = Array.isArray(parsed.slots) ? parsed.slots : [];
  const cleanedSlots = slots.map(cleanSlot).filter(Boolean);

  return {
    section: parsed.section || {},
    slots: cleanedSlots,
    rawSlotCount: slots.length,
  };
}
