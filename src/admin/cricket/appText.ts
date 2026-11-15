import { useCallback } from "react";
import type { Lang } from "./i18n";
import { useScorerPrefs } from "./matches/scorerPrefs";

// The app's own words in the languages the scoring pad speaks (i18n.ts):
// the menus, tabs, statuses and screen titles. Looked up by their English,
// so the shared pieces (PageHeader, ListCard, BottomSheet, HomeSection, the
// menus and tabs) translate whatever they're given, and anything not listed
// here, such as a team's name, stays as it is. Cricket words are kept as
// players say them (स्कोरकार्ड, ಸ್ಕ್ವಾಡ್), as on the pad.
//
// Not yet proofread by a native speaker of each language: worth a look
// before leaning on them.

type Row = Partial<Record<Exclude<Lang, "en">, string>>;

const APP_TEXT: Record<string, Row> = {
  // Menus
  Home: { hi: "होम", kn: "ಮುಖಪುಟ", ta: "முகப்பு", te: "హోమ్" },
  Tournaments: { hi: "टूर्नामेंट", kn: "ಟೂರ್ನಮೆಂಟ್‌ಗಳು", ta: "தொடர்கள்", te: "టోర్నమెంట్లు" },
  Matches: { hi: "मैच", kn: "ಪಂದ್ಯಗಳು", ta: "போட்டிகள்", te: "మ్యాచ్‌లు" },
  Players: { hi: "खिलाड़ी", kn: "ಆಟಗಾರರು", ta: "வீரர்கள்", te: "ఆటగాళ్లు" },
  "My Teams": { hi: "मेरी टीमें", kn: "ನನ್ನ ತಂಡಗಳು", ta: "என் அணிகள்", te: "నా జట్లు" },
  "My Stats": { hi: "मेरे आँकड़े", kn: "ನನ್ನ ಅಂಕಿಅಂಶ", ta: "என் புள்ளிவிவரம்", te: "నా గణాంకాలు" },
  "My Cricket": { hi: "मेरा क्रिकेट", kn: "ನನ್ನ ಕ್ರಿಕೆಟ್", ta: "என் கிரிக்கெட்", te: "నా క్రికెట్" },
  "My Matches": { hi: "मेरे मैच", kn: "ನನ್ನ ಪಂದ್ಯಗಳು", ta: "என் போட்டிகள்", te: "నా మ్యాచ్‌లు" },
  "My Tournaments": { hi: "मेरे टूर्नामेंट", kn: "ನನ್ನ ಟೂರ್ನಮೆಂಟ್‌ಗಳು", ta: "என் தொடர்கள்", te: "నా టోర్నమెంట్లు" },
  Following: { hi: "फ़ॉलो कर रहे", kn: "ಫಾಲೋ ಮಾಡುತ್ತಿರುವವು", ta: "பின்தொடர்பவை", te: "ఫాలో అవుతున్నవి" },
  Manage: { hi: "प्रबंधन", kn: "ನಿರ್ವಹಣೆ", ta: "நிர்வாகம்", te: "నిర్వహణ" },
  Dashboard: { hi: "डैशबोर्ड", kn: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್", ta: "டாஷ்போர்டு", te: "డాష్‌బోర్డ్" },
  Leaderboard: { hi: "लीडरबोर्ड", kn: "ಲೀಡರ್‌ಬೋರ್ಡ್", ta: "முன்னணிப் பட்டியல்", te: "లీడర్‌బోర్డ్" },
  Database: { hi: "डेटाबेस", kn: "ಡೇಟಾಬೇಸ್", ta: "தரவுத்தளம்", te: "డేటాబేస్" },
  More: { hi: "और", kn: "ಇನ್ನಷ್ಟು", ta: "மேலும்", te: "మరిన్ని" },

  // Match tabs
  Info: { hi: "जानकारी", kn: "ಮಾಹಿತಿ", ta: "தகவல்", te: "సమాచారం" },
  Live: { hi: "लाइव", kn: "ಲೈವ್", ta: "நேரலை", te: "లైవ్" },
  Summary: { hi: "सारांश", kn: "ಸಾರಾಂಶ", ta: "சுருக்கம்", te: "సారాంశం" },
  Scorecard: { hi: "स्कोरकार्ड", kn: "ಸ್ಕೋರ್‌ಕಾರ್ಡ್", ta: "ஸ்கோர்கார்டு", te: "స్కోర్‌కార్డ్" },
  Commentary: { hi: "कमेंट्री", kn: "ಕಾಮೆಂಟರಿ", ta: "வர்ணனை", te: "కామెంటరీ" },
  Insights: { hi: "विश्लेषण", kn: "ವಿಶ್ಲೇಷಣೆ", ta: "பகுப்பாய்வு", te: "విశ్లేషణ" },
  Overs: { hi: "ओवर", kn: "ಓವರ್‌ಗಳು", ta: "ஓவர்கள்", te: "ఓవర్లు" },
  Squads: { hi: "स्क्वॉड", kn: "ಸ್ಕ್ವಾಡ್", ta: "அணி வீரர்கள்", te: "స్క్వాడ్" },
  MVP: { hi: "MVP", kn: "MVP", ta: "MVP", te: "MVP" },
  Heroes: { hi: "हीरो", kn: "ಹೀರೋಗಳು", ta: "நாயகர்கள்", te: "హీరోలు" },

  // Tournament tabs
  Profile: { hi: "प्रोफ़ाइल", kn: "ಪ್ರೊಫೈಲ್", ta: "விவரம்", te: "ప్రొఫైల్" },
  Teams: { hi: "टीमें", kn: "ತಂಡಗಳು", ta: "அணிகள்", te: "జట్లు" },
  Auction: { hi: "नीलामी", kn: "ಹರಾಜು", ta: "ஏலம்", te: "వేలం" },
  "Points Table": { hi: "अंक तालिका", kn: "ಅಂಕಪಟ್ಟಿ", ta: "புள்ளிப் பட்டியல்", te: "పాయింట్ల పట్టిక" },
  Stats: { hi: "आँकड़े", kn: "ಅಂಕಿಅಂಶ", ta: "புள்ளிவிவரம்", te: "గణాంకాలు" },

  // Match status
  Upcoming: { hi: "आगामी", kn: "ಮುಂಬರುವ", ta: "வரவிருக்கும்", te: "రాబోయే" },
  Completed: { hi: "समाप्त", kn: "ಮುಗಿದಿದೆ", ta: "முடிந்தது", te: "ముగిసింది" },
  Abandoned: { hi: "रद्द", kn: "ರದ್ದಾಗಿದೆ", ta: "கைவிடப்பட்டது", te: "రద్దయింది" },

  // Screens and sections
  Team: { hi: "टीम", kn: "ತಂಡ", ta: "அணி", te: "జట్టు" },
  Tournament: { hi: "टूर्नामेंट", kn: "ಟೂರ್ನಮೆಂಟ್", ta: "தொடர்", te: "టోర్నమెంట్" },
  Match: { hi: "मैच", kn: "ಪಂದ್ಯ", ta: "போட்டி", te: "మ్యాచ్" },
  Series: { hi: "सीरीज़", kn: "ಸರಣಿ", ta: "தொடர் வரிசை", te: "సిరీస్" },
  "Live Scoring": { hi: "लाइव स्कोरिंग", kn: "ಲೈವ್ ಸ್ಕೋರಿಂಗ್", ta: "நேரலை ஸ்கோரிங்", te: "లైవ్ స్కోరింగ్" },
  "Live now": { hi: "अभी लाइव", kn: "ಈಗ ಲೈವ್", ta: "இப்போது நேரலை", te: "ఇప్పుడు లైవ్" },
  "Up next": { hi: "आगे", kn: "ಮುಂದಿನದು", ta: "அடுத்து", te: "తర్వాత" },
  "Your last match": { hi: "आपका पिछला मैच", kn: "ನಿಮ್ಮ ಹಿಂದಿನ ಪಂದ್ಯ", ta: "உங்கள் கடைசி போட்டி", te: "మీ చివరి మ్యాచ్" },
  "Your tournaments": { hi: "आपके टूर्नामेंट", kn: "ನಿಮ್ಮ ಟೂರ್ನಮೆಂಟ್‌ಗಳು", ta: "உங்கள் தொடர்கள்", te: "మీ టోర్నమెంట్లు" },
  "Players you follow": { hi: "जिन खिलाड़ियों को आप फ़ॉलो करते हैं", kn: "ನೀವು ಫಾಲೋ ಮಾಡುವ ಆಟಗಾರರು", ta: "நீங்கள் பின்தொடரும் வீரர்கள்", te: "మీరు ఫాలో అయ్యే ఆటగాళ్లు" },
  "Recent results": { hi: "हाल के नतीजे", kn: "ಇತ್ತೀಚಿನ ಫಲಿತಾಂಶಗಳು", ta: "சமீபத்திய முடிவுகள்", te: "ఇటీవలి ఫలితాలు" },
  "Start Match": { hi: "मैच शुरू करें", kn: "ಪಂದ್ಯ ಆರಂಭಿಸಿ", ta: "போட்டியைத் தொடங்கு", te: "మ్యాచ్ ప్రారంభించండి" },
  "New Match": { hi: "नया मैच", kn: "ಹೊಸ ಪಂದ್ಯ", ta: "புதிய போட்டி", te: "కొత్త మ్యాచ్" },
  "New Tournament": { hi: "नया टूर्नामेंट", kn: "ಹೊಸ ಟೂರ್ನಮೆಂಟ್", ta: "புதிய தொடர்", te: "కొత్త టోర్నమెంట్" },
  "Edit Tournament": { hi: "टूर्नामेंट बदलें", kn: "ಟೂರ್ನಮೆಂಟ್ ತಿದ್ದಿ", ta: "தொடரைத் திருத்து", te: "టోర్నమెంట్ మార్చండి" },
  "New Team": { hi: "नई टीम", kn: "ಹೊಸ ತಂಡ", ta: "புதிய அணி", te: "కొత్త జట్టు" },
  "Edit Team": { hi: "टीम बदलें", kn: "ತಂಡ ತಿದ್ದಿ", ta: "அணியைத் திருத்து", te: "జట్టు మార్చండి" },
  "Join Team": { hi: "टीम से जुड़ें", kn: "ತಂಡ ಸೇರಿ", ta: "அணியில் சேர்", te: "జట్టులో చేరండి" },
  "Add Teams": { hi: "टीमें जोड़ें", kn: "ತಂಡಗಳನ್ನು ಸೇರಿಸಿ", ta: "அணிகளைச் சேர்", te: "జట్లను జోడించండి" },
  "Create Teams": { hi: "टीमें बनाएँ", kn: "ತಂಡಗಳನ್ನು ರಚಿಸಿ", ta: "அணிகளை உருவாக்கு", te: "జట్లు సృష్టించండి" },
  "Tournament Format": { hi: "टूर्नामेंट का प्रारूप", kn: "ಟೂರ್ನಮೆಂಟ್ ಮಾದರಿ", ta: "தொடர் வடிவம்", te: "టోర్నమెంట్ ఫార్మాట్" },
  "My Profile": { hi: "मेरी प्रोफ़ाइल", kn: "ನನ್ನ ಪ್ರೊಫೈಲ್", ta: "என் விவரம்", te: "నా ప్రొఫైల్" },
  "Player Profile": { hi: "खिलाड़ी की प्रोफ़ाइल", kn: "ಆಟಗಾರರ ಪ್ರೊಫೈಲ್", ta: "வீரர் விவரம்", te: "ఆటగాడి ప్రొఫైల్" },
  "Match settings": { hi: "मैच सेटिंग्स", kn: "ಪಂದ್ಯದ ಸೆಟ್ಟಿಂಗ್‌ಗಳು", ta: "போட்டி அமைப்புகள்", te: "మ్యాచ్ సెట్టింగ్‌లు" },
  "Manage squads": { hi: "स्क्वॉड प्रबंधन", kn: "ಸ್ಕ್ವಾಡ್ ನಿರ್ವಹಣೆ", ta: "அணி வீரர்களை நிர்வகி", te: "స్క్వాడ్ నిర్వహణ" },
  "Change bowler": { hi: "गेंदबाज़ बदलें", kn: "ಬೌಲರ್ ಬದಲಿಸಿ", ta: "பந்துவீச்சாளரை மாற்று", te: "బౌలర్‌ను మార్చండి" },
  "Change batter": { hi: "बल्लेबाज़ बदलें", kn: "ಬ್ಯಾಟರ್ ಬದಲಿಸಿ", ta: "பேட்டரை மாற்று", te: "బ్యాటర్‌ను మార్చండి" },
  "Correct a ball": { hi: "गेंद सुधारें", kn: "ಎಸೆತ ಸರಿಪಡಿಸಿ", ta: "பந்தைத் திருத்து", te: "బంతిని సరిదిద్దండి" },
  "End the match?": { hi: "मैच ख़त्म करें?", kn: "ಪಂದ್ಯ ಮುಗಿಸುವುದೇ?", ta: "போட்டியை முடிக்கவா?", te: "మ్యాచ్ ముగించాలా?" },
  "Leave this match?": { hi: "यह मैच छोड़ें?", kn: "ಈ ಪಂದ್ಯ ಬಿಡುವುದೇ?", ta: "இந்தப் போட்டியை விட்டு வெளியேறவா?", te: "ఈ మ్యాచ్ వదిలేయాలా?" },
  "Where did it pitch?": { hi: "गेंद कहाँ पड़ी?", kn: "ಚೆಂಡು ಎಲ್ಲಿ ಬಿತ್ತು?", ta: "பந்து எங்கே விழுந்தது?", te: "బంతి ఎక్కడ పడింది?" },
  "Net run rate": { hi: "नेट रन रेट", kn: "ನೆಟ್ ರನ್ ರೇಟ್", ta: "நிகர ரன் விகிதம்", te: "నెట్ రన్ రేట్" },
  "My QR Code": { hi: "मेरा QR कोड", kn: "ನನ್ನ QR ಕೋಡ್", ta: "என் QR குறியீடு", te: "నా QR కోడ్" },
  "Team QR Code": { hi: "टीम QR कोड", kn: "ತಂಡದ QR ಕೋಡ್", ta: "அணி QR குறியீடு", te: "జట్టు QR కోడ్" },
  Search: { hi: "खोजें", kn: "ಹುಡುಕಿ", ta: "தேடு", te: "వెతకండి" },
  Account: { hi: "खाता", kn: "ಖಾತೆ", ta: "கணக்கு", te: "ఖాతా" },
  Roster: { hi: "खिलाड़ी सूची", kn: "ಆಟಗಾರರ ಪಟ್ಟಿ", ta: "வீரர் பட்டியல்", te: "ఆటగాళ్ల జాబితా" },
  Create: { hi: "बनाएँ", kn: "ರಚಿಸಿ", ta: "உருவாக்கு", te: "సృష్టించండి" },
  Play: { hi: "खेलें", kn: "ಆಡಿ", ta: "விளையாடு", te: "ఆడండి" },
  Stage: { hi: "चरण", kn: "ಹಂತ", ta: "கட்டம்", te: "దశ" },
  "Fixtures, live games and results": {
    hi: "शेड्यूल, लाइव मैच और नतीजे",
    kn: "ವೇಳಾಪಟ್ಟಿ, ಲೈವ್ ಪಂದ್ಯಗಳು ಮತ್ತು ಫಲಿತಾಂಶಗಳು",
    ta: "அட்டவணை, நேரலைப் போட்டிகள், முடிவுகள்",
    te: "షెడ్యూల్, లైవ్ మ్యాచ్‌లు, ఫలితాలు",
  },
  "Leagues and cups, from the draw to the final": {
    hi: "लीग और कप, ड्रॉ से फ़ाइनल तक",
    kn: "ಲೀಗ್ ಮತ್ತು ಕಪ್‌ಗಳು, ಡ್ರಾದಿಂದ ಫೈನಲ್‌ವರೆಗೆ",
    ta: "லீக் மற்றும் கோப்பைகள், குலுக்கல் முதல் இறுதி வரை",
    te: "లీగ్‌లు, కప్‌లు — డ్రా నుండి ఫైనల్ వరకు",
  },
  "Top run-scorers, wicket-takers and award winners": {
    hi: "सबसे ज़्यादा रन, विकेट और अवॉर्ड",
    kn: "ಹೆಚ್ಚು ರನ್, ವಿಕೆಟ್ ಮತ್ತು ಪ್ರಶಸ್ತಿ ಪಡೆದವರು",
    ta: "அதிக ரன், விக்கெட், விருது பெற்றவர்கள்",
    te: "ఎక్కువ రన్లు, వికెట్లు, అవార్డులు",
  },
  "Everyone on the roster, and who can sign in": {
    hi: "सूची के सभी खिलाड़ी, और कौन साइन इन कर सकता है",
    kn: "ಪಟ್ಟಿಯಲ್ಲಿರುವ ಎಲ್ಲರೂ, ಮತ್ತು ಯಾರು ಸೈನ್ ಇನ್ ಮಾಡಬಹುದು",
    ta: "பட்டியலில் உள்ள அனைவரும், யார் உள்நுழையலாம்",
    te: "జాబితాలోని అందరూ, ఎవరు సైన్ ఇన్ చేయగలరు",
  },
  "Players, tournaments and matches at a glance": {
    hi: "खिलाड़ी, टूर्नामेंट और मैच एक नज़र में",
    kn: "ಆಟಗಾರರು, ಟೂರ್ನಮೆಂಟ್‌ಗಳು ಮತ್ತು ಪಂದ್ಯಗಳು ಒಂದೇ ನೋಟದಲ್ಲಿ",
    ta: "வீரர்கள், தொடர்கள், போட்டிகள் ஒரே பார்வையில்",
    te: "ఆటగాళ్లు, టోర్నమెంట్లు, మ్యాచ్‌లు ఒక్క చూపులో",
  },
};

// The app's text in this language: its translation if there is one, else
// as given (English, or a name).
export function appText(text: string, lang: Lang) {
  if (lang === "en") return text;
  return APP_TEXT[text]?.[lang] ?? text;
}

// For components: tr("Matches") in the chosen language (the Language
// setting, shared with the scoring pad and the spoken calls).
export function useAppText() {
  const { lang } = useScorerPrefs();
  return useCallback((text: string) => appText(text, lang), [lang]);
}

// Only strings are looked up; anything else (a heading with a badge in it)
// is left as it is.
export function useAppNode() {
  const tr = useAppText();
  return useCallback(<T,>(node: T): T => (typeof node === "string" ? (tr(node) as T) : node), [tr]);
}

// Every phrase has all four translations (tested).
export const APP_TEXT_ROWS = APP_TEXT;
