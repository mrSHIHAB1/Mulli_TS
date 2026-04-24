# Architecture Update: Discovery Score Separation

## Overview

The ranking system has been refactored to keep all scoring and ranking data **separate from the User model**. This maintains clean separation of concerns and prevents cluttering the core User model with discovery-specific logic.

## Key Change

All ranking/scoring data is now stored in a dedicated **DiscoveryScore** model instead of in the User model.

## Data Storage Location

### DiscoveryScore Model
Located in: [src/app/modules/Discovery/discovery-score.model.ts](src/app/modules/Discovery/discovery-score.model.ts)

**Stores per user:**
- Compatibility & Desire Scores (for both buddy & date modes)
- Base Score (calculated from CS + DS)
- Final Score (after applying modifiers)
- Bucket Assignment (A, B, or C)
- Trust Score
- Boost Status
- New User Status
- Match/Like Rate metrics
- Calculation timestamps

**Database Collection:** `discoveryscores`

**Key Fields:**
```typescript
{
  userId: ObjectId,        // Reference to User
  mode: "buddy" | "date",  // Discovery mode
  compatibilityScore: 0-100,
  desireScore: 0-100,
  baseScore: 0-100,
  finalScore: 0-120,
  bucket: "A" | "B" | "C",
  trustScore: "RED" | "ORANGE" | "GREEN",
  isBoosted: boolean,
  isNewUser: boolean,
  matchRate: 0-100,
  likeRate: 0-100,
  bucketCalculatedAt: Date,
  scoreCalculatedAt: Date,
  lastUpdatedAt: Date,
}
```

### Compound Indexes

```javascript
// For efficient queries
db.discoveryscores.createIndex({ userId: 1, mode: 1 })
db.discoveryscores.createIndex({ mode: 1, bucket: 1, finalScore: -1 })
db.discoveryscores.createIndex({ mode: 1, isNewUser: 1 })
db.discoveryscores.createIndex({ mode: 1, isBoosted: 1, finalScore: -1 })
db.discoveryscores.createIndex({ mode: 1, bucket: 1 })
db.discoveryscores.createIndex({ finalScore: -1 })
db.discoveryscores.createIndex({ isBoosted: 1, finalScore: -1 })
```

## Benefits

✅ **Clean User Model** - User model stays focused on profile data only  
✅ **Scalability** - Scoring data can be archived/managed independently  
✅ **Flexibility** - Can easily add new scoring modes or change algorithms  
✅ **Performance** - Dedicated indexes optimize discovery queries  
✅ **Separation of Concerns** - Discovery logic isolated from user auth/profile  
✅ **Easier Testing** - Mock scoring data without affecting user tests  

## Data Flow

```
User Profile Changes
    ↓
Swipe Data Created
    ↓
calculateAndUpdateUserScores()
    ↓
Creates/Updates DiscoveryScore documents (buddy + date modes)
    ↓
discoveryService reads from DiscoveryScore
    ↓
SwipeDeckService builds deck using DiscoveryScore data
    ↓
Client receives ranked user list
```

## Services Updated

All services now reference DiscoveryScore instead of User for scoring data:

1. **scoring.service.ts**
   - `calculateAndUpdateUserScores()` - Saves to DiscoveryScore
   - `DesireScoring` methods - Read from Swipe data, write to DiscoveryScore

2. **bucket.service.ts**
   - `recategorizeAllUsers()` - Reads from DiscoveryScore
   - `getUsersByBucket()` - Queries DiscoveryScore with `populate("userId")`
   - `verifyAndFixBuckets()` - Validates DiscoveryScore data

3. **ranking.utils.ts**
   - `FinalScoreCalculator.prepareUserScore()` - Reads from DiscoveryScore
   - Trust and boost modifiers work with DiscoveryScore data

4. **swiped-deck.service.ts**
   - Uses DiscoveryScore for all ranking data
   - Populates User data for profile fields

5. **discovery.service.ts**
   - Checks DiscoveryScore for last bucket recalculation
   - Uses SwipeDeckService which returns DiscoveryScore data

## User Model - Unchanged

The User model retains all profile information:
- Basic info: name, age, gender, location
- Profile data: images, bio, skills, preferences
- Account data: auth providers, subscription status
- Clubhouse data: badges, points, status
- Boost tracking fields (for subscription service, not discovery)

The User model does **NOT** have:
- ❌ buddyCompatibilityScore
- ❌ dateCompatibilityScore  
- ❌ buddyDesireScore
- ❌ dateDesireScore
- ❌ buddyBucket / dateBucket
- ❌ trustScore (for discovery)
- ❌ scoreMetadata
- ❌ newUserWindow (for discovery)

## API Response

Response from `/discovery/batch` still includes all necessary data:

```json
{
  "users": [
    {
      "id": "user123",
      "firstName": "John",
      "bucket": "A",
      "baseScore": 85,
      "finalScore": 82,
      "isNewUser": false,
      "trustScore": "GREEN",
      "isBoosted": true,
      ...
    }
  ],
  "pagination": { ... },
  "metadata": { ... }
}
```

This data comes from joining User (for profile) + DiscoveryScore (for ranking).

## Querying Examples

### Get all scores for a user
```typescript
const scores = await DiscoveryScore.find({ userId: "user123" });
// Returns both buddy and date mode scores
```

### Get bucket A users in buddy mode
```typescript
const bucketA = await DiscoveryScore.find({
  mode: "buddy",
  bucket: "A"
}).sort({ finalScore: -1 }).populate("userId");
```

### Get new users
```typescript
const newUsers = await DiscoveryScore.find({
  isNewUser: true,
  mode: "buddy"
}).sort({ createdAt: -1 });
```

### Get boosted users
```typescript
const boosted = await DiscoveryScore.find({
  mode: "date",
  isBoosted: true
}).sort({ finalScore: -1 });
```

## Migration (if upgrading from old system)

If you had data in User model previously:

```typescript
// Move data from User to DiscoveryScore
const users = await User.find({});

for (const user of users) {
  // Create buddy mode score
  await DiscoveryScore.create({
    userId: user._id,
    mode: "buddy",
    compatibilityScore: user.buddyCompatibilityScore || 0,
    desireScore: user.buddyDesireScore || 0,
    baseScore: (user.buddyCompatibilityScore * 0.7) + (user.buddyDesireScore * 0.3),
    bucket: user.buddyBucket || "C",
    trustScore: user.trustScore || "GREEN",
    // ... other fields
  });

  // Create date mode score
  await DiscoveryScore.create({
    userId: user._id,
    mode: "date",
    compatibilityScore: user.dateCompatibilityScore || 0,
    desireScore: user.dateDesireScore || 0,
    baseScore: (user.dateCompatibilityScore * 0.4) + (user.dateDesireScore * 0.6),
    bucket: user.dateBucket || "C",
    trustScore: user.trustScore || "GREEN",
    // ... other fields
  });
}

// Then remove from User model
await User.updateMany({}, {
  $unset: {
    buddyCompatibilityScore: "",
    dateCompatibilityScore: "",
    // ... etc
  }
});
```

## Database Setup

```bash
# Create collection with indexes
db.createCollection("discoveryscores")

# Add indexes
db.discoveryscores.createIndex({ userId: 1, mode: 1 }, { unique: true })
db.discoveryscores.createIndex({ mode: 1, bucket: 1, finalScore: -1 })
db.discoveryscores.createIndex({ mode: 1, isNewUser: 1 })
db.discoveryscores.createIndex({ mode: 1, isBoosted: 1, finalScore: -1 })
```

## Maintenance

### Recalculate all scores
```typescript
import { calculateAndUpdateUserScores } from "./scoring.service";

const allUserIds = (await User.find().select("_id")).map(u => u._id.toString());
await calculateAndUpdateUserScores(allUserIds, authUserId);
```

### Recalculate buckets
```typescript
import { BucketCategorization } from "./bucket.service";

await BucketCategorization.recategorizeAllUsers("buddy");
await BucketCategorization.recategorizeAllUsers("date");
```

### Verify data integrity
```typescript
const result = await BucketCategorization.verifyAndFixBuckets("buddy");
console.log(`Fixed ${result.fixed} buckets out of ${result.processed}`);
```

## Summary

The new architecture provides a clean separation between:
- **User Module**: Profile, authentication, settings
- **Discovery Module**: Ranking, scoring, deck generation

This makes the system more maintainable, scalable, and easier to extend with new discovery features.
