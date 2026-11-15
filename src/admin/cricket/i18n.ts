// The scoring pad and the spoken calls in Indian languages. Cricket words
// are kept as players say them (ವೈಡ್, नो बॉल) rather than formal coinages.
// Only the pad, the scorer's voice and listening options are covered so
// far; everything else stays in English. Add a language by adding a column.

export const LANGS = [
  { value: "en", label: "English", speech: "en-IN" },
  { value: "hi", label: "हिन्दी (Hindi)", speech: "hi-IN" },
  { value: "kn", label: "ಕನ್ನಡ (Kannada)", speech: "kn-IN" },
  { value: "ta", label: "தமிழ் (Tamil)", speech: "ta-IN" },
  { value: "te", label: "తెలుగు (Telugu)", speech: "te-IN" },
] as const;
export type Lang = (typeof LANGS)[number]["value"];

const STRINGS = {
  four: { en: "Four", hi: "चौका", kn: "ಫೋರ್", ta: "ஃபோர்", te: "ఫోర్" },
  six: { en: "Six", hi: "छक्का", kn: "ಸಿಕ್ಸ್", ta: "சிக்ஸ்", te: "సిక్స్" },
  dot: { en: "Dot", hi: "डॉट", kn: "ಡಾಟ್", ta: "டாட்", te: "డాట్" },
  wide: { en: "Wide", hi: "वाइड", kn: "ವೈಡ್", ta: "வைடு", te: "వైడ్" },
  "no-ball": { en: "No ball", hi: "नो बॉल", kn: "ನೋ ಬಾಲ್", ta: "நோ பால்", te: "నో బాల్" },
  bye: { en: "Bye", hi: "बाई", kn: "ಬೈ", ta: "பை", te: "బై" },
  "leg-bye": { en: "Leg bye", hi: "लेग बाई", kn: "ಲೆಗ್ ಬೈ", ta: "லெக் பை", te: "లెగ్ బై" },
  penalty: { en: "Penalty", hi: "पेनल्टी", kn: "ಪೆನಾಲ್ಟಿ", ta: "பெனால்டி", te: "పెనాల్టీ" },
  undo: { en: "Undo", hi: "वापस", kn: "ರದ್ದು", ta: "திரும்ப", te: "రద్దు" },
  out: { en: "Out", hi: "आउट", kn: "ಔಟ್", ta: "அவுட்", te: "ఔట్" },
  moreRuns: { en: "5, 6…", hi: "5, 6…", kn: "5, 6…", ta: "5, 6…", te: "5, 6…" },
  bowlingOn: {
    en: "Viewers see the bowler running in",
    hi: "दर्शक गेंदबाज़ को दौड़ते देख रहे हैं",
    kn: "ವೀಕ್ಷಕರಿಗೆ ಬೌಲರ್ ಓಡಿ ಬರುತ್ತಿರುವುದು ಕಾಣುತ್ತಿದೆ",
    ta: "பந்துவீச்சாளர் ஓடி வருவது பார்வையாளர்களுக்குத் தெரிகிறது",
    te: "బౌలర్ పరుగెత్తుకు రావడం ప్రేక్షకులకు కనిపిస్తోంది",
  },
  bowlingOff: {
    en: "Bowling — show viewers",
    hi: "गेंदबाज़ी — दर्शकों को दिखाएँ",
    kn: "ಬೌಲಿಂಗ್ — ವೀಕ್ಷಕರಿಗೆ ತೋರಿಸಿ",
    ta: "பந்துவீச்சு — பார்வையாளர்களுக்குக் காட்டு",
    te: "బౌలింగ్ — ప్రేక్షకులకు చూపించు",
  },
} satisfies Record<string, Record<Lang, string>>;

export type StringKey = keyof typeof STRINGS;

export const t = (key: StringKey, lang: Lang) => STRINGS[key][lang] ?? STRINGS[key].en;

// ===== Spoken calls =====

type Call = {
  runs: (n: number) => string;
  dot: string;
  four: string;
  six: string;
  out: (name: string) => string;
  score: (runs: number, wickets: number) => string;
  fifty: (name: string) => string;
  hundred: (name: string) => string;
  hatTrick: (name: string) => string;
  onHatTrick: (name: string) => string;
  fiveFor: (name: string) => string;
};

export const CALLS: Record<Lang, Call> = {
  en: {
    runs: (n) => (n === 1 ? "One run" : `${n} runs`),
    dot: "Dot ball",
    four: "Four!",
    six: "Six!",
    out: (name) => `Out! ${name}`,
    score: (r, w) => `${r} for ${w}`,
    fifty: (name) => `Fifty for ${name}!`,
    hundred: (name) => `Hundred for ${name}!`,
    hatTrick: (name) => `Hat-trick for ${name}!`,
    onHatTrick: (name) => `${name} is on a hat-trick`,
    fiveFor: (name) => `Five wickets for ${name}!`,
  },
  hi: {
    runs: (n) => (n === 1 ? "एक रन" : `${n} रन`),
    dot: "डॉट बॉल",
    four: "चौका!",
    six: "छक्का!",
    out: (name) => `आउट! ${name}`,
    score: (r, w) => `${r} रन पर ${w} विकेट`,
    fifty: (name) => `${name} का अर्धशतक!`,
    hundred: (name) => `${name} का शतक!`,
    hatTrick: (name) => `${name} की हैट्रिक!`,
    onHatTrick: (name) => `${name} हैट्रिक पर हैं`,
    fiveFor: (name) => `${name} के पाँच विकेट!`,
  },
  kn: {
    runs: (n) => (n === 1 ? "ಒಂದು ರನ್" : `${n} ರನ್`),
    dot: "ಡಾಟ್ ಬಾಲ್",
    four: "ಫೋರ್!",
    six: "ಸಿಕ್ಸ್!",
    out: (name) => `ಔಟ್! ${name}`,
    score: (r, w) => `${w} ವಿಕೆಟ್‌ಗೆ ${r} ರನ್`,
    fifty: (name) => `${name} ಅರ್ಧಶತಕ!`,
    hundred: (name) => `${name} ಶತಕ!`,
    hatTrick: (name) => `${name} ಹ್ಯಾಟ್ರಿಕ್!`,
    onHatTrick: (name) => `${name} ಹ್ಯಾಟ್ರಿಕ್ ಹಾದಿಯಲ್ಲಿ`,
    fiveFor: (name) => `${name} ಐದು ವಿಕೆಟ್!`,
  },
  ta: {
    runs: (n) => (n === 1 ? "ஒரு ரன்" : `${n} ரன்கள்`),
    dot: "டாட் பால்",
    four: "ஃபோர்!",
    six: "சிக்ஸ்!",
    out: (name) => `அவுட்! ${name}`,
    score: (r, w) => `${w} விக்கெட்டுக்கு ${r} ரன்கள்`,
    fifty: (name) => `${name} அரைசதம்!`,
    hundred: (name) => `${name} சதம்!`,
    hatTrick: (name) => `${name} ஹாட்ரிக்!`,
    onHatTrick: (name) => `${name} ஹாட்ரிக் வாய்ப்பில்`,
    fiveFor: (name) => `${name} ஐந்து விக்கெட்டுகள்!`,
  },
  te: {
    runs: (n) => (n === 1 ? "ఒక పరుగు" : `${n} పరుగులు`),
    dot: "డాట్ బాల్",
    four: "ఫోర్!",
    six: "సిక్స్!",
    out: (name) => `ఔట్! ${name}`,
    score: (r, w) => `${w} వికెట్లకు ${r} పరుగులు`,
    fifty: (name) => `${name} అర్ధ సెంచరీ!`,
    hundred: (name) => `${name} సెంచరీ!`,
    hatTrick: (name) => `${name} హ్యాట్రిక్!`,
    onHatTrick: (name) => `${name} హ్యాట్రిక్ అవకాశంలో`,
    fiveFor: (name) => `${name} ఐదు వికెట్లు!`,
  },
};
