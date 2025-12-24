const { poolPromise } = require('../config/db');
const sql = require('mssql');

(async () => {
  try {
    const pool = await poolPromise;
    const ownerId = 1; // target owner

    // Use the same date range the dashboard typically uses (last 30 days)
    const endDate = new Date('2025-12-06T00:00:00Z');
    const startDate = new Date('2025-11-06T00:00:00Z');
    const days = Math.round((endDate - startDate) / (24 * 60 * 60 * 1000));
    const availableHours = days * 12; // same as backend logic

    console.log(`Setting utilization for owner ${ownerId} for range ${startDate.toISOString().slice(0,10)} -> ${endDate.toISOString().slice(0,10)} (${days} days, ${availableHours} available hours)`);

    // Fetch fields for owner
    const fieldsRes = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`SELECT sf.FieldID, sf.FieldName, sf.RentalPrice, f.FacilityID, f.FacilityName FROM SportField sf JOIN Facility f ON sf.FacilityID = f.FacilityID WHERE f.OwnerID = @OwnerID ORDER BY sf.FieldID`);

    const fields = fieldsRes.recordset;
    if (!fields || fields.length === 0) {
      console.log('No fields found for owner', ownerId);
      process.exit(0);
    }

    console.log('Found fields:', fields.map(f => `${f.FieldName}(${f.FieldID})`).join(', '));

    // Define targets: we'll try to create 3 demo fields with different utilization bands.
    // If owner has fewer fields, reuse available fields.
    const targets = [
      { band: 'high', percent: 0.85 }, // >=80%
      { band: 'mid', percent: 0.65 },  // 50-80%
      { band: 'low', percent: 0.25 }   // <50%
    ];

    // We'll map each target to a field (cyclic)
    for (let i = 0; i < targets.length; i++) {
      const field = fields[i % fields.length];
      const target = targets[i];
      const targetHours = Math.floor(availableHours * target.percent);

      console.log(`\n--> Field: ${field.FieldName} (ID ${field.FieldID}) -> target ${Math.round(target.percent*100)}% => ${targetHours} booked hours`);

      // We'll create bookings of 2-hour slots starting from startDate at 08:00, spacing one slot per day until we reach targetHours.
      const slotLength = 2; // hours per booking
      const slotsNeeded = Math.ceil(targetHours / slotLength);

      console.log(`Slots needed (2h each): ${slotsNeeded}`);

      let created = 0;
      let dayCursor = new Date(startDate);
      let attempts = 0;
      while (created < slotsNeeded && attempts < slotsNeeded * 5) {
        // pick a start hour between 8 and 19 - ensure start+slotLength <= 21 (12-hour window assumed 8..20)
        const startHour = 8 + (attempts % 8); // cycle hours 8..15
        const startTime = new Date(dayCursor);
        startTime.setUTCHours(startHour, 0, 0, 0);
        const endTime = new Date(startTime);
        endTime.setUTCHours(startHour + slotLength, 0, 0, 0);

        // Use a CustomerID for test (use 84 if exists, else 1)
        const customerId = 84;
        const totalAmount = slotLength * (field.RentalPrice || 0);

        try {
          await pool.request()
            .input('FieldID', sql.Int, field.FieldID)
            .input('CustomerID', sql.Int, customerId)
            .input('StartTime', sql.DateTime, startTime)
            .input('EndTime', sql.DateTime, endTime)
            .input('TotalAmount', sql.Decimal(18,2), totalAmount)
            .input('Status', sql.NVarChar(50), (target.band === 'low') ? 'Cancelled' : 'Confirmed')
            .input('Deposit', sql.Decimal(10,2), 0)
            .query(`INSERT INTO Booking (FieldID, CustomerID, StartTime, EndTime, TotalAmount, Status, Deposit) VALUES (@FieldID, @CustomerID, @StartTime, @EndTime, @TotalAmount, @Status, @Deposit)`);

          created++;
          // advance dayCursor one day
          dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
        } catch (err) {
          // likely overlap or constraint - advance cursor and continue
          //console.error('Insert error:', err.message);
          dayCursor.setUTCDate(dayCursor.getUTCDate() + 1);
        }

        attempts++;
      }

      console.log(`Created ${created} slots for ${field.FieldName} (${created * slotLength} hours)`);
    }

    console.log('\nDone creating bookings for targets.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();