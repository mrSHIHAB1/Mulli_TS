# Quick Reference: Mulli Ranking System

## One-Minute Overview

The ranking system determines which users appear on the swipe screen based on:
1. **Compatibility Score (CS)**: How well matched the users are
2. **Desire Score (DS)**: How desirable/popular the user is  
3. **Bucket**: Which tier (A/B/C) the user falls into
4. **Modifiers**: Trust score penalty, paid boost bonus
5. **New User Boost**: Special 72-hour window for new users

**Result**: Users are shown in batches of 20, with 50% from top tier, 30% from middle, 20% from bottom, and 3 new users mixed in with intelligent spacing.

## Scoring at a Glance

### Buddy Mode Base Score
```
Base Score = (BCS × 0.7) + (BDS × 0.3)
         where BCS = Skill(30%) + PlayStyle(20%) + Vibe(15%) + Intent(15%) + HomeCourse(10%) + Location(10%)
               BDS = MatchRate(80%) + LikeRate(20%)
```

### Dating Mode Base Score
```
Base Score = (DCS × 0.4) + (DDS × 0.6)
         where DCS = Skill(20%) + Intent(30%) + Lifestyle(30%) + Location(20%)
               DDS = MatchRate(80%) + LikeRate(20%)
```

### Final Score
```
Final Score = Base Score × TrustMultiplier × BoostMultiplier

Trust Multipliers:
  RED:    0.6  (-40%)
  ORANGE: 0.8  (-20%)
  GREEN:  1.0  (no penalty)

Boost Multipliers:
  Active:   1.2  (+20%)
  Inactive: 1.0  (no bonus)
```

## Bucket Distribution

| Bucket | Score | Appearance | Per 20 Batch |
|--------|-------|------------|-------------|
| A      | 70-100| 50%        | 10 users    |
| B      | 40-69 | 30%        | 6 users     |
| C      | 0-39  | 20%        | 4 users     |

Plus 3 new users (15%) = 20 total per batch

## File Reference

| File | Purpose | Key Classes |
|------|---------|------------|
| scoring.service.ts | Calculate CS & DS | BuddyCompatibilityScoring, DatingCompatibilityScoring, DesireScoring |
| bucket.service.ts | Categorize users | BucketCategorization |
| ranking.utils.ts | Apply modifiers | TrustScoreModifier, PaidBoostModifier, NewUserBoost, NewUserSpacing |
| swiped-deck.service.ts | Build decks | SwipeDeckService |
| discovery.service.ts | API endpoint | discoveryService |
| ranking.types.ts | Type definitions | IUserWithScore, ISwipeDeck, etc. |

## Common Tasks

### Initialize System
```typescript
// Run once on deployment
await BucketCategorization.recategorizeAllUsers("buddy");
await BucketCategorization.recategorizeAllUsers("date");
```

### Daily Maintenance
```typescript
// Schedule to run at 3 AM daily
await BucketCategorization.recategorizeAllUsers("buddy");
await BucketCategorization.recategorizeAllUsers("date");
```

### Grant Boost
```typescript
const boostUntil = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
await User.findByIdAndUpdate(userId, {
  boostedUntil: boostUntil,
  isCurrentlyBoosted: true,
  boostType: "MANUAL",
});
```

### Check User Status
```typescript
const scoreInfo = await FinalScoreCalculator.prepareUserScore(userId, "buddy");
console.log(`Base: ${scoreInfo.baseScore}, Final: ${scoreInfo.finalScore}`);

const isNew = NewUserBoost.isNewUser(user);
const newUserHours = NewUserBoost.getRemainingNewUserHours(user);
```

### Get User's Deck
```typescript
const deck = await SwipeDeckService.generateSwipeDeck(userId, "buddy", {}, 1);
// deck.users = array of 20 users
// deck.metadata.bucketDistribution = { A: 10, B: 6, C: 4 }
// deck.metadata.newUsersIncluded = 1 or 2 or 3
```

## Weights & Thresholds

### Scoring Weights

**Buddy Compatibility (BCS)**
- Skill Match: 30%
- Play Style: 20%
- Play Vibe: 15%
- Intent: 15%
- Home Course: 10%
- Location: 10%

**Dating Compatibility (DCS)**
- Skill Match: 20%
- Dating Intent: 30%
- Lifestyle: 30%
- Location: 20%

**Both Desire Scores**
- Match Rate: 80%
- Like Rate: 20%

**Base Score Weights**
- Buddy: CS(70%) + DS(30%)
- Dating: CS(40%) + DS(60%)

### Bucket Thresholds
- Bucket A: ≥ 70
- Bucket B: 40-69
- Bucket C: < 40

### Time Windows
- New user window: 72 hours
- Bucket recalc: 24 hours
- Cache TTL: Variable (see implementation)

## API Response

```json
{
  "users": [
    {
      "id": "user123",
      "firstName": "John",
      "lastName": "Doe",
      "age": 28,
      "gender": "Men",
      "bucket": "A",
      "baseScore": 85,
      "finalScore": 102,
      "isNewUser": false,
      "trustScore": "GREEN",
      "isBoosted": true,
      "distanceKm": 5.2,
      "skillLevel": "Intermediate",
      "hopingToFind": "Long_Term",
      "playstyle": "Golf_Buddy"
    }
  ],
  "pagination": {
    "total": 150,
    "currentPage": 1,
    "perPage": 20,
    "totalPages": 8
  },
  "metadata": {
    "bucketDistribution": { "A": 10, "B": 6, "C": 4 },
    "newUsersIncluded": 1,
    "averageScore": 72
  }
}
```

## Debugging Checklist

| Issue | Check |
|-------|-------|
| User not showing | Swiped? Blocked? Profile complete? Location set? |
| Wrong bucket | Scores calculated? Thresholds correct? 24hr passed? |
| Uneven distribution | Run verify & fix: `recategorizeAllUsers()` |
| Boost not working | `boostedUntil` > now? `isCurrentlyBoosted` = true? |
| New users wrong | In 72hr window? `isNewUser` flag set? |
| Spacing broken | Too many consecutive new users? |

## New User Spacing Pattern

**Good Pattern**
```
New → Normal → Normal → Normal → New → Normal → Normal → Normal → New
1     2       3       4       5     6       7       8       9
```

**Bad Pattern** ❌
```
New → New → Normal → Normal → New
```

**Minimum Gap**: 3 swipes between new users

## Mode Detection

```typescript
// System automatically uses:
if (user.playstyle === "Golf_Date") {
  // Use Dating mode (DCS, DDS, dateBucket)
} else {
  // Use Buddy mode (BCS, BDS, buddyBucket)
}
```

## Database Fields

### Scoring
- `buddyCompatibilityScore` (0-100)
- `buddyDesireScore` (0-100)
- `dateCompatibilityScore` (0-100)
- `dateDesireScore` (0-100)

### Bucketing
- `buddyBucket` (A|B|C)
- `dateBucket` (A|B|C)
- `bucketCalculatedAt`

### Trust & Boost
- `trustScore` (RED|ORANGE|GREEN)
- `trustScoreUpdatedAt`
- `boostedUntil`
- `isCurrentlyBoosted`
- `boostType` (MANUAL|SUBSCRIPTION)

### New Users
- `newUserWindow.isNewUser`
- `newUserWindow.signedUpAt`
- `newUserWindow.newUserWindowExpiresAt`

### Metadata
- `scoreMetadata.matchRate`
- `scoreMetadata.likeRate`
- `scoreMetadata.totalLikesReceived`
- `scoreMetadata.totalSwipesReceived`
- `scoreMetadata.lastScoreCalculation`

## Performance Tips

1. **Index these fields**:
   ```
   buddyBucket, dateBucket, buddyCompatibilityScore, 
   dateCompatibilityScore, newUserWindow.isNewUser, boostedUntil
   ```

2. **Cache bucket lists** (24-hour TTL)

3. **Batch score calculations** (run off-peak)

4. **Limit queries** with pagination (20 per page)

5. **Monitor health** with `/api/ranking/health` endpoint

## Key Concepts

- **Base Score**: CS + DS combination, determines bucket
- **Final Score**: Base score after applying modifiers, determines rank within bucket
- **Bucket**: Tier (A/B/C) determining frequency of appearance
- **Modifier**: Trust penalty or boost bonus applied to final score
- **New User Window**: Special 72-hour visibility period for new profiles
- **Spacing**: Algorithm to distribute new users evenly (1 per 3-5 swipes)
- **Dealbreaker**: Filter that overrides all scores and completely excludes users

## Contact & Support

- Full documentation: `RANKING_SYSTEM_DOCUMENTATION.md`
- Implementation guide: `IMPLEMENTATION_GUIDE.md`
- Type definitions: `src/app/modules/Discovery/ranking.types.ts`
