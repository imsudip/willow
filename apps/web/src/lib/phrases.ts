/** Gentle filler phrases shown while recording, rotated to keep the user flowing. */
export const RECORDING_PHRASES = [
  "Keep going…",
  "I'm listening…",
  "No rush. Take your time.",
  "This is your space.",
  "Say it however it comes out.",
  "You're doing great.",
  "Let it all out.",
  "I'm right here.",
  "One thought at a time.",
  "There's no wrong way to ramble.",
] as const;

/** Quirky lines shown while the audio uploads and transcribes. */
export const PROCESSING_PHRASES = [
  "Let me process your thoughts…",
  "Gathering the threads of your day…",
  "Untangling your words…",
  "Polishing your ramble…",
  "Turning noise into a story…",
  "Let me get back to you on this…",
  "Weaving your sentences together…",
  "Brushing the dust off your words…",
  "Sewing the loose ends…",
  "Almost there…",
] as const;

/** Quirky lines shown during the AI cleanup step. */
export const CLEANING_PHRASES = [
  "Making sense of it all…",
  "Finding the heart of your day…",
  "Picking out the important bits…",
  "Naming what you felt…",
  "Giving your day a title…",
  "Tidying up your thoughts…",
  "Choosing the words that matter…",
] as const;

export function pickPhrase(list: readonly string[]) {
  return list[Math.floor(Math.random() * list.length)];
}
