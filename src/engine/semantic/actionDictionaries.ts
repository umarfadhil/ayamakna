// =============================================================================
// Action Dictionaries — Layer B (Semantic Engine)
// =============================================================================
// Deterministic mappings for action semantic enrichment.
// 12 Action Families representing major behavioral patterns in the Qur'an.
// No AI inference — pure root-based classification.
// =============================================================================

// --- Action Family ---
// Replaces SemanticCluster. 12 major behavioral pattern families.

export type ActionFamily =
  | 'worship_devotion'       // Worship & Devotion — Pray, Prostrate, Fast, Praise
  | 'moral_conduct'          // Moral Conduct — Give, Forgive, Be Patient, Be Just
  | 'divine_command'         // Divine Command — Reveal, Ordain, Permit, Prohibit
  | 'divine_creation'        // Creation & Power — Create, Give Life, Sustain, Resurrect
  | 'knowledge_reflection'   // Knowledge & Reflection — Know, Reflect, Understand, Witness
  | 'rejection_denial'       // Rejection & Denial — Disbelieve, Mock, Oppose, Transgress
  | 'proclamation_warning'   // Proclamation & Warning — Say, Warn, Convey, Narrate
  | 'social_transaction'     // Social & Family Affairs — Marry, Trade, Inherit, Journey
  | 'spiritual_states'       // Spiritual & Emotional States — Fear, Hope, Love, Grieve
  | 'conflict_resistance'    // Conflict & Resistance — Fight, Strive, Resist, Defeat
  | 'divine_retribution'     // Divine Retribution — Punish, Destroy, Curse, Seal Hearts
  | 'seeking_supplication';  // Seeking & Supplication — Repent, Ask, Seek Refuge, Return

export const ACTION_FAMILY_LABELS: Record<ActionFamily, string> = {
  worship_devotion: 'Worship & Devotion',
  moral_conduct: 'Moral Conduct',
  divine_command: 'Divine Command',
  divine_creation: 'Creation & Power',
  knowledge_reflection: 'Knowledge & Reflection',
  rejection_denial: 'Rejection & Denial',
  proclamation_warning: 'Proclamation & Warning',
  social_transaction: 'Social & Family Affairs',
  spiritual_states: 'Spiritual & Emotional States',
  conflict_resistance: 'Conflict & Resistance',
  divine_retribution: 'Divine Retribution',
  seeking_supplication: 'Seeking & Supplication',
};

/** Indonesian translations of action family names (for search tokens). */
export const ACTION_FAMILY_INDONESIAN: Record<ActionFamily, string> = {
  worship_devotion: 'ibadah pengabdian shalat puasa dzikir',
  moral_conduct: 'perilaku moral sabar adil jujur',
  divine_command: 'perintah ilahi wahyu turunkan',
  divine_creation: 'penciptaan kekuasaan ciptakan hidupkan',
  knowledge_reflection: 'ilmu renungan pengetahuan memahami',
  rejection_denial: 'penolakan pengingkaran kafir ingkar',
  proclamation_warning: 'seruan peringatan sampaikan ceritakan',
  social_transaction: 'urusan sosial keluarga nikah warisan perjalanan',
  spiritual_states: 'keadaan spiritual emosi takut harap cinta',
  conflict_resistance: 'konflik perlawanan berjuang jihad',
  divine_retribution: 'azab ilahi siksa kutuk hancurkan',
  seeking_supplication: 'permohonan doa taubat minta ampun',
};

/** HSL hues for each action family (for node coloring). */
export const ACTION_FAMILY_HUES: Record<ActionFamily, number> = {
  worship_devotion: 140,      // green
  moral_conduct: 165,         // teal
  divine_command: 45,         // gold
  divine_creation: 55,        // amber
  knowledge_reflection: 195,  // cyan
  rejection_denial: 0,        // red
  proclamation_warning: 30,   // orange
  social_transaction: 85,     // yellow-green
  spiritual_states: 270,      // violet
  conflict_resistance: 15,    // red-orange
  divine_retribution: 220,    // deep blue
  seeking_supplication: 310,  // pink-purple
};

/**
 * Legacy 10-cluster IDs (old DB values) → new 12-family ActionFamily mapping.
 * Used in dataLoader.ts to normalize stale `semantic_cluster` values from DB.
 */
export const LEGACY_CLUSTER_MAP: Record<string, ActionFamily> = {
  belief_faith:     'worship_devotion',
  worship:          'worship_devotion',
  knowledge:        'knowledge_reflection',
  speech:           'proclamation_warning',
  punishment_reward: 'divine_retribution',
  conflict:         'conflict_resistance',
  movement:         'social_transaction',
  social:           'social_transaction',
  deception:        'rejection_denial',
  emotional:        'spiritual_states',
};

/** Display order for radial layout (1-based). */
export const ACTION_FAMILY_ORDER: Record<ActionFamily, number> = {
  worship_devotion: 1,
  moral_conduct: 2,
  divine_command: 3,
  divine_creation: 4,
  knowledge_reflection: 5,
  rejection_denial: 6,
  proclamation_warning: 7,
  social_transaction: 8,
  spiritual_states: 9,
  conflict_resistance: 10,
  divine_retribution: 11,
  seeking_supplication: 12,
};

/**
 * Arabic root → Action Family mapping.
 * ~200 common Qur'anic verb/action roots assigned to primary behavioral family.
 */
export const ACTION_FAMILY_MAP: Record<string, ActionFamily> = {
  // === WORSHIP & DEVOTION ===
  // Core acts of ritual worship and remembrance of God
  'عبد': 'worship_devotion',   // worship
  'صلو': 'worship_devotion',   // pray (salah)
  'سجد': 'worship_devotion',   // prostrate
  'صوم': 'worship_devotion',   // fast
  'زكو': 'worship_devotion',   // give zakat
  'حجج': 'worship_devotion',   // pilgrimage
  'سبح': 'worship_devotion',   // glorify
  'حمد': 'worship_devotion',   // praise
  'ذكر': 'worship_devotion',   // remember/dhikr
  'شكر': 'worship_devotion',   // give thanks
  'قنت': 'worship_devotion',   // be devout
  'ركع': 'worship_devotion',   // bow
  'طوف': 'worship_devotion',   // circumambulate
  'نذر': 'worship_devotion',   // vow
  'طهر': 'worship_devotion',   // purify/cleanse
  'خشع': 'worship_devotion',   // be humble (in worship)
  'صلح': 'worship_devotion',   // be righteous/reform
  'امن': 'worship_devotion',   // believe/have faith
  'أمن': 'worship_devotion',   // believe/have faith (hamza variant)
  'طوع': 'worship_devotion',   // obey/comply (طاع)

  // === MORAL CONDUCT ===
  // Ethical behaviors, virtues, social obligations
  'صبر': 'moral_conduct',      // be patient
  'عدل': 'moral_conduct',      // be just
  'صدق': 'moral_conduct',      // be truthful
  'وفي': 'moral_conduct',      // fulfill covenant
  'عفو': 'moral_conduct',      // pardon/forgive
  'نصح': 'moral_conduct',      // advise/counsel
  'نفق': 'moral_conduct',      // spend/give charity
  'برر': 'moral_conduct',      // do good/be righteous
  'عهد': 'moral_conduct',      // covenant/commit
  'وصي': 'moral_conduct',      // give counsel/bequeath
  'امر': 'moral_conduct',      // command good (amr bil-ma'ruf)
  'نهي': 'moral_conduct',      // forbid evil
  'احسن': 'moral_conduct',     // do good (ihsan)
  'عون': 'moral_conduct',      // help/assist
  'رحم': 'moral_conduct',      // show mercy
  'عمل': 'moral_conduct',      // do/work/act
  'فعل': 'moral_conduct',      // do/perform an act
  'نفع': 'moral_conduct',      // benefit/be useful
  'قوم': 'moral_conduct',      // rise/stand/uphold
  'تبع': 'moral_conduct',      // follow (guidance or falsehood — context-dependent)

  // === DIVINE COMMAND ===
  // God's acts of revelation, legislation, and divine speech
  'وحي': 'divine_command',     // reveal (wahiy)
  'اذن': 'divine_command',     // permit
  'حرم': 'divine_command',     // prohibit
  'فرض': 'divine_command',     // ordain/prescribe
  'شرع': 'divine_command',     // legislate
  'كلم': 'divine_command',     // speak directly (to prophets)
  'نزل': 'divine_command',     // send down
  'كتب': 'divine_command',     // decree/write
  'قضي': 'divine_command',     // decree
  'حكم': 'divine_command',     // judge/rule
  'امل': 'divine_command',     // dictate/inspire
  'اوحي': 'divine_command',    // reveal (variant)
  'يسر': 'divine_command',     // make easy/facilitate
  'فصل': 'divine_command',     // separate/judge/decide
  'ولي': 'divine_command',     // be guardian/in charge

  // === DIVINE CREATION ===
  // God's acts of creation, sustenance, and cosmic management
  'خلق': 'divine_creation',    // create
  'جعل': 'divine_creation',    // make/set
  'صور': 'divine_creation',    // shape/form
  'نفخ': 'divine_creation',    // breathe into
  'حيي': 'divine_creation',    // give life
  'موت': 'divine_creation',    // cause death
  'بعث': 'divine_creation',    // resurrect/raise/send
  'رزق': 'divine_creation',    // provide sustenance
  'مطر': 'divine_creation',    // send rain
  'نبت': 'divine_creation',    // cause to grow
  'دبر': 'divine_creation',    // manage/administer
  'انشأ': 'divine_creation',   // originate/bring into being
  'فطر': 'divine_creation',    // create from nothing
  'قدر': 'divine_creation',    // measure/determine
  'كون': 'divine_creation',    // be/exist (كُنْ فَيَكُونُ — divine creative command)
  'سوي': 'divine_creation',    // make equal/straighten/form
  'غني': 'divine_creation',    // be self-sufficient/independent (divine attribute)
  'ملك': 'divine_creation',    // possess/own (sovereignty)

  // === KNOWLEDGE & REFLECTION ===
  // Cognitive, perceptual, and epistemic actions
  'علم': 'knowledge_reflection',   // know
  'عقل': 'knowledge_reflection',   // reason/understand
  'فقه': 'knowledge_reflection',   // comprehend deeply
  'فكر': 'knowledge_reflection',   // think/reflect
  'تدبر': 'knowledge_reflection',  // ponder/contemplate
  'نظر': 'knowledge_reflection',   // look/consider
  'بصر': 'knowledge_reflection',   // perceive/see
  'سمع': 'knowledge_reflection',   // hear
  'قرء': 'knowledge_reflection',   // read/recite
  'درس': 'knowledge_reflection',   // study
  'حفظ': 'knowledge_reflection',   // memorize/preserve
  'شهد': 'knowledge_reflection',   // witness/testify
  'يقن': 'knowledge_reflection',   // be certain
  'خبر': 'knowledge_reflection',   // be informed
  'تفكر': 'knowledge_reflection',  // reflect deeply

  // === REJECTION & DENIAL ===
  // Acts of disbelief, opposition, transgression, and deviance
  'كفر': 'rejection_denial',   // disbelieve
  'شرك': 'rejection_denial',   // associate partners (shirk)
  'كذب': 'rejection_denial',   // deny/lie
  'جحد': 'rejection_denial',   // reject/deny
  'بغي': 'rejection_denial',   // transgress
  'طغي': 'rejection_denial',   // exceed bounds/be arrogant
  'حاد': 'rejection_denial',   // oppose/resist God
  'ريب': 'rejection_denial',   // doubt
  'زيغ': 'rejection_denial',   // deviate/go astray
  'ضل': 'rejection_denial',    // stray/go astray
  'ارتد': 'rejection_denial',  // apostatize
  'انكر': 'rejection_denial',  // deny/reject
  'استكبر': 'rejection_denial', // be arrogant
  'هزأ': 'rejection_denial',   // mock/ridicule

  // === PROCLAMATION & WARNING ===
  // Speech acts: conveying, warning, narrating, calling
  'قول': 'proclamation_warning',   // say/speak
  'دعو': 'proclamation_warning',   // call/invite
  'بلغ': 'proclamation_warning',   // convey/deliver
  'انذر': 'proclamation_warning',  // warn
  'بشر': 'proclamation_warning',   // give good tidings
  'نبء': 'proclamation_warning',   // inform/tell
  'وعظ': 'proclamation_warning',   // admonish
  'حدث': 'proclamation_warning',   // narrate/tell
  'نطق': 'proclamation_warning',   // pronounce/speak
  'تلو': 'proclamation_warning',   // recite
  'قصص': 'proclamation_warning',   // recount stories
  'خطب': 'proclamation_warning',   // address/preach
  'جدل': 'proclamation_warning',   // argue/debate
  'سءل': 'proclamation_warning',   // ask a question (speech act)
  'ندي': 'proclamation_warning',   // call/announce (نادى)

  // === SOCIAL & FAMILY AFFAIRS ===
  // Human transactions, family law, movement, social bonds
  'نكح': 'social_transaction',   // marry
  'طلق': 'social_transaction',   // divorce
  'بيع': 'social_transaction',   // trade/sell
  'ورث': 'social_transaction',   // inherit
  'هجر': 'social_transaction',   // migrate/leave
  'سير': 'social_transaction',   // journey/travel
  'دخل': 'social_transaction',   // enter
  'خرج': 'social_transaction',   // exit/leave
  'شور': 'social_transaction',   // consult/counsel
  'عاشر': 'social_transaction',  // live with/associate
  'رضع': 'social_transaction',   // suckle/nurse
  'مشي': 'social_transaction',   // walk/go
  'قدم': 'social_transaction',   // arrive/present
  'سفر': 'social_transaction',   // travel
  'جري': 'social_transaction',   // run/flow
  'بدل': 'social_transaction',   // exchange/replace
  'لقي': 'social_transaction',   // meet/encounter
  'أكل': 'social_transaction',   // eat
  'أتي': 'social_transaction',   // come/bring
  'قبل': 'social_transaction',   // accept/receive

  // === SPIRITUAL & EMOTIONAL STATES ===
  // Inner states: fear, hope, love, grief, gratitude
  'خوف': 'spiritual_states',   // fear
  'رجو': 'spiritual_states',   // hope
  'حبب': 'spiritual_states',   // love
  'حزن': 'spiritual_states',   // grieve/be sad
  'فرح': 'spiritual_states',   // rejoice
  'بكي': 'spiritual_states',   // weep
  'غضب': 'spiritual_states',   // be angry
  'كره': 'spiritual_states',   // dislike
  'طمع': 'spiritual_states',   // covet/desire
  'رضي': 'spiritual_states',   // be pleased
  'خشي': 'spiritual_states',   // revere/be in awe
  'حسد': 'spiritual_states',   // envy
  'وجل': 'spiritual_states',   // be in awe/fear
  'اطمأن': 'spiritual_states', // be at peace

  // === CONFLICT & RESISTANCE ===
  // Physical and moral struggle, combat, resistance
  'قتل': 'conflict_resistance',   // fight/kill
  'جهد': 'conflict_resistance',   // strive/fight (jihad)
  'نصر': 'conflict_resistance',   // help/support (victory)
  'غلب': 'conflict_resistance',   // overcome
  'فتح': 'conflict_resistance',   // conquer/open
  'ضرب': 'conflict_resistance',   // strike
  'رمي': 'conflict_resistance',   // throw/shoot
  'هزم': 'conflict_resistance',   // defeat
  'عدو': 'conflict_resistance',   // assault/transgress
  'عصي': 'conflict_resistance',   // disobey
  'دافع': 'conflict_resistance',  // defend
  'حرب': 'conflict_resistance',   // war

  // === DIVINE RETRIBUTION ===
  // God's acts of punishment, destruction, and judgment
  'عذب': 'divine_retribution',    // punish/torment
  'هلك': 'divine_retribution',    // destroy/perish
  'لعن': 'divine_retribution',    // curse
  'ضلل': 'divine_retribution',    // lead astray (divine)
  'طبع': 'divine_retribution',    // seal hearts
  'جزي': 'divine_retribution',    // recompense/punish
  'حسب': 'divine_retribution',    // reckon/judge
  'اخذ': 'divine_retribution',    // seize/take
  'أخذ': 'divine_retribution',    // seize/take (hamza variant)
  'خذل': 'divine_retribution',    // abandon/forsake
  'ختم': 'divine_retribution',    // seal (as in sealing fate)
  'سخط': 'divine_retribution',    // divine wrath/displeasure
  'انتقم': 'divine_retribution',  // take revenge/avenge

  // === SEEKING & SUPPLICATION ===
  // Human acts of turning to God: repentance, prayer, seeking
  'توب': 'seeking_supplication',    // repent
  'غفر': 'seeking_supplication',    // seek forgiveness
  'رجع': 'seeking_supplication',    // return to God
  'عوذ': 'seeking_supplication',    // seek refuge
  'هدي': 'seeking_supplication',    // seek guidance
  'رشد': 'seeking_supplication',    // follow guidance/be guided
  'فزع': 'seeking_supplication',    // turn to in distress
  'رغب': 'seeking_supplication',    // desire/wish (toward God)
  'تضرع': 'seeking_supplication',   // humbly supplicate
  'ناجي': 'seeking_supplication',   // confide/whisper to God
  'استغاث': 'seeking_supplication', // cry for help
  'رود': 'seeking_supplication',    // want/intend/seek (أراد = desire, divine or human)
  'قلب': 'seeking_supplication',    // turn hearts (قلب القلوب — turning of hearts toward God)
};

/**
 * Arabic root → Canonical English action form.
 * Normalized to infinitive/gerund form for display and search.
 */
export const CANONICAL_ACTION_MAP: Record<string, string> = {
  // Worship & Devotion
  'عبد': 'Worship',
  'صلو': 'Pray',
  'سجد': 'Prostrate',
  'صوم': 'Fast',
  'زكو': 'Give Zakat',
  'حجج': 'Perform Pilgrimage',
  'سبح': 'Glorify',
  'حمد': 'Praise',
  'ذكر': 'Remember (Dhikr)',
  'شكر': 'Give Thanks',
  'قنت': 'Be Devout',
  'ركع': 'Bow',
  'طوف': 'Circumambulate',
  'نذر': 'Vow',
  'طهر': 'Purify',
  'خشع': 'Be Humble',
  'صلح': 'Be Righteous',

  // Moral Conduct
  'صبر': 'Be Patient',
  'عدل': 'Be Just',
  'صدق': 'Be Truthful',
  'وفي': 'Fulfill Covenant',
  'عفو': 'Pardon',
  'نصح': 'Advise',
  'نفق': 'Give Charity',
  'برر': 'Do Good',
  'عهد': 'Make Covenant',
  'وصي': 'Give Counsel',
  'امر': 'Command Good',
  'نهي': 'Forbid Evil',
  'احسن': 'Show Excellence',
  'عون': 'Help / Assist',
  'رحم': 'Show Mercy',

  // Divine Command
  'وحي': 'Reveal',
  'اذن': 'Permit',
  'حرم': 'Prohibit',
  'فرض': 'Ordain',
  'شرع': 'Legislate',
  'كلم': 'Speak (to Prophet)',
  'نزل': 'Send Down',
  'كتب': 'Decree',
  'قضي': 'Decree',
  'حكم': 'Judge / Rule',
  'اوحي': 'Reveal',

  // Divine Creation
  'خلق': 'Create',
  'جعل': 'Make / Set',
  'صور': 'Shape / Form',
  'نفخ': 'Breathe Into',
  'حيي': 'Give Life',
  'موت': 'Cause Death',
  'بعث': 'Resurrect / Raise',
  'رزق': 'Provide Sustenance',
  'مطر': 'Send Rain',
  'نبت': 'Cause to Grow',
  'دبر': 'Manage / Administer',
  'انشأ': 'Originate',
  'فطر': 'Create (from nothing)',
  'قدر': 'Measure / Determine',

  // Knowledge & Reflection
  'علم': 'Know',
  'عقل': 'Reason / Understand',
  'فقه': 'Comprehend Deeply',
  'فكر': 'Think / Reflect',
  'تدبر': 'Ponder',
  'نظر': 'Consider / Observe',
  'بصر': 'Perceive / See',
  'سمع': 'Hear',
  'قرء': 'Read / Recite',
  'درس': 'Study',
  'حفظ': 'Memorize / Preserve',
  'شهد': 'Witness',
  'يقن': 'Be Certain',
  'خبر': 'Be Informed',

  // Rejection & Denial
  'كفر': 'Disbelieve',
  'شرك': 'Associate Partners',
  'كذب': 'Deny / Lie',
  'جحد': 'Reject / Deny',
  'بغي': 'Transgress',
  'طغي': 'Exceed Bounds',
  'حاد': 'Oppose God',
  'ريب': 'Doubt',
  'زيغ': 'Deviate',
  'ضل': 'Go Astray',
  'ارتد': 'Apostatize',
  'استكبر': 'Be Arrogant',

  // Proclamation & Warning
  'قول': 'Speak / Say',
  'دعو': 'Call / Invite',
  'بلغ': 'Convey',
  'انذر': 'Warn',
  'بشر': 'Give Good Tidings',
  'نبء': 'Inform',
  'وعظ': 'Admonish',
  'حدث': 'Narrate',
  'نطق': 'Pronounce',
  'تلو': 'Recite',
  'قصص': 'Recount Stories',
  'جدل': 'Debate / Argue',
  'سءل': 'Ask',

  // Social & Family Affairs
  'نكح': 'Marry',
  'طلق': 'Divorce',
  'بيع': 'Trade / Sell',
  'ورث': 'Inherit',
  'هجر': 'Migrate',
  'سير': 'Journey',
  'دخل': 'Enter',
  'خرج': 'Leave / Exit',
  'شور': 'Consult',
  'مشي': 'Walk',
  'سفر': 'Travel',

  // Spiritual & Emotional States
  'خوف': 'Fear',
  'رجو': 'Hope',
  'حبب': 'Love',
  'حزن': 'Grieve',
  'فرح': 'Rejoice',
  'بكي': 'Weep',
  'كره': 'Dislike',
  'طمع': 'Covet',
  'رضي': 'Be Pleased',
  'خشي': 'Revere',
  'حسد': 'Envy',
  'اطمأن': 'Find Peace',

  // Conflict & Resistance
  'قتل': 'Fight / Kill',
  'جهد': 'Strive (Jihad)',
  'نصر': 'Support / Aid',
  'غلب': 'Overcome',
  'فتح': 'Conquer',
  'ضرب': 'Strike',
  'رمي': 'Shoot',
  'هزم': 'Defeat',
  'عصي': 'Disobey',
  'دافع': 'Defend',
  'حرب': 'Wage War',

  // Divine Retribution
  'عذب': 'Punish / Torment',
  'هلك': 'Destroy',
  'لعن': 'Curse',
  'ضلل': 'Lead Astray',
  'طبع': 'Seal Hearts',
  'جزي': 'Recompense',
  'حسب': 'Reckon',
  'اخذ': 'Seize',
  'خذل': 'Forsake',
  'ختم': 'Seal',
  'انتقم': 'Avenge',

  // Seeking & Supplication
  'توب': 'Repent',
  'غفر': 'Seek Forgiveness',
  'رجع': 'Return to God',
  'عوذ': 'Seek Refuge',
  'هدي': 'Seek Guidance',
  'رشد': 'Follow Guidance',
  'فزع': 'Turn in Distress',
  'رغب': 'Turn Toward God',
  'تضرع': 'Supplicate Humbly',
  'استغاث': 'Cry for Help',
};

/**
 * Placeholder words for action mode animated search bar.
 * Cycles through action family names + canonical action names.
 */
export const ACTION_PLACEHOLDER_WORDS: string[] = [
  // 12 action family labels
  'Worship & Devotion', 'Moral Conduct', 'Divine Command', 'Creation & Power',
  'Knowledge & Reflection', 'Rejection & Denial', 'Proclamation & Warning',
  'Social & Family Affairs', 'Spiritual & Emotional States', 'Conflict & Resistance',
  'Divine Retribution', 'Seeking & Supplication',
  // Key canonical action names
  'Pray', 'Prostrate', 'Be Patient', 'Be Just', 'Reveal', 'Create',
  'Know', 'Disbelieve', 'Warn', 'Strive', 'Repent', 'Seek Forgiveness',
];

// --- Action Polarity ---

export type ActionPolarity = 'positive' | 'negative' | 'neutral';

export const POLARITY_LABELS: Record<ActionPolarity, string> = {
  positive: 'Positive',
  negative: 'Negative',
  neutral: 'Neutral',
};

/** Root → Polarity mapping. Unlisted roots default to 'neutral'. */
export const ACTION_POLARITY_MAP: Record<string, ActionPolarity> = {
  // Positive
  'عبد': 'positive', 'صلو': 'positive', 'سجد': 'positive', 'صوم': 'positive',
  'زكو': 'positive', 'سبح': 'positive', 'حمد': 'positive', 'ذكر': 'positive',
  'شكر': 'positive', 'ركع': 'positive', 'طهر': 'positive', 'صبر': 'positive',
  'عدل': 'positive', 'صدق': 'positive', 'وفي': 'positive', 'عفو': 'positive',
  'نفق': 'positive', 'برر': 'positive', 'احسن': 'positive', 'عون': 'positive',
  'رحم': 'positive', 'هدي': 'positive', 'توب': 'positive', 'غفر': 'positive',
  'رشد': 'positive', 'نصر': 'positive', 'يقن': 'positive', 'علم': 'positive',
  'فقه': 'positive', 'عقل': 'positive', 'حفظ': 'positive', 'بشر': 'positive',
  'رضي': 'positive', 'خشي': 'positive', 'رجو': 'positive', 'فرح': 'positive',
  'حبب': 'positive', 'اطمأن': 'positive', 'صلح': 'positive', 'خشع': 'positive',
  // Negative
  'كفر': 'negative', 'شرك': 'negative', 'كذب': 'negative', 'جحد': 'negative',
  'بغي': 'negative', 'طغي': 'negative', 'حاد': 'negative', 'ريب': 'negative',
  'زيغ': 'negative', 'ضل': 'negative', 'ارتد': 'negative', 'استكبر': 'negative',
  'ظلم': 'negative', 'فسق': 'negative', 'فسد': 'negative', 'خون': 'negative',
  'عذب': 'negative', 'هلك': 'negative', 'لعن': 'negative', 'ضلل': 'negative',
  'طبع': 'negative', 'خذل': 'negative', 'قتل': 'negative', 'حرب': 'negative',
  'حسد': 'negative', 'غضب': 'negative', 'كره': 'negative', 'طمع': 'negative',
  'عصي': 'negative', 'مكر': 'negative',
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

// --- Actor Ontology ---
// Top-level ontological grouping of actor types.
// Derived from ActorType — no DB change needed.

export type ActorOntology =
  | 'divine'        // Allah — direct divine speech or act
  | 'angelic'       // Angels (Jibril, Mika'il, collective angels)
  | 'human'         // All human roles: Prophet, Believer, Disbeliever, Hypocrite, Mankind
  | 'jinn_shaytan'  // Iblis, Shaytan (generic), Jinn
  | 'collective'    // Nations, groups, communities (future expansion)
  | 'natural';      // Natural entities: heaven, earth, nature forces

/** Map from granular ActorType to top-level ActorOntology. */
export const ACTOR_ONTOLOGY_MAP: Record<string, ActorOntology> = {
  divine:      'divine',
  angel:       'angelic',
  prophet:     'human',
  believer:    'human',
  disbeliever: 'human',
  hypocrite:   'human',
  mankind:     'human',
  human:       'human',
  shaytan:     'jinn_shaytan',
  nature:      'natural',
};

/** HSL hue per actor ontology (for graph node coloring in action mode). */
export const ACTOR_ONTOLOGY_HUES: Record<ActorOntology, number> = {
  divine:       45,   // gold — divine authority
  angelic:      195,  // cyan — celestial
  human:        140,  // green — alive / active
  jinn_shaytan: 0,    // red — adversarial
  collective:   85,   // yellow-green — social/communal
  natural:      220,  // steel blue — cosmic/natural
};

/** Display labels for actor ontology (top-level). */
export const ACTOR_ONTOLOGY_LABELS: Record<ActorOntology, string> = {
  divine:       'Divine',
  angelic:      'Angelic',
  human:        'Human',
  jinn_shaytan: 'Jinn / Shayṭān',
  collective:   'Collective Entity',
  natural:      'Natural Entity',
};

/** Human-readable role labels for granular ActorType (sub-role within ontology). */
export const ACTOR_ROLE_LABELS: Record<string, string> = {
  divine:      'Allah (Direct)',
  angel:       'Angel (Collective)',
  prophet:     'Prophet / Messenger',
  believer:    'Believer (Mu\'min)',
  disbeliever: 'Disbeliever (Kafir)',
  hypocrite:   'Hypocrite (Munafiq)',
  mankind:     'Mankind (Generic)',
  human:       'Generic Human',
  shaytan:     'Shayṭān',
  nature:      'Natural Entity',
};

// --- Legacy aliases for backwards compatibility ---
// SemanticCluster was the old name for ActionFamily
export type SemanticCluster = ActionFamily;
export const ACTION_CLUSTER_MAP = ACTION_FAMILY_MAP;
export const SEMANTIC_CLUSTER_LABELS = ACTION_FAMILY_LABELS;
