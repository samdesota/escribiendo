export interface ConjugationRule {
  id: string;
  name: string;
  description: string;
  category: 'regular' | 'stem-changing' | 'irregular' | 'yo-irregular';
  tenses: string[];
  order: number;
  examples: string[];
  icon: string; // emoji representing the tense/rule
}

export const CONJUGATION_RULES: ConjugationRule[] = [
  // 1. Regular Present Tense (start here)
  {
    id: 'regular-present-ar',
    name: 'Regular -AR Verbs (Present)',
    description: 'Regular -AR verbs in present tense: drop -ar and add endings (-o, -as, -a, -amos, -áis, -an)',
    category: 'regular',
    tenses: ['present'],
    order: 1,
    examples: ['hablar → hablo, hablas, habla', 'caminar → camino, caminas, camina'],
    icon: '🗣️' // speaking/talking
  },
  {
    id: 'regular-present-er',
    name: 'Regular -ER Verbs (Present)',
    description: 'Regular -ER verbs in present tense: drop -er and add endings (-o, -es, -e, -emos, -éis, -en)',
    category: 'regular',
    tenses: ['present'],
    order: 2,
    examples: ['comer → como, comes, come', 'beber → bebo, bebes, bebe'],
    icon: '🍽️' // eating
  },
  {
    id: 'regular-present-ir',
    name: 'Regular -IR Verbs (Present)',
    description: 'Regular -IR verbs in present tense: drop -ir and add endings (-o, -es, -e, -imos, -ís, -en)',
    category: 'regular',
    tenses: ['present'],
    order: 3,
    examples: ['vivir → vivo, vives, vive', 'escribir → escribo, escribes, escribe'],
    icon: '✍️' // writing/living
  },

  // 2. Common Irregular Present Tense
  {
    id: 'ser-estar-present',
    name: 'Ser & Estar (Present)',
    description: 'The most important irregular verbs: ser (to be permanent) and estar (to be temporary)',
    category: 'irregular',
    tenses: ['present'],
    order: 4,
    examples: ['ser → soy, eres, es', 'estar → estoy, estás, está'],
    icon: '🫰' // being/existence
  },
  {
    id: 'ir-present',
    name: 'Ir (Present)',
    description: 'Irregular verb "ir" (to go): voy, vas, va, vamos, vais, van',
    category: 'irregular',
    tenses: ['present'],
    order: 5,
    examples: ['ir → voy, vas, va, vamos, vais, van'],
    icon: '🚶' // going/movement
  },

  // 3. Yo-form irregulars (common ones first)
  {
    id: 'go-verbs-present',
    name: 'Go-ending Yo Forms (Present)',
    description: 'Verbs where "yo" form ends in -go: tener→tengo, poner→pongo, salir→salgo, etc.',
    category: 'yo-irregular',
    tenses: ['present'],
    order: 6,
    examples: ['tener → tengo', 'poner → pongo', 'salir → salgo', 'venir → vengo'],
    icon: '👉' // pointing (yo form)
  },
  {
    id: 'zco-verbs-present',
    name: 'Zco-ending Yo Forms (Present)',
    description: 'Verbs ending in -cer/-cir after vowel: conocer→conozco, conducir→conduzco',
    category: 'yo-irregular',
    tenses: ['present'],
    order: 7,
    examples: ['conocer → conozco', 'conducir → conduzco', 'traducir → traduzco'],
    icon: '🧠' // knowing/translating
  },

  // 4. Stem-changing verbs (start with most common)
  {
    id: 'e-ie-present',
    name: 'e→ie Stem Changes (Present)',
    description: 'Stem changes e→ie in present tense (all forms except nosotros/vosotros)',
    category: 'stem-changing',
    tenses: ['present'],
    order: 8,
    examples: ['pensar → pienso, piensas, piensa', 'querer → quiero, quieres, quiere'],
    icon: '💭' // thinking
  },
  {
    id: 'o-ue-present',
    name: 'o→ue Stem Changes (Present)',
    description: 'Stem changes o→ue in present tense (all forms except nosotros/vosotros)',
    category: 'stem-changing',
    tenses: ['present'],
    order: 9,
    examples: ['poder → puedo, puedes, puede', 'dormir → duermo, duermes, duerme'],
    icon: '💪' // power/ability
  },
  {
    id: 'e-i-present',
    name: 'e→i Stem Changes (Present)',
    description: 'Stem changes e→i in present tense (all forms except nosotros/vosotros)',
    category: 'stem-changing',
    tenses: ['present'],
    order: 10,
    examples: ['pedir → pido, pides, pide', 'servir → sirvo, sirves, sirve'],
    icon: '🙏' // asking/serving
  },

  // 5. Past tenses - start with preterite regular
  {
    id: 'regular-preterite-ar',
    name: 'Regular -AR Verbs (Preterite)',
    description: 'Regular -AR verbs in preterite (simple past): drop -ar and add endings (-é, -aste, -ó, -amos, -asteis, -aron)',
    category: 'regular',
    tenses: ['preterite'],
    order: 11,
    examples: ['hablar → hablé, hablaste, habló', 'caminar → caminé, caminaste, caminó'],
    icon: '📅' // past/completed
  },
  {
    id: 'regular-preterite-er-ir',
    name: 'Regular -ER/-IR Verbs (Preterite)',
    description: 'Regular -ER/-IR verbs in preterite: drop ending and add (-í, -iste, -ió, -imos, -isteis, -ieron)',
    category: 'regular',
    tenses: ['preterite'],
    order: 12,
    examples: ['comer → comí, comiste, comió', 'vivir → viví, viviste, vivió'],
    icon: '✅' // completed action
  },

  // 6. Common irregular preterites
  {
    id: 'ir-ser-preterite',
    name: 'Ir & Ser (Preterite)',
    description: 'Ir and Ser have identical preterite forms: fui, fuiste, fue, fuimos, fuisteis, fueron',
    category: 'irregular',
    tenses: ['preterite'],
    order: 13,
    examples: ['ir/ser → fui, fuiste, fue, fuimos, fuisteis, fueron'],
    icon: '🔄' // same forms
  },
  {
    id: 'u-stem-preterite',
    name: 'U-stem Irregulars (Preterite)',
    description: 'Irregular preterite with U-stem: tener→tuve, estar→estuve, poder→pude, etc.',
    category: 'irregular',
    tenses: ['preterite'],
    order: 14,
    examples: ['tener → tuve', 'estar → estuve', 'poder → pude', 'poner → puse'],
    icon: '🔧' // change/transformation
  },
  {
    id: 'i-stem-preterite',
    name: 'I-stem Irregulars (Preterite)',
    description: 'Irregular preterite with I-stem: hacer→hice, querer→quise, venir→vine',
    category: 'irregular',
    tenses: ['preterite'],
    order: 15,
    examples: ['hacer → hice', 'querer → quise', 'venir → vine'],
    icon: '⚡' // quick action
  },

  // 7. Imperfect (easier than preterite!)
  {
    id: 'regular-imperfect-ar',
    name: 'Regular -AR Verbs (Imperfect)',
    description: 'Regular -AR verbs in imperfect (ongoing past): drop -ar and add endings (-aba, -abas, -aba, -ábamos, -abais, -aban)',
    category: 'regular',
    tenses: ['imperfect'],
    order: 16,
    examples: ['hablar → hablaba, hablabas, hablaba', 'caminar → caminaba, caminabas, caminaba'],
    icon: '🔄' // ongoing/repetitive
  },
  {
    id: 'regular-imperfect-er-ir',
    name: 'Regular -ER/-IR Verbs (Imperfect)',
    description: 'Regular -ER/-IR verbs in imperfect: drop ending and add (-ía, -ías, -ía, -íamos, -íais, -ían)',
    category: 'regular',
    tenses: ['imperfect'],
    order: 17,
    examples: ['comer → comía, comías, comía', 'vivir → vivía, vivías, vivía'],
    icon: '📖' // ongoing story
  },
  {
    id: 'irregular-imperfect',
    name: 'Irregular Imperfect (Only 3!)',
    description: 'Only 3 irregular imperfect verbs: ir→iba, ser→era, ver→veía',
    category: 'irregular',
    tenses: ['imperfect'],
    order: 18,
    examples: ['ir → iba, ibas, iba', 'ser → era, eras, era', 'ver → veía, veías, veía'],
    icon: '3️⃣' // only 3 irregulars
  },

  // 8. Future tense (easy - add to infinitive)
  {
    id: 'regular-future',
    name: 'Regular Future Tense',
    description: 'All regular verbs use infinitive + endings: -é, -ás, -á, -emos, -éis, -án',
    category: 'regular',
    tenses: ['future'],
    order: 19,
    examples: ['hablar → hablaré', 'comer → comeré', 'vivir → viviré'],
    icon: '🔮' // future/crystal ball
  },
  {
    id: 'irregular-future-stems',
    name: 'Irregular Future Stems',
    description: 'Some verbs have irregular stems but regular endings: tener→tendr-, salir→saldr-, etc.',
    category: 'irregular',
    tenses: ['future'],
    order: 20,
    examples: ['tener → tendré', 'salir → saldré', 'venir → vendré', 'poner → pondré'],
    icon: '🎯' // target/goal
  },

  // 9. Conditional (same stems as future)
  {
    id: 'regular-conditional',
    name: 'Regular Conditional',
    description: 'All regular verbs use infinitive + endings: -ía, -ías, -ía, -íamos, -íais, -ían',
    category: 'regular',
    tenses: ['conditional'],
    order: 21,
    examples: ['hablar → hablaría', 'comer → comería', 'vivir → viviría'],
    icon: '🤔' // would/hypothetical
  },
  {
    id: 'irregular-conditional-stems',
    name: 'Irregular Conditional Stems',
    description: 'Same irregular stems as future tense: tener→tendr-, salir→saldr-, etc.',
    category: 'irregular',
    tenses: ['conditional'],
    order: 22,
    examples: ['tener → tendría', 'salir → saldría', 'venir → vendría', 'poner → pondría'],
    icon: '💭' // hypothetical thinking
  },

  // 10. Present subjunctive (advanced)
  {
    id: 'regular-present-subjunctive',
    name: 'Regular Present Subjunctive',
    description: 'Take yo present form, drop -o, add opposite endings: -AR→-e,-es,-e,-emos,-éis,-en; -ER/IR→-a,-as,-a,-amos,-áis,-an',
    category: 'regular',
    tenses: ['present_subjunctive'],
    order: 23,
    examples: ['hablar → hable, hables, hable', 'comer → coma, comas, coma'],
    icon: '🎭' // subjective/emotional
  },
  {
    id: 'irregular-present-subjunctive',
    name: 'Irregular Present Subjunctive',
    description: 'Stem-changing and yo-irregular verbs carry irregularities into subjunctive',
    category: 'irregular',
    tenses: ['present_subjunctive'],
    order: 24,
    examples: ['tener → tenga', 'conocer → conozca', 'pensar → piense'],
    icon: '🌟' // special/unique
  }
];

// Tense icons for UI
export const TENSE_ICONS = {
  present: '🗣️',
  preterite: '✅', 
  imperfect: '📖',
  future: '🔮',
  conditional: '🤔',
  present_subjunctive: '🎭'
} as const;

// Helper function to get rules by order
export function getRulesByOrder(): ConjugationRule[] {
  return CONJUGATION_RULES.sort((a, b) => a.order - b.order);
}

// Helper function to get rules by category
export function getRulesByCategory(category: ConjugationRule['category']): ConjugationRule[] {
  return CONJUGATION_RULES.filter(rule => rule.category === category);
}

// Helper function to get next rule to unlock
export function getNextRule(unlockedRuleIds: string[]): ConjugationRule | null {
  const sortedRules = getRulesByOrder();
  return sortedRules.find(rule => !unlockedRuleIds.includes(rule.id)) || null;
}