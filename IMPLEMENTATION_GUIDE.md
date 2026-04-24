# User Ranking System - Implementation Guide

## Quick Start

### Database Setup
The system requires new fields in the User model. If running an existing system:

```bash
# Add indexes for performance
db.users.createIndex({ buddyBucket: 1 })
db.users.createIndex({ dateBucket: 1 })
db.users.createIndex({ buddyCompatibilityScore: -1 })
db.users.createIndex({ dateCompatibilityScore: -1 })
db.users.createIndex({ "newUserWindow.isNewUser": 1 })
db.users.createIndex({ boostedUntil: 1 })
```

### Initial Bucket Calculation
Run these commands once during deployment to initialize bucket assignments:

```typescript
// From any Node.js context (API route, cron job, admin panel)
import { BucketCategorization } from './ranking/bucket.service';

// Calculate buckets for Buddy mode
await BucketCategorization.recategorizeAllUsers("buddy");

// Calculate buckets for Dating mode  
await BucketCategorization.recategorizeAllUsers("date");

console.log("Bucket recalculation complete!");
```

### Scheduled Maintenance
Add these tasks to your job queue (Bull, Bee-Queue, etc.):

```typescript
// Recalculate buckets daily (off-peak hours recommended)
// Schedule this for 3 AM daily
const job = queue.add(
  'recalculate-buckets',
  { mode: 'buddy' },
  { repeat: { pattern: '0 3 * * *' } }
);

// Handle the job
queue.process('recalculate-buckets', async (job) => {
  const { mode } = job.data;
  await BucketCategorization.recategorizeAllUsers(mode);
});
```

## Architecture Overview

```
Discovery Request
    ↓
Discovery Controller
    ↓
Discovery Service (validates filters, checks permissions)
    ↓
SwipeDeckService.generateSwipeDeck()
    ├─→ Get eligible users (exclude swiped/blocked)
    ├─→ Get users from each bucket (A, B, C)
    ├─→ Get new users (< 72 hours old)
    ├─→ Score all users
    │   ├─→ Calculate base score (compatibility + desire)
    │   ├─→ Apply trust penalty
    │   └─→ Apply boost bonus
    ├─→ Build balanced batch (50% A, 30% B, 20% C)
    ├─→ Apply new user spacing
    └─→ Return paginated results

Response
    ↓
Discovery Controller (transform, send)
    ↓
Client App
```

## File Structure

```
src/app/modules/Discovery/
├── discovery.controller.ts      # Handles HTTP requests
├── discovery.service.ts         # Main service (now uses new ranking)
├── discovery.routes.ts          # Route definitions
├── scoring.service.ts           # CS & DS calculations
├── bucket.service.ts            # Bucket categorization
├── ranking.utils.ts             # Score modifiers & spacing
├── swiped-deck.service.ts       # Deck generation orchestration
└── ranking.types.ts             # TypeScript definitions
```

## Usage Examples

### Example 1: Get Swipe Deck for Buddy Mode User
```typescript
const deck = await SwipeDeckService.generateSwipeDeck(
  userId,
  "buddy",
  { gender: "Women", minDistance: 0, maxDistance: 50 },
  1  // page
);

console.log(`Got ${deck.users.length} users`);
console.log(`Bucket A: ${deck.metadata.bucketDistribution.A}`);
console.log(`New users: ${deck.metadata.newUsersIncluded}`);
```

### Example 2: Manual Score Update
```typescript
import { DesireScoring } from './scoring.service';
import { BucketCategorization } from './bucket.service';

const bds = await DesireScoring.calculateBDS(userId);
const bcs = BuddyCompatibilityScoring.calculateBCS(
  currentUser,
  targetUser,
  distanceKm
);

const baseScore = BucketCategorization.calculateBuddyBaseScore({
  buddyCompatibilityScore: bcs,
  buddyDesireScore: bds,
});

const bucket = BucketCategorization.assignBucket(baseScore);

await User.findByIdAndUpdate(userId, {
  buddyCompatibilityScore: bcs,
  buddyDesireScore: bds,
  buddyBucket: bucket,
});
```

### Example 3: Apply Boost
```typescript
import { PaidBoostModifier } from './ranking.utils';

// Grant a 48-hour boost
const boostUntil = new Date(Date.now() + 48 * 60 * 60 * 1000);

await User.findByIdAndUpdate(userId, {
  boostedUntil: boostUntil,
  isCurrentlyBoosted: true,
  boostType: "MANUAL",
  boostsUsedThisMonth: (user.boostsUsedThisMonth || 0) + 1,
});

console.log(`User boosted until ${boostUntil}`);
```

### Example 4: Check New User Status
```typescript
import { NewUserBoost } from './ranking.utils';

const isNewUser = NewUserBoost.isNewUser(user);
const remainingHours = NewUserBoost.getRemainingNewUserHours(user);

if (isNewUser) {
  console.log(`New user with ${remainingHours.toFixed(1)} hours remaining`);
} else {
  console.log("User is no longer new");
}
```

## Scoring Deep Dive

### Buddy Mode Example
```
User A wants to find a golf buddy

Compatibility factors with User B:
- Skill Match (A: Intermediate, B: Intermediate) = 100 × 0.3 = 30
- Play Style (A: Chill, B: Social) = 75 × 0.2 = 15
- Play Vibe (A: Friendly, B: Music) = 75 × 0.15 = 11.25
- Intent (both casual) = 100 × 0.15 = 15
- Home Course (both within 5km) = 100 × 0.1 = 10
- Distance (2km away) = 100 × 0.1 = 10
BCS = 30 + 15 + 11.25 + 15 + 10 + 10 = 91.25 ≈ 91

Desire factors for User B:
- Match Rate (B got 8 matches from 10 likes sent) = 80 × 0.8 = 64
- Like Rate (B got 25 likes from 30 swipes) = 83 × 0.2 = 16.6
BDS = 64 + 16.6 = 80.6 ≈ 81

Base Score = (91 × 0.7) + (81 × 0.3) = 63.7 + 24.3 = 88

Modifiers:
- Trust Score: GREEN (no penalty)
- Boost: Active (+20% bonus)

Final Score = 88 × 1.0 × 1.2 = 105.6 ≈ 106

But scores are capped at 100, so Final Score = 100
```

### Dating Mode Example
```
User C wants to find a dating partner

Compatibility factors with User D:
- Skill Match (C: Beginner, D: Intermediate) = 80 × 0.2 = 16
- Dating Intent (C: Long-term, D: Long-term) = 100 × 0.3 = 30
- Lifestyle (3/6 factors match) = 50 × 0.3 = 15
- Distance (8km away) = 100 × 0.2 = 20
DCS = 16 + 30 + 15 + 20 = 81

Desire factors for User D:
- Match Rate = 70 × 0.8 = 56
- Like Rate = 60 × 0.2 = 12
DDS = 56 + 12 = 68

Base Score = (81 × 0.4) + (68 × 0.6) = 32.4 + 40.8 = 73.2 ≈ 73

Modifiers:
- Trust Score: ORANGE (-20% penalty)
- Boost: Inactive (no bonus)

Final Score = 73 × 0.8 × 1.0 = 58.4 ≈ 58
```

## Performance Optimization

### Query Optimization
The system uses indexed queries for fast retrieval:

```typescript
// Fast queries thanks to indexes
await User.find({ buddyBucket: "A" })
  .sort({ buddyCompatibilityScore: -1 })
  .limit(100);

// New user query (also indexed)
await User.find({ "newUserWindow.isNewUser": true })
  .sort({ createdAt: -1 });
```

### Caching Strategy (Optional)
Consider caching bucket lists to reduce database queries:

```typescript
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// In bucket service
const cache = new Map<string, { data: any[], expiry: number }>();

static async getUsersByBucket(bucket, mode, excludeIds, limit) {
  const cacheKey = `${mode}-${bucket}`;
  const cached = cache.get(cacheKey);
  
  if (cached && cached.expiry > Date.now()) {
    return cached.data.filter(u => !excludeIds.includes(u._id));
  }
  
  // Fetch from DB
  const data = await User.find(...)...;
  cache.set(cacheKey, { data, expiry: Date.now() + CACHE_DURATION });
  return data;
}
```

### Batch Processing
For large user bases, consider batch processing scores:

```typescript
// Batch calculate scores every night
async function batchCalculateScores(batchSize = 1000) {
  const total = await User.countDocuments();
  
  for (let i = 0; i < total; i += batchSize) {
    const users = await User.find()
      .skip(i)
      .limit(batchSize);
    
    await Promise.all(
      users.map(u => updateUserScores(u))
    );
  }
}
```

## Monitoring & Debugging

### Health Check
```typescript
// Add this endpoint to check system status
app.get("/api/ranking/health", async (req, res) => {
  const userCount = await User.countDocuments();
  const bucketACounts = await User.countDocuments({ buddyBucket: "A" });
  const boostedCount = await User.countDocuments({ isCurrentlyBoosted: true });
  const newUserCount = await User.countDocuments({ "newUserWindow.isNewUser": true });
  
  res.json({
    totalUsers: userCount,
    bucketing: {
      A: bucketACounts,
      B: await User.countDocuments({ buddyBucket: "B" }),
      C: await User.countDocuments({ buddyBucket: "C" }),
    },
    boosted: boostedCount,
    newUsers: newUserCount,
    timestamp: new Date(),
  });
});
```

### Debug Scoring
```typescript
// View detailed score breakdown
async function debugUserScore(userId) {
  const user = await User.findById(userId);
  
  return {
    bcs: user.buddyCompatibilityScore,
    bds: user.buddyDesireScore,
    dcs: user.dateCompatibilityScore,
    dds: user.dateDesireScore,
    buddyBase: (user.buddyCompatibilityScore * 0.7) + (user.buddyDesireScore * 0.3),
    dateBase: (user.dateCompatibilityScore * 0.4) + (user.dateDesireScore * 0.6),
    bucket: { buddy: user.buddyBucket, date: user.dateBucket },
    trustScore: user.trustScore,
    isBoosted: user.isCurrentlyBoosted,
    isNewUser: user.newUserWindow.isNewUser,
    lastScoreUpdate: user.scoreMetadata?.lastScoreCalculation,
  };
}
```

## Testing Recommendations

### Unit Tests
```typescript
describe('BuddyCompatibilityScoring', () => {
  it('should calculate skill match correctly', () => {
    const score = BuddyCompatibilityScoring.calculateSkillMatch('Intermediate', 'Advanced');
    expect(score).toBe(85);
  });

  it('should calculate complete BCS', () => {
    const user1 = mockUser({ skillLevel: 'Intermediate', vibe: { playStyles: 'CHILL' } });
    const user2 = mockUser({ skillLevel: 'Intermediate', vibe: { playStyles: 'SOCIAL_GOLFER' } });
    const bcs = BuddyCompatibilityScoring.calculateBCS(user1, user2, 5);
    expect(bcs).toBeGreaterThan(70);
  });
});
```

### Integration Tests
```typescript
describe('SwipeDeckService', () => {
  it('should generate balanced deck', async () => {
    const deck = await SwipeDeckService.generateSwipeDeck(userId, 'buddy', {}, 1);
    
    expect(deck.users.length).toBeLessThanOrEqual(20);
    expect(deck.metadata.bucketDistribution.A).toBeCloseTo(10, 1);
    expect(deck.metadata.bucketDistribution.B).toBeCloseTo(6, 1);
    expect(deck.metadata.bucketDistribution.C).toBeCloseTo(4, 1);
  });

  it('should include new users with proper spacing', async () => {
    const deck = await SwipeDeckService.generateSwipeDeck(userId, 'buddy', {}, 1);
    const newUserIndices = deck.users
      .map((u, i) => u.isNewUser ? i : -1)
      .filter(i => i !== -1);
    
    // Verify spacing
    for (let i = 1; i < newUserIndices.length; i++) {
      const gap = newUserIndices[i] - newUserIndices[i-1];
      expect(gap).toBeGreaterThanOrEqual(3);
    }
  });
});
```

## Troubleshooting Guide

### Problem: Users not appearing in swipe deck
**Solution**: 
1. Verify user is not in excluded list: `db.swipes.findOne({ fromUser: authUserId, toUser: targetUserId })`
2. Check profile complete: `user.isProfileComplete === true`
3. Ensure location set: `user.location.coordinates != null`
4. Verify not blocked: `!me.blockedUsers.includes(targetUserId)`

### Problem: Bucket distribution is uneven
**Solution**:
1. Recalculate buckets: `await BucketCategorization.recategorizeAllUsers('buddy')`
2. Verify and fix: `await BucketCategorization.verifyAndFixBuckets('buddy')`
3. Check for missing scores: `db.users.find({ buddyCompatibilityScore: 0 }).count()`

### Problem: Boosts not applying
**Solution**:
1. Check `boostedUntil` is in future: `user.boostedUntil > new Date()`
2. Verify `isCurrentlyBoosted` flag: `user.isCurrentlyBoosted === true`
3. Check final score calculation includes boost

### Problem: New users showing too frequently
**Solution**:
1. Reduce `NewUserBoost.NEW_USERS_PER_BATCH` from 3 to 2
2. Increase spacing interval in `NewUserSpacing.buildSpacedDeck()`
3. Verify 72-hour window is correct: `await NewUserBoost.updateNewUserStatus(userId)`

## Next Steps

1. **Deploy**: Run migrations, add indexes, initialize buckets
2. **Monitor**: Set up health checks and dashboards
3. **Optimize**: Gather metrics, adjust weights based on match rates
4. **Extend**: Add machine learning for dynamic score adjustments
5. **Iterate**: A/B test different bucket distributions

## Support & Questions

For detailed algorithm explanations, see `RANKING_SYSTEM_DOCUMENTATION.md`.
For API changes, check `ranking.types.ts` for interface definitions.
