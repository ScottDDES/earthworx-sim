// Words for safety incidents. The engine records which story it was (an index); screens read the words here.
// Keep the order of each list: changing it changes which story a saved career shows.

export const LTI_MACHINES = ['grader', 'roller', 'water cart'] as const;

export const LTI_STORIES = [
  (machine: string) => `rolled an ankle climbing down off the ${machine}`,
  () => 'hurt their shoulder lifting a blade tip',
  () => 'jarred their back when the roller dropped into a washout',
  () => 'caught a hand changing a tyre',
] as const;

export const SERIOUS_STORIES = [
  'was pinned when a water cart rolled back on a slope',
  'came off the grader steps and broke an arm',
  'was hit by a reversing side tipper',
  'had a leg crushed changing a roller drum scraper',
] as const;

export const NEAR_MISS_STORIES = [
  'A side tipper reversed within a metre of the roller operator: no spotter, and the reversing beeper was off.',
  'The water cart nearly rolled on the batter when the driver pulled over for a road train.',
  'A grader blade came down while someone was checking under it.',
  'A ute came through the traffic control at 80 km/h and the controller had to jump clear.',
] as const;

export const QUIET_REPLIES = [
  (n: string) => `${n} opened up a bit. Things are tough at home, and they're glad someone asked.`,
  (n: string) => `${n} said they're right, but thanked you for asking. They seem lighter this week.`,
  (n: string) => `You talked for an hour. ${n} is going to see their GP. Good on them.`,
] as const;
