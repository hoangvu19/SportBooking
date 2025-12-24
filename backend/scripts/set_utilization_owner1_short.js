const { poolPromise } = require('../config/db');
const sql = require('mssql');

(async () => {
  try {
    const pool = await poolPromise;
    const ownerId = 1;

    // Short window that's easy to fill and visualize
    const startDate = new Date('2025-12-01T00:00:00Z');
    const endDate = new Date('2025-12-06T00:00:00Z');
    const days = Math.round((endDate - startDate) / (24 * 60 * 60 * 1000));
    const availableHours = days * 12; // 5 days * 12 = 60 hours

    console.log(`Short window ${startDate.toISOString().slice(0,10)} -> ${endDate.toISOString().slice(0,10)} (${days} days, ${availableHours} available hours)`);

    const fieldsRes = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`SELECT TOP 5 sf.FieldID, sf.FieldName, sf.RentalPrice, f.FacilityID, f.FacilityName FROM SportField sf JOIN Facility f ON sf.FacilityID = f.FacilityID WHERE f.OwnerID = @OwnerID ORDER BY sf.FieldID`);

    const fields = fieldsRes.recordset;
    if (!fields || fields.length === 0) {
      console.log('No fields found for owner', ownerId);
      process.exit(0);
    }

    // Targets (for 5-day window): high >=80% (~48h), mid ~65% (~39h), low ~25% (~15h)
    const targets = [
      { band: 'high', percent: 0.80 }, // 48 hours
      { band: 'mid', percent: 0.65 },  // 39 hours
      { band: 'low', percent: 0.25 }   // 15 hours
    ];

    for (let i = 0; i < targets.length; i++) {
      const field = fields[i % fields.length];
      const target = targets[i];
      const targetHours = Math.floor(availableHours * target.percent);
      const slotLength = 2; // hours
      const slotsNeeded = Math.ceil(targetHours / slotLength);

      console.log(`\nField ${field.FieldName} (ID ${field.FieldID}) -> target ${Math.round(target.percent*100)}% => ${targetHours} hours -> ${slotsNeeded} slots`);

      let created = 0;
      // distribute slots across the 5 days and different start hours to avoid collisions
      for (let dayOffset = 0; dayOffset < days && created < slotsNeeded; dayOffset++) {
        for (let h = 8; h <= 18 && created < slotsNeeded; h += 2) {
          const s = new Date(startDate);
          s.setUTCDate(s.getUTCDate() + dayOffset);
          s.setUTCHours(h,0,0,0);
          const e = new Date(s);
          e.setUTCHours(h + slotLength,0,0,0);

          const totalAmount = slotLength * (field.RentalPrice || 0);
          try {
            await pool.request()
              .input('FieldID', sql.Int, field.FieldID)
              .input('CustomerID', sql.Int, 84)
              .input('StartTime', sql.DateTime, s)
              .input('EndTime', sql.DateTime, e)
              .input('TotalAmount', sql.Decimal(18,2), totalAmount)
              .input('Status', sql.NVarChar(50), target.band === 'low' ? 'Cancelled' : 'Confirmed')
              .input('Deposit', sql.Decimal(10,2), 0)
              .query(`INSERT INTO Booking (FieldID, CustomerID, StartTime, EndTime, TotalAmount, Status, Deposit) VALUES (@FieldID, @CustomerID, @StartTime, @EndTime, @TotalAmount, @Status, @Deposit)`);

            created++;
          } catch (err) {
            // skip on insertion error (likely overlapping or constraint)
          }
        }
      }

      console.log(`Created ${created} slots => ${created * slotLength} hours for ${field.FieldName}`);
    }

    console.log('\nDone short-window inserts.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();