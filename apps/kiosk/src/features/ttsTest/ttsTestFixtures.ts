/**
 * EXPERIMENTAL — canned receptionist test utterances for the Fish S2 Pro
 * TTS evaluation (dev-only, see TTSTestView.tsx). Not shown to patients.
 * Covers the categories requested for this evaluation: English, Malayalam,
 * Manglish/code-switching, hospital terminology, and expressive/prosodic
 * variants — kept natural, professional, and non-theatrical per the
 * evaluation's explicit "not theatrical or overly emotional" requirement.
 */
export interface TTSTestUtterance {
  id: string;
  category: "english" | "malayalam" | "manglish" | "hospital-terms" | "expressive";
  label: string;
  text: string;
}

export const TTS_TEST_UTTERANCES: TTSTestUtterance[] = [
  // English
  { id: "en-greeting", category: "english", label: "Greeting", text: "Hello, how can I help you today?" },
  {
    id: "en-direction",
    category: "english",
    label: "Direction",
    text: "Please proceed to OPD Room 4.",
  },
  { id: "en-token", category: "english", label: "Token", text: "Your token number is 127." },

  // Malayalam — natural hospital-receptionist phrases, not translated English
  {
    id: "ml-greeting",
    category: "malayalam",
    label: "Greeting",
    text: "നമസ്കാരം, ഞാൻ എങ്ങനെ സഹായിക്കാം?",
  },
  {
    id: "ml-direction",
    category: "malayalam",
    label: "Direction",
    text: "ദയവായി ഒ.പി. നാല് ലേക്ക് പോകുക.",
  },
  {
    id: "ml-token",
    category: "malayalam",
    label: "Token",
    text: "നിങ്ങളുടെ ടോക്കൺ നമ്പർ നൂറ്റി ഇരുപത്തിയേഴ് ആണ്.",
  },

  // Manglish / realistic code-switching
  {
    id: "mg-wait",
    category: "manglish",
    label: "Wait time",
    text: "Doctor kurach busy aanu, please 10 minute wait cheyyamo?",
  },
  {
    id: "mg-confirm",
    category: "manglish",
    label: "Confirm details",
    text: "Ningalude token number 127 aanu, OPD room 4 il wait cheyyu.",
  },

  // Hospital terminology stress test — numbers, room/token numbers,
  // appointment times, a doctor name, a patient name, a date
  {
    id: "terms-mixed",
    category: "hospital-terms",
    label: "Appointment details",
    text:
      "Dr. Anjali Menon will see you at 3:30 PM on the 2nd of September. " +
      "Your token number is 45, OPD Room 12.",
  },

  // Expressive / prosodic variants — same underlying meaning, different
  // register, to see if S2 Pro's prosody control produces natural (not
  // theatrical) differences appropriate for a hospital receptionist
  {
    id: "expr-friendly",
    category: "expressive",
    label: "Friendly greeting",
    text: "Hi there! Welcome — how can I help you today?",
  },
  {
    id: "expr-calm",
    category: "expressive",
    label: "Calm explanation",
    text: "The doctor is finishing up with another patient. It won't be long.",
  },
  {
    id: "expr-reassuring",
    category: "expressive",
    label: "Reassuring",
    text: "Don't worry, we have your details. Please have a seat, and we'll call your token number.",
  },
  {
    id: "expr-clarify",
    category: "expressive",
    label: "Polite clarification",
    text: "Sorry, could you say your name again? I want to make sure I get it right.",
  },
  {
    id: "expr-urgency",
    category: "expressive",
    label: "Slight urgency",
    text: "Please head to Room 4 now — the doctor is ready for you.",
  },
];
