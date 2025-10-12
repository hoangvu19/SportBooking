# Story Feature Fix - ExpiresAt Computed Column

## Problem
❌ **Error**: Story creation was failing with HTTP 500 error
```
Error: The column "ExpiresAt" cannot be modified because it is either a computed column or is the result of a UNION operator.
```

## Root Cause
The database `Story` table has `ExpiresAt` as a **COMPUTED COLUMN**:
```sql
ExpiresAt AS DATEADD(HOUR, 24, CreatedDate)
```

This means SQL Server automatically calculates `ExpiresAt` when a row is inserted. We **cannot** manually insert a value into it.

## Solution
✅ **Fixed** `backend/DAL/StoryDAL.js` - Removed `ExpiresAt` from INSERT statement

### Before (Broken):
```javascript
const result = await transaction.request()
  .input('ExpiresAt', sql.DateTime, expiresAt)  // ❌ Error!
  .query(`
    INSERT INTO Story (..., ExpiresAt, ...)
    VALUES (..., @ExpiresAt, ...)
  `);
```

### After (Working):
```javascript
const result = await transaction.request()
  // No ExpiresAt input - it's computed automatically ✅
  .query(`
    INSERT INTO Story (AccountID, Content, MediaUrl, MediaType, BackgroundColor, Status, ViewCount)
    VALUES (@AccountID, @Content, @MediaUrl, @MediaType, @BackgroundColor, 'Active', 0)
  `);
```

## What Changed

### 1. Updated `backend/DAL/StoryDAL.js`
- ✅ Removed `ExpiresAt` calculation and input parameter
- ✅ Removed `ExpiresAt` from INSERT column list
- ✅ Removed `CreatedDate` (uses default GETDATE())
- ✅ SQL Server now auto-calculates both columns

### 2. Updated `backend/migrations/004_create_story_table.sql`
- ✅ Added clear documentation that `ExpiresAt` is COMPUTED
- ✅ Changed definition to: `ExpiresAt AS DATEADD(HOUR, 24, CreatedDate)`

## Verification
✅ **Test passed**: Story creation now works!

```javascript
// Test command executed successfully:
const story = await StoryDAL.create({
  AccountID: 1,
  Content: 'Test story from fix',
  MediaType: 'text',
  BackgroundColor: '#4f46e5'
});

// Result:
{
  StoryID: 1,
  AccountID: 1,
  Content: 'Test story from fix',
  CreatedDate: 2025-10-06T21:40:38.353Z,
  ExpiresAt: 2025-10-07T21:40:38.353Z,  // ✅ Auto-calculated!
  Status: 'Active',
  ViewCount: 0
}
```

## Testing
Now you can test the story feature in your app:

1. **Start backend**: `cd backend; npm run dev`
2. **Start frontend**: `cd frontend; npm run dev`
3. **Login** to your app
4. Click **"Create Story"**
5. Enter text and background color
6. Click **"Create Story"**
7. ✅ Story should appear in stories bar!

## Database Notes
Your database already has the correct schema with `ExpiresAt` as a computed column. The migration file has been updated to match, but you don't need to re-run it since your table is already correct.

**Computed column definition:**
```sql
ExpiresAt AS DATEADD(HOUR, 24, CreatedDate)
```

This means:
- ✅ `ExpiresAt` is **automatically** calculated when inserting
- ✅ `ExpiresAt` is **automatically** updated if `CreatedDate` changes
- ✅ You **cannot** manually set `ExpiresAt` value
- ✅ Stories **automatically** expire 24 hours after creation

## Status
🎉 **FIXED!** Story creation now works perfectly.
