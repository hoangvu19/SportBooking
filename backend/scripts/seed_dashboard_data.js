/*
  Seed script for admin dashboard data
  - Inserts sample Booking rows for months June -> October (2025)
  - Inserts sample ContentModerationLog flagged entries

  Usage:
    1. Ensure `backend/.env` has correct DB credentials (same used by the app)
    2. From repository root run:
         node backend/scripts/seed_dashboard_data.js

  NOTE: The script attempts to reuse an existing FieldID and AccountID. If none
  are available it will abort with an instruction.
*/

const { poolPromise, sql } = require('../config/db');

async function getFieldsAndAccounts(pool, accountStart = 3, accountEnd = 15) {
  // Get available fields
  const fieldsRes = await pool.request().query(`SELECT FieldID FROM SportField ORDER BY FieldID`);
  const fields = (fieldsRes.recordset || []).map(r => r.FieldID);

  // Get accounts in requested range that actually exist
  const accRes = await pool.request()
    .input('Start', sql.Int, accountStart)
    .input('End', sql.Int, accountEnd)
    .query(`SELECT AccountID FROM Account WHERE AccountID BETWEEN @Start AND @End ORDER BY AccountID`);
  const accounts = (accRes.recordset || []).map(r => r.AccountID);

  return { fields, accounts };
}

function makeDate(year, month, day, hour = 18, minute = 0) {
  // month is 1-based
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
}

async function seedBookings(pool, fieldIds = [], accountIds = [], bookingsPerUserPerMonth = 5) {
  const year = new Date().getUTCFullYear();
  // Insert for months June (6) -> October (10)
  const months = [6,7,8,9,10];

  console.log('Seeding bookings for months:', months.join(','));
  console.log('Using fields:', fieldIds.slice(0,10));
  console.log('Using accounts:', accountIds);

  if (!fieldIds.length || !accountIds.length) {
    throw new Error('No fields or accounts available to seed bookings');
  }

  let bookingCounter = 0;
  for (const m of months) {
    for (const accId of accountIds) {
      for (let b = 0; b < bookingsPerUserPerMonth; b++) {
        // pick a field by rotating through the available fields
        const fieldId = fieldIds[(bookingCounter) % fieldIds.length];
        bookingCounter++;

        const day = Math.min(25, 5 + ((bookingCounter % 20) + b));
        const hour = 16 + (bookingCounter % 6); // between 16-21
        const start = makeDate(year, m, day, hour, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour booking

        // Create a TotalAmount pattern so revenue looks varied
        const totalAmount = 120000 + ((m - 6) * 25000) + ((bookingCounter % 5) * 15000);
        const status = (bookingCounter % 3 === 0) ? 'Pending' : ((bookingCounter % 2 === 0) ? 'Confirmed' : 'Completed');

        const request = pool.request()
          .input('FieldID', sql.Int, fieldId)
          .input('CustomerID', sql.Int, accId)
          .input('StartTime', sql.DateTime, start)
          .input('EndTime', sql.DateTime, end)
          .input('Status', sql.NVarChar(50), status)
          .input('Deposit', sql.Decimal(10,2), 0)
          .input('TotalAmount', sql.Decimal(18,2), totalAmount)
        ;

        const sqlText = `
          INSERT INTO Booking (FieldID, CustomerID, StartTime, EndTime, Status, Deposit, TotalAmount)
          OUTPUT INSERTED.BookingID
          VALUES (@FieldID, @CustomerID, @StartTime, @EndTime, @Status, @Deposit, @TotalAmount)
        `;

        const res = await request.query(sqlText);
        const id = res.recordset && res.recordset[0] ? res.recordset[0].BookingID : null;
        console.log(`Inserted booking id=${id} user=${accId} field=${fieldId} month=${m} amount=${totalAmount} status=${status}`);
      }
    }
  }
}

async function seedModeration(pool) {
  console.log('Seeding moderation log entries (flagged content)');
  const samples = [
    { content: 'Test flagged post with hate speech example', isClean: 0, confidence: 0.92, reason: 'hate', needsReview: 1 },
    { content: 'Possible adult content image', isClean: 0, confidence: 0.8, reason: 'adult', needsReview: 1 },
    { content: 'Spammy promotional content', isClean: 0, confidence: 0.7, reason: 'spam', needsReview: 1 }
  ];

  for (const s of samples) {
    await pool.request()
      .input('PostID', sql.Int, null)
      .input('CommentID', sql.Int, null)
      .input('Content', sql.NVarChar, s.content)
      .input('IsClean', sql.Bit, s.isClean)
      .input('Confidence', sql.Decimal(3,2), s.confidence)
      .input('Reason', sql.NVarChar, s.reason)
      .input('NeedsReview', sql.Bit, s.needsReview)
      .input('Flags', sql.NVarChar, JSON.stringify({ sample: true }))
      .query(`
        INSERT INTO ContentModerationLog (PostID, CommentID, Content, IsClean, Confidence, Reason, NeedsReview, Flags)
        VALUES (@PostID, @CommentID, @Content, @IsClean, @Confidence, @Reason, @NeedsReview, @Flags)
      `);
    console.log('Inserted moderation entry:', s.reason);
  }
}

async function main() {
  try {
    const pool = await poolPromise;
    // Get available fields and accounts in the 3..15 range
    const { fields, accounts } = await getFieldsAndAccounts(pool, 3, 15);

    if (!fields.length) {
      console.error('No SportField rows found. Please create at least one SportField before running this script.');
      process.exit(1);
    }

    if (!accounts.length) {
      console.error('No accounts found in the range 3..15. Please create accounts with IDs 3..15 or adjust the range.');
      process.exit(1);
    }

    // Check if bookings already exist for these accounts in months 6..10 to avoid duplicates
    const existingRes = await pool.request()
      .input('StartAcc', sql.Int, 3)
      .input('EndAcc', sql.Int, 15)
      .query(`SELECT COUNT(*) as Cnt FROM Booking WHERE MONTH(StartTime) BETWEEN 6 AND 10 AND CustomerID BETWEEN @StartAcc AND @EndAcc`);

    const existingCount = existingRes.recordset && existingRes.recordset[0] ? existingRes.recordset[0].Cnt : 0;
    if (existingCount > 0) {
      console.log(`Found ${existingCount} existing bookings for accounts 3..15 in months 6..10 — skipping booking inserts to avoid duplicates.`);
    } else {
      // bookingsPerUserPerMonth: increase if you want more volume
      const bookingsPerUserPerMonth = 5;
      await seedBookings(pool, fields, accounts, bookingsPerUserPerMonth);
    }

    // Check if ContentModerationLog table exists before seeding moderation entries
    const tableCheck = await pool.request()
      .input('TableName', sql.NVarChar, 'ContentModerationLog')
      .query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @TableName`);

    if (!tableCheck.recordset || tableCheck.recordset.length === 0) {
      console.warn("Table 'ContentModerationLog' does not exist in the database — skipping moderation seeding.");
    } else {
      await seedModeration(pool);
    }

    console.log('Seeding completed successfully. Restart backend server if running to pick up data.');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(2);
  }
}

main();
