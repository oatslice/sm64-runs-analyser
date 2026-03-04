/**
 * segmentOffsets.js
 *
 * Maps named star collections to segments in a loaded .lss file,
 * with a fixed time offset (seconds) to add to the collection's
 * convolved time to make it directly comparable to the real split.
 *
 * The offset accounts for time that appears in the .lss segment but
 * is NOT captured by the star timer â€” e.g. castle transitions,
 * loading zones, menu time, movement between stars.
 *
 * HOW TO USE:
 *   1. Note the exact segment name as it appears in your .lss file.
 *   2. Time the fixed overhead not covered by individual star attempts.
 *   3. Add an entry below.
 *
 * The "collectionId" key must exactly match the collection name the
 * user creates in the Star Timer tool.
 *
 * FORMAT:
 * {
 *   [collectionId]: {
 *     lssSegment:    string   â€” segment name in the .lss file (exact match)
 *     offsetSeconds: number   â€” seconds to add to collection convolved time
 *     notes:         string   â€” human-readable description of what the offset covers
 *   }
 * }
 */

export const SEGMENT_OFFSETS = {
  // â”€â”€ Example entries (replace / add your own) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // "Bob-omb Battlefield": {
  //   lssSegment:    "BoB",
  //   offsetSeconds: 14.2,
  //   notes:         "Castle transition + star select screen + course entry",
  // },

  // "Bowser 1": {
  //   lssSegment:    "BitDW",
  //   offsetSeconds: 8.5,
  //   notes:         "Basement door + staircase + course entry",
  // },
}
