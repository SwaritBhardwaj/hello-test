/**
 * Coach v2 feature switches.
 *
 * Each flag gates one self-contained enhancement; flip it to `false` to fall
 * back to the exact previous behavior. No other code changes needed.
 */
export const COACH_FLAGS = {
  /** Coach peeks over the open card and delivers the note as a speech bubble.
   *  Off: the note renders as the previous inline green box. */
  peekOverCard: true,
  /** Extra sprite reactions: payday result + freedom milestones (25/50/75%).
   *  Off: only achievement/bankruptcy moods, as before. */
  extraReactions: true,
  /** Soft pop sound when a speech bubble appears. Off: silent bubbles. */
  bubbleSound: true,
  /** Coach appears in the outcome screen header (celebrate on win, facepalm
   *  on bankruptcy). Off: the previous plain ★ / ✖ glyph. */
  outcomePresence: true,
  /** The illustrated "Buddy" character is available (and default) in the
   *  style picker. Off: coin/owl only, as before. */
  characterArtV2: true,
  /** Coach steps in front of repeat mistakes (panic-sell, borrow-for-doodad,
   *  CC bailout, peak FOMO buy) and asks for one confirming tap.
   *  Off: buttons act immediately, as before. */
  interventions: true,
  /** Record (before, after) snapshots of debatable decisions and show a
   *  "what if" coach debrief on the outcome screen. Off: no debrief. */
  counterfactuals: true,
} as const;
