// =============================================================================
// Action Dictionaries — Layer B (Semantic Engine)
// =============================================================================
// Deterministic mappings for action semantic enrichment.
// No AI inference — pure root-based classification.
// =============================================================================

// --- Semantic Cluster ---

export type SemanticCluster =
  | 'belief_faith'
  | 'knowledge'
  | 'worship'
  | 'speech'
  | 'conflict'
  | 'movement'
  | 'emotional_states'
  | 'punishment_reward'
  | 'social_interaction'
  | 'deception_corruption';

export const SEMANTIC_CLUSTER_LABELS: Record<SemanticCluster, string> = {
  belief_faith: 'Belief & Faith',
  knowledge: 'Knowledge & Understanding',
  worship: 'Worship & Obedience',
  speech: 'Speech & Communication',
  conflict: 'Conflict & Struggle',
  movement: 'Movement & Travel',
  emotional_states: 'Emotional States',
  punishment_reward: 'Punishment & Reward',
  social_interaction: 'Social Interaction',
  deception_corruption: 'Deception & Corruption',
};

/** Root → Semantic Cluster mapping. ~130 common Qur'anic verb roots. */
export const ACTION_CLUSTER_MAP: Record<string, SemanticCluster> = {
  // --- Belief & Faith ---
  'ءمن': 'belief_faith',
  'كفر': 'belief_faith',
  'شرك': 'belief_faith',
  'توب': 'belief_faith',
  'هدي': 'belief_faith',
  'ضلل': 'belief_faith',
  'تقو': 'belief_faith',
  'يقن': 'belief_faith',
  'رشد': 'belief_faith',
  'غوي': 'belief_faith',
  'ريب': 'belief_faith',
  'زيغ': 'belief_faith',
  'ءيس': 'belief_faith',
  'رجع': 'belief_faith',

  // --- Knowledge & Understanding ---
  'علم': 'knowledge',
  'فقه': 'knowledge',
  'فكر': 'knowledge',
  'عقل': 'knowledge',
  'بصر': 'knowledge',
  'سمع': 'knowledge',
  'نظر': 'knowledge',
  'ذكر': 'knowledge',
  'تدبر': 'knowledge',
  'شهد': 'knowledge',
  'درس': 'knowledge',
  'قرء': 'knowledge',
  'كتب': 'knowledge',
  'حفظ': 'knowledge',
  'فهم': 'knowledge',

  // --- Worship & Obedience ---
  'عبد': 'worship',
  'صلو': 'worship',
  'سجد': 'worship',
  'صوم': 'worship',
  'زكو': 'worship',
  'حجج': 'worship',
  'طوف': 'worship',
  'سبح': 'worship',
  'حمد': 'worship',
  'طعم': 'worship',
  'نذر': 'worship',
  'قنت': 'worship',
  'ركع': 'worship',
  'طهر': 'worship',

  // --- Speech & Communication ---
  'قول': 'speech',
  'دعو': 'speech',
  'نبء': 'speech',
  'بلغ': 'speech',
  'بشر': 'speech',
  'انذر': 'speech',
  'وعظ': 'speech',
  'حدث': 'speech',
  'سءل': 'speech',
  'جوب': 'speech',
  'نطق': 'speech',
  'ءذن': 'speech',
  'وحي': 'speech',
  'تلو': 'speech',
  'قصص': 'speech',

  // --- Conflict & Struggle ---
  'قتل': 'conflict',
  'جهد': 'conflict',
  'حرب': 'conflict',
  'نصر': 'conflict',
  'غلب': 'conflict',
  'فتح': 'conflict',
  'ضرب': 'conflict',
  'رمي': 'conflict',
  'هزم': 'conflict',
  'صبر': 'conflict',
  'عدو': 'conflict',
  'بغي': 'conflict',

  // --- Movement & Travel ---
  'خرج': 'movement',
  'دخل': 'movement',
  'مشي': 'movement',
  'ءتي': 'movement',
  'ذهب': 'movement',
  'سير': 'movement',
  'هجر': 'movement',
  'سفر': 'movement',
  'رحل': 'movement',
  'قدم': 'movement',
  'نزل': 'movement',
  'صعد': 'movement',
  'جري': 'movement',
  'بعث': 'movement',

  // --- Emotional States ---
  'خوف': 'emotional_states',
  'رجو': 'emotional_states',
  'حزن': 'emotional_states',
  'حبب': 'emotional_states',
  'فرح': 'emotional_states',
  'بكي': 'emotional_states',
  'غضب': 'emotional_states',
  'كره': 'emotional_states',
  'طمع': 'emotional_states',
  'حسد': 'emotional_states',
  'رضي': 'emotional_states',
  'شكر': 'emotional_states',

  // --- Punishment & Reward ---
  'عذب': 'punishment_reward',
  'جزي': 'punishment_reward',
  'ثوب': 'punishment_reward',
  'غفر': 'punishment_reward',
  'رحم': 'punishment_reward',
  'لعن': 'punishment_reward',
  'عقب': 'punishment_reward',
  'حسب': 'punishment_reward',
  'وزن': 'punishment_reward',
  'حكم': 'punishment_reward',
  'عدل': 'punishment_reward',
  'ظلم': 'punishment_reward',

  // --- Social Interaction ---
  'نكح': 'social_interaction',
  'بيع': 'social_interaction',
  'عهد': 'social_interaction',
  'وفي': 'social_interaction',
  'صلح': 'social_interaction',
  'طلق': 'social_interaction',
  'ورث': 'social_interaction',
  'نفق': 'social_interaction',
  'صدق': 'social_interaction',
  'عون': 'social_interaction',
  'وصي': 'social_interaction',
  'شور': 'social_interaction',

  // --- Deception & Corruption ---
  'كذب': 'deception_corruption',
  'مكر': 'deception_corruption',
  'فسد': 'deception_corruption',
  'خدع': 'deception_corruption',
  'خون': 'deception_corruption',
  'فسق': 'deception_corruption',
  'سرق': 'deception_corruption',
  'زني': 'deception_corruption',
  'بهت': 'deception_corruption',
  'غرر': 'deception_corruption',
  'طغي': 'deception_corruption',
};

// --- Action Polarity ---

export type ActionPolarity = 'positive' | 'negative' | 'neutral';

export const POLARITY_LABELS: Record<ActionPolarity, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
};

/** Root → Polarity mapping. Unlisted roots default to 'neutral'. */
export const ACTION_POLARITY_MAP: Record<string, ActionPolarity> = {
  // --- Positive ---
  'ءمن': 'positive',
  'صلح': 'positive',
  'شكر': 'positive',
  'صبر': 'positive',
  'تقو': 'positive',
  'عبد': 'positive',
  'ذكر': 'positive',
  'توب': 'positive',
  'هدي': 'positive',
  'غفر': 'positive',
  'رحم': 'positive',
  'نصر': 'positive',
  'حمد': 'positive',
  'سبح': 'positive',
  'صلو': 'positive',
  'سجد': 'positive',
  'زكو': 'positive',
  'صدق': 'positive',
  'عدل': 'positive',
  'يقن': 'positive',
  'رشد': 'positive',
  'بشر': 'positive',
  'فلح': 'positive',
  'رضي': 'positive',
  'حفظ': 'positive',
  'وفي': 'positive',
  'علم': 'positive',
  'فقه': 'positive',
  'عقل': 'positive',
  'طهر': 'positive',
  'حكم': 'positive',

  // --- Negative ---
  'كفر': 'negative',
  'ظلم': 'negative',
  'فسق': 'negative',
  'كذب': 'negative',
  'شرك': 'negative',
  'فسد': 'negative',
  'عذب': 'negative',
  'قتل': 'negative',
  'مكر': 'negative',
  'خدع': 'negative',
  'خون': 'negative',
  'لعن': 'negative',
  'ضلل': 'negative',
  'غوي': 'negative',
  'بغي': 'negative',
  'طغي': 'negative',
  'سرق': 'negative',
  'زني': 'negative',
  'حسد': 'negative',
  'غضب': 'negative',
  'كره': 'negative',
  'بهت': 'negative',
  'غرر': 'negative',
};

// --- Expanded Actor Indicator Sets ---

/** Roots/names associated with prophets and messengers. */
export const PROPHET_INDICATORS = new Set([
  'نبي', 'رسل', 'موسى', 'عيسى', 'ابراهيم', 'نوح', 'محمد',
  'داود', 'سليمان', 'يوسف', 'يعقوب', 'اسماعيل', 'اسحاق',
  'هارون', 'لوط', 'شعيب', 'صالح', 'هود', 'يونس', 'ايوب',
  'زكريا', 'يحيى', 'الياس', 'اليسع', 'ذو', 'ادريس',
]);

/** Roots/text associated with hypocrites (munafiqun). */
export const HYPOCRITE_INDICATORS = new Set([
  'نفق', 'منافق', 'منافقين', 'منافقون',
]);

/** Roots/text associated with Shaytan/Iblis. */
export const SHAYTAN_INDICATORS = new Set([
  'شيطن', 'ابليس', 'شيطان', 'شياطين',
]);

/** Roots/text associated with generic mankind/people. */
export const MANKIND_INDICATORS = new Set([
  'ناس', 'انس', 'بشر', 'ادم', 'انسان', 'قوم',
]);
