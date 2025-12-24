const { poolPromise } = require('../config/db');
const sql = require('mssql');

(async () => {
  try {
    const pool = await poolPromise;
    const ownerId = 1;
    const startDate = new Date('2025-11-06T00:00:00Z');
    const endDate = new Date('2025-12-06T00:00:00Z');
    const days = Math.round((endDate - startDate) / (24 * 60 * 60 * 1000));

    console.log(`Escalating bookings for owner ${ownerId} across ${days} days`);

    const fieldsRes = await pool.request()
      .input('OwnerID', sql.Int, ownerId)
      .query(`SELECT sf.FieldID, sf.FieldName, sf.RentalPrice FROM SportField sf JOIN Facility f ON sf.FacilityID = f.FacilityID WHERE f.OwnerID = @OwnerID ORDER BY sf.FieldID`);
    const fields = fieldsRes.recordset;
    if (!fields || fields.length === 0) {
      console.log('No fields for owner', ownerId);
      process.exit(0);
    }

    // Targets for 30-day window (360 available hours)
    // Field A -> aim near 100% (fill all slots)
    // Field B -> aim ~65% (234 hours -> 117 slots)
    // Field C -> keep low (do nothing)
    const fieldA = fields[0];
    const fieldB = fields[1] || fields[0];
    const fieldC = fields[2] || fields[0];

    console.log('Field A:', fieldA.FieldName, fieldA.FieldID);
    console.log('Field B:', fieldB.FieldName, fieldB.FieldID);
    console.log('Field C:', fieldC.FieldName, fieldC.FieldID);

    // Helper to insert slot
    async function insertSlot(fieldId, customerId, s, e, status, rentalPrice) {
      const totalAmount = ((e - s) / (1000*60*60)) * (rentalPrice || 0);
      try {
        await pool.request()
          .input('FieldID', sql.Int, fieldId)
          .input('CustomerID', sql.Int, customerId)
          .input('StartTime', sql.DateTime, s)
          .input('EndTime', sql.DateTime, e)
          .input('TotalAmount', sql.Decimal(18,2), totalAmount)
          .input('Status', sql.NVarChar(50), status)
          .input('Deposit', sql.Decimal(10,2), 0)
          .query(`INSERT INTO Booking (FieldID, CustomerID, StartTime, EndTime, TotalAmount, Status, Deposit) VALUES (@FieldID, @CustomerID, @StartTime, @EndTime, @TotalAmount, @Status, @Deposit)`);
        return true;
      } catch (err) {
        return false;
      }
    }

    // Fill Field A: every possible 2-hour slot each day (6 slots/day => 180 slots -> 360 hours)
    console.log('\nFilling Field A full schedule (may take a moment)');
    let createdA = 0;
    for (let d = 0; d < days; d++) {
      for (let h = 8; h <= 18; h += 2) {
        const s = new Date(startDate);
        s.setUTCDate(s.getUTCDate() + d);
        s.setUTCHours(h,0,0,0);
        const e = new Date(s);
        e.setUTCHours(h+2,0,0,0);
        const ok = await insertSlot(fieldA.FieldID, 84, s, e, 'Confirmed', fieldA.RentalPrice);
        if (ok) createdA++;
      }
    }
    console.log(`Created ${createdA} slots for Field A => ${createdA*2} hours`);

    // Fill Field B: create slots until reach ~117 slots (234 hours)
    console.log('\nFilling Field B to ~65%');
    const targetSlotsB = 117;
    let createdB = 0;
    outer: for (let d = 0; d < days; d++) {
      for (let h = 8; h <= 18; h += 2) {
        if (createdB >= targetSlotsB) break outer;
        const s = new Date(startDate);
        s.setUTCDate(s.getUTCDate() + d);
        s.setUTCHours(h,0,0,0);
        const e = new Date(s);
        e.setUTCHours(h+2,0,0,0);
        const ok = await insertSlot(fieldB.FieldID, 84, s, e, 'Confirmed', fieldB.RentalPrice);
        if (ok) createdB++;
      }
    }
    console.log(`Created ${createdB} slots for Field B => ${createdB*2} hours`);

    // Field C: keep low — ensure only a few confirmed slots (e.g., 5 slots) and some cancelled
    console.log('\nEnsuring Field C remains low');
    let createdC = 0;
    const fewSlots = 5;
    for (let d = 0; d < Math.min(days, fewSlots); d++) {
      const s = new Date(startDate);
      s.setUTCDate(s.getUTCDate() + d);
      s.setUTCHours(8,0,0,0);
      const e = new Date(s);
      e.setUTCHours(10,0,0,0);
      const ok = await insertSlot(fieldC.FieldID, 84, s, e, 'Confirmed', fieldC.RentalPrice);
      if (ok) createdC++;
    }
    console.log(`Created ${createdC} confirmed slots for Field C => ${createdC*2} hours`);

    console.log('\nEscalation complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();