/**
 * Timetable Import Controller
 *
 * Two endpoints:
 *   POST /api/slots/extract-from-image
 *     - multipart upload of timetable image
 *     - returns extracted slots + name → ID match suggestions
 *
 *   POST /api/slots/import-extracted
 *     - receives admin-confirmed slots (with explicit Section_ID, optional Teacher_ID/Course_ID)
 *     - bulk-creates TimetableSlot rows, skipping duplicates
 */

import asyncHandler from 'express-async-handler';
import { prisma } from '../config/database.js';
import { successResponse } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';
import { extractTimetableFromImage } from '../services/timetableAi.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Lower-case + collapse whitespace + drop common honorifics.
 * Used so "Mr Muhammad Yasir Ali" and "Muhammad Yasir Ali" both match.
 */
function normaliseName(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/\b(mr|mrs|ms|dr|prof|sir|madam|miss)\.?\b/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Try to match an extracted teacher name against the existing Teacher list.
 * Returns the Teacher_ID of the best match, or null if none is good enough.
 *
 * Strategy: substring-match on normalised names. Deliberately conservative —
 * the admin gets a review UI and can override anything we got wrong.
 */
function matchTeacher(extracted, allTeachers) {
  const target = normaliseName(extracted);
  if (!target) return null;

  // Exact (after normalisation)
  const exact = allTeachers.find((t) => normaliseName(t.Name) === target);
  if (exact) return exact.Teacher_ID;

  // Substring either way — handles "Yasir Ali" matching "Muhammad Yasir Ali" and vice versa.
  const candidates = allTeachers.filter((t) => {
    const n = normaliseName(t.Name);
    return n && (n.includes(target) || target.includes(n));
  });
  if (candidates.length === 1) return candidates[0].Teacher_ID;
  return null;
}

function matchCourse(extracted, allCourses) {
  const target = normaliseName(extracted);
  if (!target) return null;

  const exact = allCourses.find((c) => normaliseName(c.Name) === target);
  if (exact) return exact.Course_ID;

  const candidates = allCourses.filter((c) => {
    const n = normaliseName(c.Name);
    return n && (n.includes(target) || target.includes(n));
  });
  if (candidates.length === 1) return candidates[0].Course_ID;
  return null;
}

function matchSection(rawTitle, parsed, allSections) {
  if (!rawTitle && !parsed) return null;

  // Try exact match against Section.Name first (most reliable)
  if (rawTitle) {
    const target = normaliseName(rawTitle);
    const exact = allSections.find((s) => normaliseName(s.Name) === target);
    if (exact) return exact.Section_ID;

    const partial = allSections.filter((s) => {
      const n = normaliseName(s.Name);
      return n && (n.includes(target) || target.includes(n));
    });
    if (partial.length === 1) return partial[0].Section_ID;
  }

  // Compose-and-match from parsed parts: "BSIT-VIII-A" style
  if (parsed?.program && parsed?.section) {
    const composed = `${parsed.program} ${parsed.section}`.toLowerCase();
    const found = allSections.find((s) => normaliseName(s.Name).includes(normaliseName(composed)));
    if (found) return found.Section_ID;
  }
  return null;
}

// ── Controllers ──────────────────────────────────────────────────────────

/**
 * @route POST /api/slots/extract-from-image
 * @desc  Upload an image, run Gemini, return extracted + matched data for admin review.
 * @form  multipart/form-data: file=<image>
 */
export const extractFromImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new BadRequestError('No image uploaded. Send a multipart "file" field.');
  }
  if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
    throw new BadRequestError(`Unsupported file type: ${req.file.mimetype || 'unknown'}`);
  }

  // 1. Run AI extraction
  const ai = await extractTimetableFromImage(req.file.buffer, req.file.mimetype);

  // 2. Load reference data for name → ID matching
  const [teachers, courses, sections] = await Promise.all([
    prisma.teacher.findMany({ select: { Teacher_ID: true, Name: true } }),
    prisma.course.findMany({ select: { Course_ID: true, Name: true, Code: true } }),
    prisma.section.findMany({ select: { Section_ID: true, Name: true } }),
  ]);

  // 3. Suggest Section_ID
  const matchedSectionId = matchSection(ai.section?.rawTitle, ai.section, sections);

  // 4. Annotate every slot with match suggestions
  const annotatedSlots = ai.slots.map((s, idx) => ({
    index: idx,
    ...s,
    suggestedTeacherId: s.teacher ? matchTeacher(s.teacher, teachers) : null,
    suggestedCourseId: s.course ? matchCourse(s.course, courses) : null,
  }));

  // 5. Build a unique list of names that need admin attention (no auto-match)
  const unmatchedTeachers = [
    ...new Set(
      annotatedSlots
        .filter((s) => s.teacher && !s.suggestedTeacherId)
        .map((s) => s.teacher)
    ),
  ];
  const unmatchedCourses = [
    ...new Set(
      annotatedSlots
        .filter((s) => s.course && !s.suggestedCourseId)
        .map((s) => s.course)
    ),
  ];

  successResponse(
    res,
    {
      extractedSection: {
        ...ai.section,
        suggestedSectionId: matchedSectionId,
      },
      slots: annotatedSlots,
      unmatched: {
        teachers: unmatchedTeachers,
        courses: unmatchedCourses,
      },
      counts: {
        rawSlots: ai.rawSlotCount,
        validSlots: annotatedSlots.length,
      },
      catalog: {
        teachers,
        courses,
        sections,
      },
    },
    'Timetable extracted successfully'
  );
});

/**
 * @route POST /api/slots/import-extracted
 * @desc  Persist admin-confirmed slots. Body shape:
 *        {
 *          sectionId: number,                  // required
 *          slots: [
 *            { day, startTime, endTime, course, teacher, room, isLab,
 *              teacherId?, courseId?, zoneId? }
 *          ],
 *          replaceExisting: boolean            // if true, deletes existing slots
 *                                              // for this section before inserting
 *        }
 */
export const importExtracted = asyncHandler(async (req, res) => {
  const { sectionId, slots, replaceExisting } = req.body || {};

  if (!sectionId || !Number.isInteger(sectionId)) {
    throw new BadRequestError('sectionId is required and must be an integer');
  }
  if (!Array.isArray(slots) || slots.length === 0) {
    throw new BadRequestError('slots must be a non-empty array');
  }

  // Verify section exists
  const section = await prisma.section.findUnique({ where: { Section_ID: sectionId } });
  if (!section) throw new BadRequestError(`Section ${sectionId} not found`);

  // Optional: clear existing slots before importing
  if (replaceExisting) {
    await prisma.timetableSlot.deleteMany({ where: { Section_ID: sectionId } });
  }

  const created = [];
  const skipped = [];

  for (const s of slots) {
    // Validate required fields
    if (!s?.day || !s?.startTime || !s?.endTime || !s?.course) {
      skipped.push({ slot: s, reason: 'missing required fields (day/startTime/endTime/course)' });
      continue;
    }

    try {
      const row = await prisma.timetableSlot.create({
        data: {
          Section_ID:  sectionId,
          Course_ID:   s.courseId  || null,
          Teacher_ID:  s.teacherId || null,
          TeacherName: s.teacher   || null,
          SubjectName: s.course,
          DayOfWeek:   s.day.toUpperCase(),
          StartTime:   s.startTime,
          EndTime:     s.endTime,
          Zone_id:     s.zoneId    || null,
          RoomName:    s.room      || null,
          IsActive:    true,
        },
      });
      created.push(row);
    } catch (err) {
      // Most likely cause: unique constraint (Section_ID, DayOfWeek, StartTime).
      // We treat that as a soft skip rather than aborting the whole batch.
      skipped.push({
        slot: s,
        reason: err.code === 'P2002'
          ? 'duplicate slot (same section/day/start time already exists)'
          : err.message,
      });
    }
  }

  successResponse(
    res,
    { created, skipped, totals: { created: created.length, skipped: skipped.length } },
    `Imported ${created.length} slot(s); skipped ${skipped.length}`
  );
});
