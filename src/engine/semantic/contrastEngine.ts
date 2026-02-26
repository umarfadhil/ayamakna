// =============================================================================
// Contrast Pair Engine — Layer B (Semantic Engine)
// =============================================================================
// Optimized for 6000+ verses with capped links per contrast pair.
// =============================================================================

import type { TokenizedVerse } from '../linguistic/types';
import type { ContrastPair, ContrastLink, VerseLink } from './types';

/**
 * Root aliases: CONTRAST_DICTIONARY uses canonical Arabic roots, but the
 * morphological token DB stores some roots differently.
 * - 'ءمن' → 'أمن'  (iman/faith — DB uses hamza-on-alef)
 * - 'ءخر' → 'أخر'  (akhirah/afterlife — DB uses hamza-on-alef)
 * - 'نار' → 'نور'  (fire/hell — the DB morphological analyser assigns نار
 *                   tokens (fire) to root نور (light); both live under نور)
 */
export const CONTRAST_ROOT_ALIASES: Record<string, string> = {
  'ءمن': 'أمن',
  'ءخر': 'أخر',
  'نار': 'نور',
};

// Ordered pair IDs (index used for bipartite radial layout positions)
export const CONTRAST_PAIR_ORDER: string[] = [
  'ءمن:كفر', 'هدي:ضلل', 'نور:ظلم', 'جنن:نار', 'دنو:ءخر',
  'خير:شرر', 'صلح:فسد', 'حقق:بطل', 'صدق:كذب', 'حيي:موت',
  'ثوب:عذب', 'رحم:غضب', 'علم:جهل', 'صبر:عجل', 'شكر:كفر',
  'طوع:عصي', 'ذكر:نسي', 'رجل:مرأ',
];

/**
 * HSL hue for each side of each contrast pair.
 * Side A = positive / light pole, Side B = negative / dark pole.
 * Colors chosen to be distinct and visible on dark background — avoids pure green/black/white.
 */
export const CONTRAST_PAIR_HUES: Record<string, { hueA: number; hueB: number }> = {
  'ءمن:كفر':   { hueA: 195, hueB: 0   },  // faith: cyan vs crimson
  'هدي:ضلل':   { hueA: 165, hueB: 320 },  // guidance: teal vs magenta
  'نور:ظلم':   { hueA: 43,  hueB: 270 },  // light: gold vs deep violet
  'جنن:نار':   { hueA: 175, hueB: 18  },  // afterlife: blue-cyan vs fire orange
  'دنو:ءخر':   { hueA: 42,  hueB: 225 },  // worldview: amber vs indigo
  'خير:شرر':   { hueA: 62,  hueB: 5   },  // morality: yellow vs blood-red
  'صلح:فسد':   { hueA: 155, hueB: 10  },  // righteousness: blue-teal vs dark red
  'حقق:بطل':   { hueA: 200, hueB: 350 },  // truth: azure vs burgundy
  'صدق:كذب':   { hueA: 185, hueB: 15  },  // honesty: cyan vs orange-red
  'حيي:موت':   { hueA: 50,  hueB: 240 },  // existence: gold vs slate blue
  'ثوب:عذب':   { hueA: 45,  hueB: 358 },  // recompense: warm gold vs deep crimson
  'رحم:غضب':   { hueA: 35,  hueB: 355 },  // divine_attribute: coral vs dark red
  'علم:جهل':   { hueA: 210, hueB: 25  },  // knowledge: sky blue vs burnt orange
  'صبر:عجل':   { hueA: 205, hueB: 28  },  // character: steel blue vs rust orange
  'شكر:كفر':   { hueA: 48,  hueB: 8   },  // gratitude: amber vs dull red
  'طوع:عصي':   { hueA: 175, hueB: 315 },  // obedience: blue-green vs dark magenta
  'ذكر:نسي':   { hueA: 270, hueB: 28  },  // remembrance: violet vs orange
  'رجل:مرأ':   { hueA: 210, hueB: 340 },  // gender: steel blue (man) vs rose (woman)
};

/**
 * English keyword expansions for each contrast label.
 * Used for mode-specific search tokens — contrast mode ONLY uses these, not translation text.
 */
export const CONTRAST_LABEL_ENGLISH: Record<string, string> = {
  'iman':      'faith belief trust',
  'kufr':      'disbelief unbelief rejection',
  'huda':      'guidance path direction',
  'dalal':     'straying misguidance',
  'nur':       'light illumination brightness',
  'zulumat':   'darkness shadow obscurity',
  'jannah':    'paradise heaven garden bliss',
  'jahannam':  'hellfire fire punishment',
  'dunya':     'world worldly temporary',
  'akhirah':   'hereafter afterlife eternal',
  'khayr':     'good goodness virtue benefit',
  'sharr':     'evil harm wickedness',
  'islah':     'righteousness reform correction',
  'fasad':     'corruption wickedness mischief',
  'haqq':      'truth right justice reality',
  'batil':     'falsehood void wrong',
  'sidq':      'truthfulness honesty sincerity',
  'kadhib':    'lie deception dishonesty',
  'hayat':     'life living vitality',
  'mawt':      'death dying mortality',
  'thawab':    'reward recompense blessing',
  'adhab':     'punishment torment suffering',
  'rahmah':    'mercy compassion kindness grace',
  'ghadab':    'wrath anger fury',
  'ilm':       'knowledge wisdom learning',
  'jahl':      'ignorance foolishness',
  'sabr':      'patience endurance steadfastness',
  'ajal':      'haste impatience',
  'shukr':     'gratitude thankfulness appreciation',
  'kufr_nimah':'ingratitude denial',
  'taah':      'obedience submission compliance',
  'masiyah':   'disobedience sin rebellion',
  'dhikr':     'remembrance recollection',
  'nisyan':    'forgetfulness negligence',
  'rajul':     'man men male',
  'mara':      'woman women female',
};

/** Placeholder words for animated search bar in contrast mode. */
export const CONTRAST_PLACEHOLDER_WORDS = [
  'Light', 'Darkness', 'Faith', 'Disbelief', 'Guidance',
  'Misguidance', 'Paradise', 'Hellfire', 'Truth', 'Falsehood',
  'Mercy', 'Wrath', 'Knowledge', 'Ignorance', 'Patience',
  'Life', 'Death', 'Gratitude', 'Obedience', 'Remembrance',
  'Man', 'Woman',
];

export const CONTRAST_DICTIONARY: ContrastPair[] = [
  { rootA: 'ءمن', rootB: 'كفر', labelA: 'iman', labelB: 'kufr', category: 'faith' },
  { rootA: 'هدي', rootB: 'ضلل', labelA: 'huda', labelB: 'dalal', category: 'guidance' },
  { rootA: 'نور', rootB: 'ظلم', labelA: 'nur', labelB: 'zulumat', category: 'light' },
  { rootA: 'جنن', rootB: 'نار', labelA: 'jannah', labelB: 'jahannam', category: 'afterlife' },
  { rootA: 'دنو', rootB: 'ءخر', labelA: 'dunya', labelB: 'akhirah', category: 'worldview' },
  { rootA: 'خير', rootB: 'شرر', labelA: 'khayr', labelB: 'sharr', category: 'morality' },
  { rootA: 'صلح', rootB: 'فسد', labelA: 'islah', labelB: 'fasad', category: 'morality' },
  { rootA: 'حقق', rootB: 'بطل', labelA: 'haqq', labelB: 'batil', category: 'truth' },
  { rootA: 'صدق', rootB: 'كذب', labelA: 'sidq', labelB: 'kadhib', category: 'truth' },
  { rootA: 'حيي', rootB: 'موت', labelA: 'hayat', labelB: 'mawt', category: 'existence' },
  { rootA: 'ثوب', rootB: 'عذب', labelA: 'thawab', labelB: 'adhab', category: 'recompense' },
  { rootA: 'رحم', rootB: 'غضب', labelA: 'rahmah', labelB: 'ghadab', category: 'divine_attribute' },
  { rootA: 'علم', rootB: 'جهل', labelA: 'ilm', labelB: 'jahl', category: 'knowledge' },
  { rootA: 'صبر', rootB: 'عجل', labelA: 'sabr', labelB: 'ajal', category: 'character' },
  { rootA: 'شكر', rootB: 'كفر', labelA: 'shukr', labelB: 'kufr_nimah', category: 'gratitude' },
  { rootA: 'طوع', rootB: 'عصي', labelA: 'taah', labelB: 'masiyah', category: 'obedience' },
  { rootA: 'ذكر', rootB: 'نسي', labelA: 'dhikr', labelB: 'nisyan', category: 'remembrance' },
  { rootA: 'رجل', rootB: 'مرأ', labelA: 'rajul', labelB: 'mara', category: 'gender' },
];

export function getPairId(pair: ContrastPair): string {
  return `${pair.rootA}:${pair.rootB}`;
}

/**
 * Build a root→verseIds index for fast lookups.
 */
function buildRootVerseIndex(verses: TokenizedVerse[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const { verse, words } of verses) {
    const seen = new Set<string>();
    for (const w of words) {
      if (w.root && !seen.has(w.root)) {
        seen.add(w.root);
        if (!index.has(w.root)) index.set(w.root, []);
        index.get(w.root)!.push(verse.id);
      }
    }
  }
  return index;
}

/**
 * Detect contrast links, capped per pair to prevent explosion.
 * For 6000+ verses, uncapped contrast links can be millions.
 *
 * @param maxLinksPerPair - max links to generate per contrast pair
 */
export function detectContrastLinks(
  verses: TokenizedVerse[],
  dictionary: ContrastPair[] = CONTRAST_DICTIONARY,
  maxLinksPerPair: number = 200
): ContrastLink[] {
  const rootVerseIndex = buildRootVerseIndex(verses);
  const links: ContrastLink[] = [];

  for (const pair of dictionary) {
    const pairId = getPairId(pair);
    const versesWithA = rootVerseIndex.get(pair.rootA) ?? [];
    const versesWithB = rootVerseIndex.get(pair.rootB) ?? [];

    if (versesWithA.length === 0 || versesWithB.length === 0) continue;

    // Sample links if the cross product is too large
    let count = 0;
    const setB = new Set(versesWithB);

    for (const vA of versesWithA) {
      if (count >= maxLinksPerPair) break;
      for (const vB of versesWithB) {
        if (count >= maxLinksPerPair) break;
        if (vA === vB) continue;

        links.push({ verseA: vA, verseB: vB, pairId, polarity: 'positive' });
        count++;
      }
    }
  }

  return links;
}

export function contrastLinksToVerseLinks(contrastLinks: ContrastLink[]): VerseLink[] {
  return contrastLinks.map((cl) => ({
    verseA: cl.verseA,
    verseB: cl.verseB,
    similarityScore: 0.8,
    linkType: 'contrast' as const,
  }));
}

export function detectInternalContrasts(
  verses: TokenizedVerse[],
  dictionary: ContrastPair[] = CONTRAST_DICTIONARY
): Array<{ verseId: string; pair: ContrastPair }> {
  const results: Array<{ verseId: string; pair: ContrastPair }> = [];
  const rootVerseIndex = buildRootVerseIndex(verses);

  for (const pair of dictionary) {
    const setA = new Set(rootVerseIndex.get(pair.rootA) ?? []);
    const versesB = rootVerseIndex.get(pair.rootB) ?? [];
    for (const vId of versesB) {
      if (setA.has(vId)) results.push({ verseId: vId, pair });
    }
  }

  return results;
}
