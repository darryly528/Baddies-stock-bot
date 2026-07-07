// ── Normalization ──────────────────────────────────────────────────────────────

const LEET: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
  "@": "a", "$": "s", "!": "i", "|": "i", "9": "g", "6": "g",
  // Cyrillic/Greek homoglyphs
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x",
  "і": "i", "ї": "i", "ѕ": "s", "ν": "v", "η": "n",
  // Full-width latin
  "ａ":"a","ｂ":"b","ｃ":"c","ｄ":"d","ｅ":"e","ｆ":"f","ｇ":"g","ｈ":"h",
  "ｉ":"i","ｊ":"j","ｋ":"k","ｌ":"l","ｍ":"m","ｎ":"n","ｏ":"o","ｐ":"p",
  "ｑ":"q","ｒ":"r","ｓ":"s","ｔ":"t","ｕ":"u","ｖ":"v","ｗ":"w","ｘ":"x",
  "ｙ":"y","ｚ":"z",
};

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g;
const DIACRITICS_RE = /[\u0300-\u036f]/g;

/** Normalize to plain lowercase ASCII, collapsing leet/unicode bypasses. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(DIACRITICS_RE, "")     // strip accent marks (à→a, ü→u)
    .replace(ZERO_WIDTH_RE, "")     // strip zero-width / invisible chars
    .toLowerCase()
    .split("").map((c) => LEET[c] ?? c).join("")
    .replace(/[^a-z0-9\s]/g, " ")  // keep spaces for phrase matching
    .replace(/(.)\1{3,}/g, "$1$1") // collapse 4+ repeated chars (fuuuuck→fuuck)
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip ALL non-alpha for raw substring checks. */
function strip(text: string): string {
  return normalize(text).replace(/\s/g, "");
}

// ── Word / phrase lists by category ───────────────────────────────────────────

const PROFANITY_WORDS = [
  "fuck","shit","cunt","bastard","motherfucker","asshole","cock","penis","pussy",
  "bitch","prick","twat","wanker","jackass","dumbass","dipshit","bullshit",
  "horseshit","goddamnit","fucker","fuckhead","shithead","asshat","arsehole",
  "arse","dickhead","cuntface","cunty","fuckwit","numbnuts","shitbag",
];

const SEXUAL_WORDS = [
  "porn","porno","pornography","hentai","nsfw","nude","nudes","naked","tits",
  "boobs","boob","titties","nipple","vagina","anal","blowjob","handjob",
  "cumshot","jizz","dildo","vibrator","masturbat","fapping","sexting",
  "onlyfans","stripclub","rapist","molestation","incest","bestiality",
  "pedophil","lolicon","shotacon","childporn",
];

const HATE_WORDS = [
  "nigger","nigga","nig","spic","chink","gook","kike","wetback","beaner",
  "zipperhead","coon","jigaboo","sambo","towelhead","sandnigger","camel jockey",
  "raghead","subhuman","vermin","untermensch",
];

const HOMOPHOBIC_WORDS = [
  "faggot","fag","fagg","dyke","sodomite","buggery",
];

const TRANSPHOBIC_WORDS = [
  "tranny","shemale","trannies","ladyboy",
];

const SEXIST_WORDS = [
  "slut","whore","skank","hoe","bimbo","femoid","roastie","harlot","strumpet",
];

const HARASSMENT_PHRASES = [
  "kill yourself","kill urself","kys","end yourself","end ur life",
  "you should die","i hope you die","go die","nobody likes you",
  "go drink bleach","drink bleach","get cancer","hope you get cancer",
  "worthless piece of","youre pathetic","ur pathetic",
];

const THREAT_PHRASES = [
  "i will kill","ill kill","im going to kill","gonna kill you",
  "will hurt you","im coming for you","you are dead","ur dead",
  "youre dead","watch your back","i know where you live",
  "i know where u live","i will find you","ill find you",
  "shoot you","stab you","i will shoot","i will stab","make you pay",
];

const VIOLENCE_PHRASES = [
  "mass shooting","school shooting","bombing plan","blow up the",
  "detonate","make a bomb","how to kill","how to stab","how to shoot",
  "build a weapon",
];

const SELF_HARM_PHRASES = [
  "cut yourself","cutting myself","slit wrist","slit my wrist",
  "hang yourself","hanging myself","overdose on","suicide method",
  "how to die","want to die","kms","killing myself","jump off a",
  "i want to kill myself","end my life","end my pain",
];

const EXTREMIST_PHRASES = [
  "white power","white supremac","fourteen words","heil hitler",
  "third reich","ku klux klan","blood and soil","jews will not replace",
  "great replacement","racial holy war","neo nazi","neonazi",
];

const SCAM_PHRASES = [
  "free nitro","free robux","free vbucks","free gift card",
  "claim your prize","you have been selected","send me your password",
  "send your password","verify your account","verify your wallet",
  "connect your wallet","send me your ip","send your ip",
  "send nudes","send pics","i will pay you first","limited time offer",
  "act now to claim","you won a","congratulations you","account suspended",
  "confirm your details","your account will be deleted",
  "give me your login","give me your pass","just click this link",
  "click the link below","paypal me first","cashapp me first",
];

const DOXX_PHRASES = [
  "your address is","your ip is","dox you","doxx you","doxxing","doxing",
  "swat you","swatting","your real name is","i found your address",
  "i found where you live",
];

// ── Structural / pattern detectors ────────────────────────────────────────────

const DISCORD_INVITE_RE = /discord\.(gg|com\/invite|li|io)\/[a-zA-Z0-9\-_]+/gi;
const LINK_RE = /https?:\/\/\S+|www\.\S+|\b\S+\.(com|net|org|io|gg|xyz|ru|tk|to|ly|me|co|app|info|biz|link|click|win|shop)\b/gi;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const IP_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
const SSN_RE = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;

/** Detect 4+ repetitions of the same word (spam). */
function hasWordSpam(text: string): boolean {
  const words = text.toLowerCase().split(/\s+/);
  const counts: Record<string, number> = {};
  for (const w of words) {
    if (w.length < 3) continue;
    counts[w] = (counts[w] ?? 0) + 1;
    if (counts[w] >= 4) return true;
  }
  return false;
}

/** Detect 6+ repeated characters (aaaaaaa, !!!!!!). */
const REPEAT_CHAR_RE = /(.)\1{5,}/;

// ── Main export ───────────────────────────────────────────────────────────────

export interface FilterResult {
  clean: boolean;
  reason?: string;
  category?: string;
  filtered: string;
}

export function filterContent(raw: string): FilterResult {
  const text = raw;

  // 1. Discord invite spam (before generic link check)
  if (DISCORD_INVITE_RE.test(text)) {
    DISCORD_INVITE_RE.lastIndex = 0;
    return { clean: false, category: "discord_invite", reason: "Discord invite links are not allowed in DMs.", filtered: text.replace(DISCORD_INVITE_RE, "[invite removed]") };
  }
  DISCORD_INVITE_RE.lastIndex = 0;

  // 2. Advertising / external links
  if (LINK_RE.test(text)) {
    LINK_RE.lastIndex = 0;
    return { clean: false, category: "link", reason: "External links are not allowed in DMs.", filtered: text.replace(LINK_RE, "[link removed]") };
  }
  LINK_RE.lastIndex = 0;

  // 3. Personal information – email
  if (EMAIL_RE.test(text)) {
    EMAIL_RE.lastIndex = 0;
    return { clean: false, category: "doxxing", reason: "Email addresses are not allowed.", filtered: text.replace(EMAIL_RE, "[email removed]") };
  }
  EMAIL_RE.lastIndex = 0;

  // 4. Personal information – phone
  if (PHONE_RE.test(text)) {
    PHONE_RE.lastIndex = 0;
    return { clean: false, category: "doxxing", reason: "Phone numbers are not allowed.", filtered: text.replace(PHONE_RE, "[number removed]") };
  }
  PHONE_RE.lastIndex = 0;

  // 5. Personal information – IP address
  if (IP_RE.test(text)) {
    IP_RE.lastIndex = 0;
    return { clean: false, category: "doxxing", reason: "IP addresses are not allowed.", filtered: text.replace(IP_RE, "[ip removed]") };
  }
  IP_RE.lastIndex = 0;

  // 6. SSN-like numbers
  if (SSN_RE.test(text)) {
    SSN_RE.lastIndex = 0;
    return { clean: false, category: "doxxing", reason: "Sensitive numbers are not allowed.", filtered: "###" };
  }
  SSN_RE.lastIndex = 0;

  // 7. Repeated character spam
  if (REPEAT_CHAR_RE.test(text)) {
    return { clean: false, category: "spam", reason: "Repeated characters detected.", filtered: "###" };
  }

  // 8. Word spam
  if (hasWordSpam(text)) {
    return { clean: false, category: "spam", reason: "Repeated word spam detected.", filtered: "###" };
  }

  // Normalize once for phrase/word list checks
  const norm = normalize(text);  // with spaces
  const flat = strip(text);      // no spaces (catches spaceless bypasses)

  // Helper: check phrases against normalized text
  function matchPhrase(phrases: string[]): string | null {
    const normPhrases = phrases.map((p) => normalize(p));
    for (const p of normPhrases) {
      if (norm.includes(p) || flat.includes(p.replace(/\s/g, ""))) return p;
    }
    return null;
  }

  // Helper: check words (substring of spaceless flat)
  function matchWord(words: string[]): string | null {
    const normWords = words.map((w) => strip(w));
    for (const w of normWords) {
      if (flat.includes(w)) return w;
    }
    return null;
  }

  // 9. Self-harm encouragement (highest priority after structural)
  if (matchPhrase(SELF_HARM_PHRASES)) {
    return { clean: false, category: "self_harm", reason: "Self-harm content is not allowed.", filtered: "###" };
  }

  // 10. Threats
  if (matchPhrase(THREAT_PHRASES)) {
    return { clean: false, category: "threats", reason: "Threatening language is not allowed.", filtered: "###" };
  }

  // 11. Violence
  if (matchPhrase(VIOLENCE_PHRASES)) {
    return { clean: false, category: "violence", reason: "Violent content is not allowed.", filtered: "###" };
  }

  // 12. Harassment
  if (matchPhrase(HARASSMENT_PHRASES)) {
    return { clean: false, category: "harassment", reason: "Harassment is not allowed.", filtered: "###" };
  }

  // 13. Extremist slogans
  if (matchPhrase(EXTREMIST_PHRASES)) {
    return { clean: false, category: "extremism", reason: "Extremist content is not allowed.", filtered: "###" };
  }

  // 14. Scam phrases
  if (matchPhrase(SCAM_PHRASES)) {
    return { clean: false, category: "scam", reason: "Suspected scam content detected.", filtered: "###" };
  }

  // 15. Doxxing phrases
  if (matchPhrase(DOXX_PHRASES)) {
    return { clean: false, category: "doxxing", reason: "Sharing personal information is not allowed.", filtered: "###" };
  }

  // 16. Hate speech
  if (matchWord(HATE_WORDS)) {
    return { clean: false, category: "hate_speech", reason: "Hate speech is not allowed.", filtered: "###" };
  }

  // 17. Homophobic slurs
  if (matchWord(HOMOPHOBIC_WORDS)) {
    return { clean: false, category: "homophobic", reason: "Homophobic language is not allowed.", filtered: "###" };
  }

  // 18. Transphobic slurs
  if (matchWord(TRANSPHOBIC_WORDS)) {
    return { clean: false, category: "transphobic", reason: "Transphobic language is not allowed.", filtered: "###" };
  }

  // 19. Sexist insults
  if (matchWord(SEXIST_WORDS)) {
    return { clean: false, category: "sexist", reason: "Sexist language is not allowed.", filtered: "###" };
  }

  // 20. Sexual language
  if (matchWord(SEXUAL_WORDS)) {
    return { clean: false, category: "sexual", reason: "Sexual content is not allowed.", filtered: "###" };
  }

  // 21. Profanity
  if (matchWord(PROFANITY_WORDS)) {
    return { clean: false, category: "profanity", reason: "Message contains inappropriate language.", filtered: "###" };
  }

  return { clean: true, filtered: raw };
}
