import { db } from '../src/server/db/index';
import { verbRules } from '../src/server/db/schema';
import { CONJUGATION_RULES } from '../src/lib/conjugation-rules';

async function seedVerbRules() {
  console.log('Starting to seed verb rules...');
  
  try {
    // Clear existing rules
    await db.delete(verbRules);
    
    // Insert all rules
    for (const rule of CONJUGATION_RULES) {
      await db.insert(verbRules).values({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        category: rule.category,
        tenses: rule.tenses,
        order: rule.order,
        isUnlocked: rule.order === 1 // Only unlock the first rule by default
      });
      console.log(`✓ Seeded rule: ${rule.name}`);
    }
    
    console.log(`Successfully seeded ${CONJUGATION_RULES.length} verb rules!`);
  } catch (error) {
    console.error('Error seeding verb rules:', error);
    process.exit(1);
  }
}

// Run if called directly
seedVerbRules()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

export { seedVerbRules };