# Mulli User Ranking & Discovery System Documentation

## Overview

The user ranking system determines which users appear first on a user's swipe screen. It's a sophisticated, multi-factor scoring system that considers compatibility, desire, user behavior, and user preferences to create an optimized discovery experience.

## System Components

### 1. Scoring Services

#### `scoring.service.ts`
Calculates compatibility and desire scores for users.

**Buddy Mode Compatibility Score (BCS) - 0-100**
- Skill Match (30%): Alignment in golf skill levels
- Play Style (20%): Compatible playing styles (competitive, chill, fun, practice, social)
- Play Vibe (15%): Energy/vibe alignment (quiet/focused, friendly/social, music, drinks)
- Intent (15%): Matching reasons for golfing
- Home Course Match (10%): Preferred course distance alignment
- Location Distance (10%): Physical proximity bonus

**Dating Mode Compatibility Score (DCS) - 0-100**
- Skill Match (20%): Lifestyle activity alignment
- Dating Intent (30%): Relationship goal alignment (long-term, short-term, casual, ethical)
- Lifestyle Compatibility (30%): Education, politics, religion, cannabis, workout habits
- Location (20%): Physical proximity bonus

**Buddy Desire Score (BDS) - 0-100**
- Match Rate (80%): When this user likes others, do they get liked back?
- Like Rate (20%): How often do other users like this person?

**Dating Desire Score (DDS) - 0-100**
- Match Rate (80%): When this user likes others, do they get liked back?
- Like Rate (20%): How often do other users like this person?

### 2. Bucket Categorization

#### `bucket.service.ts`
Categorizes all users into three performance tiers based on their base scores.

**Base Score Calculation**
```
Buddy Mode: (BCS × 0.7) + (BDS × 0.3)
Dating Mode: (DCS × 0.4) + (DDS × 0.6)
```

**Bucket Distribution**
- **Bucket A** (Top 30%): Base score 70-100
  - Shown 50% of the time
- **Bucket B** (Middle 40%): Base score 40-69
  - Shown 30% of the time
- **Bucket C** (Bottom 30%): Base score 0-39
  - Shown 20% of the time

**Batch Distribution Example**
In a batch of 20 profiles:
- 10 profiles from Bucket A (50%)
- 6 profiles from Bucket B (30%)
- 4 profiles from Bucket C (20%)

### 3. Ranking Utilities

#### `ranking.utils.ts`
Applies modifiers and handles special cases.

**Trust Score Modifier**
- **RED**: -40% to final score (user flagged as high risk)
- **ORANGE**: -20% to final score (user has minor concerns)
- **GREEN**: No penalty (clean record)

**Paid Boost Modifier**
- Active boost: +20% to final score
- Applied to users with:
  - Active manual boosts
  - Active subscription boosts (Birdie, Eagle, Ace)

**New User Boost**
- **Definition**: User within 72 hours of signup
- **Benefit**: Special placement in swipe deck (3 per batch)
- **Spacing**: 1 new user every 3-5 swipes to avoid fatigue
- **Exception**: If more new users than regular users remain, show them more frequently

### 4. Swipe Deck Generation

#### `swiped-deck.service.ts`
Orchestrates the complete ranking pipeline.

**Process Flow**
1. Get eligible users (exclude swiped, blocked)
2. Apply dealbreaker filters (if selected)
3. Separate new vs. regular users
4. Score all users
5. Apply score modifiers (trust, boosts)
6. Build balanced buckets
7. Apply new user spacing
8. Return paginated results

**Final Score Calculation**
```
Final Score = Base Score × Trust Modifier × (1.0 or 1.2 if boosted)

Example:
- Base Score: 75
- Trust Score: ORANGE (-20%)
- Boosted: Yes (+20%)
- Final Score: 75 × 0.8 × 1.2 = 72
```

## User Fields in Database

### Scoring Fields
- `buddyCompatibilityScore` (0-100)
- `buddyDesireScore` (0-100)
- `dateCompatibilityScore` (0-100)
- `dateDesireScore` (0-100)

### Categorization Fields
- `buddyBucket` (A | B | C)
- `dateBucket` (A | B | C)
- `bucketCalculatedAt` (timestamp)

### Trust & Boost Fields
- `trustScore` (RED | ORANGE | GREEN)
- `trustScoreUpdatedAt` (timestamp)
- `isCurrentlyBoosted` (boolean)
- `boostType` (MANUAL | SUBSCRIPTION)
- `boostedUntil` (timestamp)

### New User Fields
- `newUserWindow.isNewUser` (boolean)
- `newUserWindow.signedUpAt` (timestamp)
- `newUserWindow.newUserWindowExpiresAt` (timestamp)

### Metadata Fields
- `scoreMetadata.matchRate` (0-100)
- `scoreMetadata.likeRate` (0-100)
- `scoreMetadata.totalLikesReceived` (number)
- `scoreMetadata.totalSwipesReceived` (number)
- `scoreMetadata.lastScoreCalculation` (timestamp)

## Algorithm Rules

### Spacing Rule for New Users
- **Max**: 1 new user every 3-5 swipes
- **Example Good**: New → Normal → Normal → Normal → New → Normal → Normal
- **Example Bad**: New → New → Normal → Normal → New
- **Exception**: If there are more new users than normal users left in the deck, show them more frequently

### Dealbreaker Override
- If a dealbreaker filter is selected, those users are completely excluded
- Dealbreakers override all scores and rankings

### Recalculation Schedule
- Buckets are recalculated every 24 hours
- Scores can be updated more frequently based on new swipe data
- Trust scores are updated based on user behavior reports

## Integration Points

### Discovery Controller & Service
The `/batch` endpoint now uses the new ranking system:
```typescript
GET /discovery/batch?page=1&gender=Women&minAge=25&maxAge=35
```

Returns:
```json
{
  "users": [
    {
      "id": "user123",
      "firstName": "John",
      "lastName": "Doe",
      "bucket": "A",
      "baseScore": 85,
      "finalScore": 82,
      "isNewUser": false,
      "trustScore": "GREEN",
      "distanceKm": 5.2,
      ...
    }
  ],
  "pagination": { ... },
  "metadata": {
    "bucketDistribution": { "A": 10, "B": 6, "C": 4 },
    "newUsersIncluded": 1,
    "averageScore": 72
  }
}
```

## Admin & Maintenance

### Recalculate Buckets
```typescript
await BucketCategorization.recategorizeAllUsers("buddy");
await BucketCategorization.recategorizeAllUsers("date");
```

### Verify Bucket Integrity
```typescript
const result = await BucketCategorization.verifyAndFixBuckets("buddy");
console.log(`Fixed ${result.fixed} out of ${result.processed} users`);
```

### Update New User Status
```typescript
await NewUserBoost.updateNewUserStatus(userId);
```

## Performance Considerations

1. **Caching**: Consider caching bucket assignments for 24 hours
2. **Batch Processing**: Scores can be calculated in batches during off-peak hours
3. **Indexes**: Ensure indexes on:
   - `buddyBucket`, `dateBucket`
   - `buddyCompatibilityScore`, `dateCompatibilityScore`
   - `boostedUntil`
   - `createdAt` (for new user detection)

## Future Enhancements

1. **Machine Learning**: Replace manual scoring with ML models trained on match success
2. **A/B Testing**: Test different bucket distributions and scoring weights
3. **Personalization**: Adjust bucket weights based on individual user preferences
4. **Real-time Updates**: Calculate scores immediately on profile changes
5. **Predictive Analytics**: Identify users likely to match based on behavior patterns

## Troubleshooting

### Users not showing up
1. Check if they're in excluded list (already swiped, blocked)
2. Verify profile is complete (`isProfileComplete` = true)
3. Ensure location coordinates are set
4. Check if user is incognito

### Score disparity
1. Verify scores were calculated (`scoreMetadata.lastScoreCalculation`)
2. Check if scores are in valid range (0-100)
3. Recalculate buckets if out of sync

### New user not appearing
1. Verify `createdAt` timestamp is recent (< 72 hours)
2. Check `newUserWindow.isNewUser` status
3. Ensure profile is complete and public
