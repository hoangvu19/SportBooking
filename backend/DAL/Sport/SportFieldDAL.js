const { poolPromise } = require('../../config/db');
const sql = require('mssql');

class SportFieldDAL {
  static async createSportField(fieldData) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    try {
      await transaction.begin();
      const { fieldName, fieldType, rentalPrice, status, facilityId, sportTypeId } = fieldData;
      const result = await transaction.request()
        .input('FieldName', sql.VarChar, fieldName)
        .input('FieldType', sql.VarChar, fieldType)
        .input('RentalPrice', sql.Decimal(10, 2), rentalPrice)
        .input('Status', sql.VarChar, status || 'Available')
        .input('FacilityID', sql.Int, facilityId)
        .input('SportTypeID', sql.Int, sportTypeId)
        .query(`
          INSERT INTO SportField (FieldName, FieldType, RentalPrice, Status, FacilityID, SportTypeID)
          OUTPUT INSERTED.*
          VALUES (@FieldName, @FieldType, @RentalPrice, @Status, @FacilityID, @SportTypeID)
        `);

      await transaction.commit();
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      try { await transaction.rollback(); } catch (e) { /* ignore */ }
      console.error('SportFieldDAL.createSportField error:', error);
      throw error;
    }
  }

  static async getAllSportFields(filters = {}) {
    const pool = await poolPromise;
    try {
      let query = `
        SELECT 
          sf.*, 
          f.FacilityName, 
          f.OwnerID,
          st.SportName, 
          a.AreaName,
          acc.AccountID as OwnerAccountID,
          acc.FullName as OwnerName,
          acc.AvatarUrl as OwnerAvatar
        FROM SportField sf
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        JOIN Area a ON f.AreaID = a.AreaID
        LEFT JOIN Account acc ON f.OwnerID = acc.AccountID
        WHERE 1=1
      `;

      const request = pool.request();

      if (filters.sportTypeId) {
        query += ' AND sf.SportTypeID = @SportTypeID';
        request.input('SportTypeID', sql.Int, parseInt(filters.sportTypeId));
      }

      if (filters.areaId) {
        query += ' AND a.AreaID = @AreaID';
        request.input('AreaID', sql.Int, parseInt(filters.areaId));
      }

      if (filters.status) {
        query += ' AND sf.Status = @Status';
        request.input('Status', sql.VarChar, filters.status);
      }

      if (filters.searchTerm) {
        query += ' AND (sf.FieldName LIKE @SearchTerm OR f.FacilityName LIKE @SearchTerm)';
        request.input('SearchTerm', sql.VarChar, `%${filters.searchTerm}%`);
      }

      query += ' ORDER BY f.FacilityName, sf.FieldName';

      const result = await request.query(query);
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('SportFieldDAL.getAllSportFields error:', error);
      throw error;
    }
  }

  static async getSportFieldById(fieldId) {
    const pool = await poolPromise;
    try {
      const fieldResult = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .query(`
          SELECT 
            sf.*, 
            f.FacilityName, 
            f.OwnerID,
            st.SportName, 
            a.AreaName,
            acc.AccountID as OwnerAccountID,
            acc.FullName as OwnerName,
            acc.AvatarUrl as OwnerAvatar
          FROM SportField sf
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          JOIN Area a ON f.AreaID = a.AreaID
          LEFT JOIN Account acc ON f.OwnerID = acc.AccountID
          WHERE sf.FieldID = @FieldID
        `);

      if (fieldResult.recordset.length === 0) return null;
      const field = fieldResult.recordset[0];

      const imagesResult = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .query(`SELECT ImageUrl, UploadedDate FROM SportFieldImage WHERE FieldID = @FieldID ORDER BY UploadedDate`);

      const bookingsResult = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .query(`
          SELECT StartTime, EndTime, Status
          FROM Booking
          WHERE FieldID = @FieldID 
            AND CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)
            AND Status IN ('Confirmed', 'Pending')
          ORDER BY StartTime
        `);

      field.images = imagesResult.recordset;
      field.todayBookings = bookingsResult.recordset;

      return { success: true, data: field };
    } catch (error) {
      console.error('SportFieldDAL.getSportFieldById error:', error);
      throw error;
    }
  }

  static async getSportFieldsByFacility(facilityId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('FacilityID', sql.Int, facilityId)
        .query(`SELECT sf.*, st.SportName FROM SportField sf JOIN SportType st ON sf.SportTypeID = st.SportTypeID WHERE sf.FacilityID = @FacilityID ORDER BY sf.FieldName`);

      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('SportFieldDAL.getSportFieldsByFacility error:', error);
      throw error;
    }
  }

  static async getSportFieldsByTypeAndArea(sportTypeId, areaId, searchTerm = null) {
    const pool = await poolPromise;
    try {
      let query = `
        SELECT sf.*, f.FacilityName, st.SportName, a.AreaName
        FROM SportField sf
        JOIN Facility f ON sf.FacilityID = f.FacilityID
        JOIN SportType st ON sf.SportTypeID = st.SportTypeID
        JOIN Area a ON f.AreaID = a.AreaID
        WHERE sf.SportTypeID = @SportTypeID AND f.AreaID = @AreaID
      `;

      const request = pool.request()
        .input('SportTypeID', sql.Int, sportTypeId)
        .input('AreaID', sql.Int, areaId);

      if (searchTerm) {
        query += ' AND (sf.FieldName LIKE @SearchTerm OR f.FacilityName LIKE @SearchTerm)';
        request.input('SearchTerm', sql.VarChar, `%${searchTerm}%`);
      }

      query += ` ORDER BY f.FacilityName, sf.FieldName`;

      const result = await request.query(query);
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('SportFieldDAL.getSportFieldsByTypeAndArea error:', error);
      throw error;
    }
  }

  static async updateSportField(fieldId, fieldData) {
    const pool = await poolPromise;
    try {
      const { fieldName, fieldType, rentalPrice, status, sportTypeId } = fieldData;
      const result = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .input('FieldName', sql.VarChar, fieldName)
        .input('FieldType', sql.VarChar, fieldType)
        .input('RentalPrice', sql.Decimal(10, 2), rentalPrice)
        .input('Status', sql.VarChar, status)
        .input('SportTypeID', sql.Int, sportTypeId)
        .query(`
          UPDATE SportField 
          SET FieldName = @FieldName, 
              FieldType = @FieldType, 
              RentalPrice = @RentalPrice, 
              Status = @Status, 
              SportTypeID = @SportTypeID
          OUTPUT INSERTED.*
          WHERE FieldID = @FieldID
        `);

      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('SportFieldDAL.updateSportField error:', error);
      throw error;
    }
  }

  static async deleteSportField(fieldId) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .query('DELETE FROM SportField WHERE FieldID = @FieldID');

      return { success: true, rowsAffected: result.rowsAffected[0] };
    } catch (error) {
      console.error('SportFieldDAL.deleteSportField error:', error);
      throw error;
    }
  }

  static async getFieldAvailability(fieldId, date) {
    const pool = await poolPromise;
    try {
      const result = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .input('Date', sql.Date, date)
        .query(`
          SELECT StartTime, EndTime, Status
          FROM Booking
          WHERE FieldID = @FieldID 
            AND CAST(StartTime AS DATE) = @Date
            AND Status IN ('Confirmed', 'Pending')
          ORDER BY StartTime
        `);

      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('SportFieldDAL.getFieldAvailability error:', error);
      throw error;
    }
  }
}

module.exports = SportFieldDAL;
