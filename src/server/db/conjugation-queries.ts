import { db } from './index';
import { 
  verbRules, 
  conjugationDrills, 
  userRuleProgress, 
  userDrillAttempts, 
  drillSessions,
  type NewVerbRule,
  type NewConjugationDrill,
  type NewUserRuleProgress,
  type NewUserDrillAttempt,
  type NewDrillSession,
  type VerbRule,
  type ConjugationDrill,
  type UserRuleProgress,
  type DrillSession
} from './schema';
import { eq, and, desc, asc, inArray } from 'drizzle-orm';

// === VERB RULES ===
export async function createVerbRule(data: NewVerbRule) {
  const [rule] = await db.insert(verbRules).values(data).returning();
  return rule;
}

export async function getVerbRules() {
  return await db.select().from(verbRules).orderBy(asc(verbRules.order));
}

export async function getVerbRuleById(id: string) {
  const [rule] = await db.select().from(verbRules).where(eq(verbRules.id, id));
  return rule || null;
}

export async function updateVerbRule(id: string, data: Partial<NewVerbRule>) {
  const [updated] = await db
    .update(verbRules)
    .set(data)
    .where(eq(verbRules.id, id))
    .returning();
  return updated || null;
}

// === CONJUGATION DRILLS ===
export async function createConjugationDrill(data: NewConjugationDrill) {
  const [drill] = await db.insert(conjugationDrills).values(data).returning();
  return drill;
}

export async function getConjugationDrills() {
  return await db.select().from(conjugationDrills).orderBy(desc(conjugationDrills.createdAt));
}

export async function getConjugationDrillById(id: string) {
  const [drill] = await db.select().from(conjugationDrills).where(eq(conjugationDrills.id, id));
  return drill || null;
}

export async function getConjugationDrillsByRule(ruleId: string) {
  return await db
    .select()
    .from(conjugationDrills)
    .where(eq(conjugationDrills.ruleId, ruleId))
    .orderBy(desc(conjugationDrills.createdAt));
}

export async function getConjugationDrillsByIds(drillIds: string[]) {
  if (drillIds.length === 0) return [];
  return await db
    .select()
    .from(conjugationDrills)
    .where(inArray(conjugationDrills.id, drillIds));
}

// === USER RULE PROGRESS ===
export async function createUserRuleProgress(data: NewUserRuleProgress) {
  const [progress] = await db.insert(userRuleProgress).values(data).returning();
  return progress;
}

export async function getUserRuleProgress(userId: string) {
  return await db
    .select()
    .from(userRuleProgress)
    .where(eq(userRuleProgress.userId, userId))
    .orderBy(asc(userRuleProgress.createdAt));
}

export async function getUserRuleProgressByRule(userId: string, ruleId: string) {
  const [progress] = await db
    .select()
    .from(userRuleProgress)
    .where(and(
      eq(userRuleProgress.userId, userId),
      eq(userRuleProgress.ruleId, ruleId)
    ));
  return progress || null;
}

export async function updateUserRuleProgress(userId: string, ruleId: string, data: Partial<NewUserRuleProgress>) {
  const [updated] = await db
    .update(userRuleProgress)
    .set({ ...data, updatedAt: new Date() })
    .where(and(
      eq(userRuleProgress.userId, userId),
      eq(userRuleProgress.ruleId, ruleId)
    ))
    .returning();
  return updated || null;
}

export async function unlockUserRule(userId: string, ruleId: string) {
  const existing = await getUserRuleProgressByRule(userId, ruleId);
  
  if (existing) {
    return await updateUserRuleProgress(userId, ruleId, {
      isUnlocked: true,
      unlockedAt: new Date()
    });
  } else {
    return await createUserRuleProgress({
      id: `${userId}-${ruleId}`,
      userId,
      ruleId,
      isUnlocked: true,
      unlockedAt: new Date(),
      correctCount: 0,
      totalAttempts: 0
    });
  }
}

// === USER DRILL ATTEMPTS ===
export async function createUserDrillAttempt(data: NewUserDrillAttempt) {
  const [attempt] = await db.insert(userDrillAttempts).values(data).returning();
  return attempt;
}

export async function getUserDrillAttempts(userId: string) {
  return await db
    .select()
    .from(userDrillAttempts)
    .where(eq(userDrillAttempts.userId, userId))
    .orderBy(desc(userDrillAttempts.createdAt));
}

export async function getUserDrillAttemptsByDrill(userId: string, drillId: string) {
  return await db
    .select()
    .from(userDrillAttempts)
    .where(and(
      eq(userDrillAttempts.userId, userId),
      eq(userDrillAttempts.drillId, drillId)
    ))
    .orderBy(desc(userDrillAttempts.createdAt));
}

// === DRILL SESSIONS ===
export async function createDrillSession(data: NewDrillSession) {
  const [session] = await db.insert(drillSessions).values(data).returning();
  return session;
}

export async function getDrillSession(userId: string, sessionId: string) {
  const [session] = await db
    .select()
    .from(drillSessions)
    .where(and(
      eq(drillSessions.id, sessionId),
      eq(drillSessions.userId, userId)
    ));
  return session || null;
}

export async function getUserDrillSessions(userId: string) {
  return await db
    .select()
    .from(drillSessions)
    .where(eq(drillSessions.userId, userId))
    .orderBy(desc(drillSessions.createdAt));
}

export async function getActiveDrillSession(userId: string) {
  const [session] = await db
    .select()
    .from(drillSessions)
    .where(and(
      eq(drillSessions.userId, userId),
      eq(drillSessions.status, 'active')
    ))
    .orderBy(desc(drillSessions.createdAt));
  return session || null;
}

export async function completeDrillSession(userId: string, sessionId: string) {
  const [updated] = await db
    .update(drillSessions)
    .set({
      status: 'completed',
      completedAt: new Date()
    })
    .where(and(
      eq(drillSessions.id, sessionId),
      eq(drillSessions.userId, userId)
    ))
    .returning();
  return updated || null;
}

// === COMPLEX QUERIES ===

/**
 * Get user progress with rule details - creates initial progress if none exists
 */
export async function getUserProgressWithRules(userId: string) {
  const existingProgress = await db
    .select({
      progress: userRuleProgress,
      rule: verbRules
    })
    .from(userRuleProgress)
    .innerJoin(verbRules, eq(userRuleProgress.ruleId, verbRules.id))
    .where(eq(userRuleProgress.userId, userId))
    .orderBy(asc(verbRules.order));

  // If no progress exists, create initial progress for the first rule
  if (existingProgress.length === 0) {
    const firstRule = await db
      .select()
      .from(verbRules)
      .orderBy(asc(verbRules.order))
      .limit(1);
    
    if (firstRule.length > 0) {
      await createUserRuleProgress({
        id: `${userId}-${firstRule[0].id}`,
        userId,
        ruleId: firstRule[0].id,
        isUnlocked: true,
        unlockedAt: new Date(),
        correctCount: 0,
        totalAttempts: 0
      });
      
      // Return the newly created progress
      return await db
        .select({
          progress: userRuleProgress,
          rule: verbRules
        })
        .from(userRuleProgress)
        .innerJoin(verbRules, eq(userRuleProgress.ruleId, verbRules.id))
        .where(eq(userRuleProgress.userId, userId))
        .orderBy(asc(verbRules.order));
    }
  }

  return existingProgress;
}

/**
 * Get drill session with actual drill data
 */
export async function getDrillSessionWithDrills(userId: string, sessionId: string) {
  const session = await getDrillSession(userId, sessionId);
  if (!session) return null;

  const drills = await getConjugationDrillsByIds(session.drillIds);
  
  return {
    ...session,
    drills
  };
}

/**
 * Get recent drill attempts for a specific rule
 */
export async function getRecentDrillAttemptsForRule(userId: string, ruleId: string, limit: number = 20) {
  // First get all drills for this rule
  const rulesDrills = await getConjugationDrillsByRule(ruleId);
  const drillIds = rulesDrills.map(drill => drill.id);
  
  if (drillIds.length === 0) return [];

  return await db
    .select()
    .from(userDrillAttempts)
    .where(and(
      eq(userDrillAttempts.userId, userId),
      inArray(userDrillAttempts.drillId, drillIds)
    ))
    .orderBy(desc(userDrillAttempts.createdAt))
    .limit(limit);
}

/**
 * Check if user should unlock next rule based on recent performance
 */
export async function checkAndUnlockNextRule(userId: string, currentRuleId: string) {
  const recentAttempts = await getRecentDrillAttemptsForRule(userId, currentRuleId, 20);
  
  // Need at least 20 attempts to consider unlocking
  if (recentAttempts.length < 20) {
    return null;
  }

  // Calculate accuracy of last 20 attempts for current rule
  const correctCount = recentAttempts.filter(attempt => attempt.isCorrect).length;
  const accuracy = correctCount / recentAttempts.length;

  // Check if current rule meets 90% threshold
  if (accuracy >= 0.9) {
    // Get all rules ordered by sequence
    const allRules = await getVerbRules();
    const userProgress = await getUserProgressWithRules(userId);
    const unlockedRuleIds = userProgress
      .filter(p => p.progress.isUnlocked)
      .map(p => p.progress.ruleId);

    // Find the next rule that should be unlocked
    const nextRule = allRules.find(rule => !unlockedRuleIds.includes(rule.id));
    
    if (nextRule) {
      // Check that ALL previous rules (up to current one) meet 90% threshold
      const rulesUpToNext = allRules.filter(rule => rule.order < nextRule.order);
      
      // Check each rule's recent performance
      for (const rule of rulesUpToNext) {
        // Skip if rule is not unlocked yet (shouldn't happen but safety check)
        if (!unlockedRuleIds.includes(rule.id)) {
          continue;
        }
        
        const ruleRecentAttempts = await getRecentDrillAttemptsForRule(userId, rule.id, 20);
        
        // If rule has fewer than 20 attempts, it doesn't meet criteria
        if (ruleRecentAttempts.length < 20) {
          return null;
        }
        
        // Calculate accuracy for this rule
        const ruleCorrectCount = ruleRecentAttempts.filter(attempt => attempt.isCorrect).length;
        const ruleAccuracy = ruleCorrectCount / ruleRecentAttempts.length;
        
        // If any previous rule doesn't meet 90%, don't unlock
        if (ruleAccuracy < 0.9) {
          return null;
        }
      }
      
      // All previous rules meet criteria, unlock the next rule
      const unlockedProgress = await unlockUserRule(userId, nextRule.id);
      return {
        unlockedRule: nextRule,
        progress: unlockedProgress,
        triggerRuleId: currentRuleId,
        accuracy: Math.round(accuracy * 100)
      };
    }
  }

  return null;
}

/**
 * Get progress towards next rule unlock
 */
export async function getUnlockProgress(userId: string, ruleId: string) {
  const recentAttempts = await getRecentDrillAttemptsForRule(userId, ruleId, 20);
  const correctCount = recentAttempts.filter(attempt => attempt.isCorrect).length;
  
  return {
    totalAttempts: recentAttempts.length,
    correctCount,
    accuracy: recentAttempts.length > 0 ? correctCount / recentAttempts.length : 0,
    attemptsNeeded: Math.max(0, 20 - recentAttempts.length),
    accuracyNeeded: 0.9
  };
}

/**
 * Record a drill attempt and update user progress
 */
export async function recordDrillAttempt(data: {
  userId: string;
  drillId: string;
  userAnswer: string;
  isCorrect: boolean;
  timeSpent?: number;
}) {
  // Get the drill to find the rule
  const drill = await getConjugationDrillById(data.drillId);
  if (!drill) throw new Error('Drill not found');

  // Create the attempt
  const attempt = await createUserDrillAttempt({
    id: `${data.userId}-${data.drillId}-${Date.now()}`,
    userId: data.userId,
    drillId: data.drillId,
    userAnswer: data.userAnswer,
    isCorrect: data.isCorrect,
    timeSpent: data.timeSpent,
    status: 'completed'
  });

  // Update user rule progress
  const existingProgress = await getUserRuleProgressByRule(data.userId, drill.ruleId);
  
  if (existingProgress) {
    await updateUserRuleProgress(data.userId, drill.ruleId, {
      totalAttempts: existingProgress.totalAttempts + 1,
      correctCount: data.isCorrect 
        ? existingProgress.correctCount + 1 
        : existingProgress.correctCount,
      lastAttemptAt: new Date()
    });
  } else {
    await createUserRuleProgress({
      id: `${data.userId}-${drill.ruleId}`,
      userId: data.userId,
      ruleId: drill.ruleId,
      totalAttempts: 1,
      correctCount: data.isCorrect ? 1 : 0,
      lastAttemptAt: new Date(),
      isUnlocked: true,
      unlockedAt: new Date()
    });
  }

  // Check if this attempt triggers unlocking of the next rule
  const unlockResult = await checkAndUnlockNextRule(data.userId, drill.ruleId);

  return {
    attempt,
    unlockResult
  };
}