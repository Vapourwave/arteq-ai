// Reproducible Malayalam/Manglish/mixed/hospital test set for the Fish
// Speech S2 Pro (open-source) evaluation. Kept as a standalone data module
// so a future local-inference harness (run on a real GPU machine) can
// import it directly without duplicating the sentence list.
//
// Not runnable on its own — see README.md §4/§6 for why local inference
// isn't possible on the current machine yet.

export const TEST_SENTENCES = [
  {
    id: "critical-dental-v1",
    category: "critical — matches Gemini testing phrase",
    text: "എനിക്ക് നല്ല പല്ലുവേദനയുണ്ട്. എനിക്ക് ഡെന്റിസ്റ്റിനെ കാണണം.",
  },
  {
    id: "critical-dental-v2",
    category: "critical — space-before-വേദന variant",
    text: "എനിക്ക് നല്ല പല്ല് വേദനയുണ്ട്. എനിക്ക് ഡെന്റിസ്റ്റിനെ കാണണം.",
  },
  { id: "ml-short", category: "Malayalam — short", text: "എനിക്ക് ഡോക്ടറെ കാണണം." },
  {
    id: "ml-long",
    category: "Malayalam — long",
    text:
      "ദയവായി ക്ഷമിക്കണം, നിങ്ങൾ പറഞ്ഞ ലക്ഷണങ്ങൾ അനുസരിച്ച് ഞാൻ നിങ്ങളെ ദന്തരോഗ വിഭാഗത്തിലേക്ക് നയിക്കുകയാണ്, അവിടെ ഡോക്ടർ നിങ്ങളെ പരിശോധിച്ച ശേഷം അടുത്ത ഘട്ടം തീരുമാനിക്കും.",
  },
  { id: "ml-question", category: "Malayalam — question", text: "എനിക്ക് ഏത് ഡിപ്പാർട്ട്മെന്റിലേക്കാണ് പോകേണ്ടത്?" },
  { id: "ml-confirmation", category: "Malayalam — confirmation", text: "ശരി, നിങ്ങൾ തിരഞ്ഞെടുത്ത ഡോക്ടറുടെ ഓ.പി ടിക്കറ്റ് എടുക്കാം." },
  { id: "ml-doctor-name", category: "Malayalam — doctor name", text: "ഡോക്ടർ അഞ്ജലി മേനോൻ ഇന്ന് ലഭ്യമാണ്." },
  { id: "ml-department-name", category: "Malayalam — department name", text: "ദന്തരോഗ വിഭാഗം ഒന്നാം നിലയിലാണ്." },
  { id: "ml-numbers", category: "Malayalam — numbers/times", text: "നിങ്ങളുടെ ക്യൂ നമ്പർ പതിനഞ്ച് ആണ്. ഏകദേശം ഇരുപത് മിനിറ്റ് കാത്തിരിക്കണം." },

  { id: "manglish-1", category: "Manglish", text: "Enikku tooth pain aanu." },
  { id: "manglish-2", category: "Manglish", text: "Doctorine kaananam." },
  { id: "manglish-3", category: "Manglish", text: "Enikku tooth pain undu, doctorine kaananam." },

  { id: "mixed-1", category: "Malayalam + English mixed", text: "എനിക്ക് dentist-നെ കാണണം." },
  { id: "mixed-2", category: "Malayalam + English mixed", text: "എനിക്ക് dental department-ലേക്ക് പോകണം." },
  { id: "mixed-3", category: "Malayalam + English mixed", text: "നാളെ രാവിലെ doctor available ആണോ?" },
  { id: "mixed-4", category: "Malayalam + English mixed", text: "എനിക്ക് OP ticket വേണം." },

  { id: "en-1", category: "English — hospital", text: "Please wait while I check the doctor's availability." },
  { id: "en-2", category: "English — hospital", text: "Your token number is 127, OPD Room 4." },
  { id: "en-3", category: "English — receptionist", text: "Hello, how can I help you today?" },
];
