const BAD_WORDS = [
  "fuck","shit","ass","bitch","cunt","dick","cock","pussy","nigger","nigga",
  "faggot","fag","slut","whore","bastard","motherfucker","retard","rape",
  "pedo","pedophile","kys","killurself","killyourself",
];

const LEET: Record<string,string> = {
  "0":"o","1":"i","3":"e","4":"a","5":"s","7":"t","8":"b","@":"a",
  "$":"s","!":"i","|":"i","9":"g","6":"g",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((c) => LEET[c] ?? c)
    .join("")
    .replace(/[^a-z0-9]/g, "");
}

const BAD_NORMALIZED = BAD_WORDS.map(normalize);

const LINK_RE = /https?:\/\/\S+|www\.\S+|\S+\.(com|net|org|io|gg|xyz|ru|tk|to)\b/gi;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

export interface FilterResult {
  clean: boolean;
  reason?: string;
  filtered: string;
}

export function filterContent(text: string): FilterResult {
  if (LINK_RE.test(text)) {
    return { clean: false, reason: "Links are not allowed.", filtered: text.replace(LINK_RE, "[link removed]") };
  }
  if (EMAIL_RE.test(text)) {
    return { clean: false, reason: "Email addresses are not allowed.", filtered: text.replace(EMAIL_RE, "[email removed]") };
  }
  if (PHONE_RE.test(text)) {
    return { clean: false, reason: "Phone numbers are not allowed.", filtered: text.replace(PHONE_RE, "[number removed]") };
  }

  const norm = normalize(text);
  for (const bad of BAD_NORMALIZED) {
    if (norm.includes(bad)) {
      return { clean: false, reason: "Message contains inappropriate language.", filtered: "###" };
    }
  }

  return { clean: true, filtered: text };
}
