/**
 * SportField Model
 * Handles all database operations for sport fields within facilities
 */
const { poolPromise } = require('../config/db');
const sql = require('mssql');

class SportFieldModel {
  /**
   * Create a new sport field
   */
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
      await transaction.rollback();
      console.error('SportFieldModel.createSportField error:', error);
      throw error;
    }
  }

  /**
   * Get sport field by ID with full details
   */
  static async getSportFieldById(fieldId) {
    try {
      const pool = await poolPromise;
      
      // Get field with facility and sport type info
      const fieldResult = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .query(`
          SELECT sf.*, f.FacilityName, st.SportName, a.AreaName
          FROM SportField sf
          JOIN Facility f ON sf.FacilityID = f.FacilityID
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          JOIN Area a ON f.AreaID = a.AreaID
          WHERE sf.FieldID = @FieldID
        `);
      
      if (fieldResult.recordset.length === 0) {
        return null;
      }
      
      const field = fieldResult.recordset[0];
      
      // Get field images
      const imagesResult = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .query(`
          SELECT ImageUrl, UploadedDate
          FROM SportFieldImage
          WHERE FieldID = @FieldID
          ORDER BY UploadedDate
        `);
      
      // Get current day bookings to show availability
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
      console.error('SportFieldModel.getSportFieldById error:', error);
      throw error;
    }
  }

  /**
   * Get sport fields by facility
   */
  static async getSportFieldsByFacility(facilityId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('FacilityID', sql.Int, facilityId)
        .query(`
          SELECT sf.*, st.SportName
          FROM SportField sf
          JOIN SportType st ON sf.SportTypeID = st.SportTypeID
          WHERE sf.FacilityID = @FacilityID
          ORDER BY sf.FieldName
        `);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('SportFieldModel.getSportFieldsByFacility error:', error);
      throw error;
    }
  }

  /**
   * Get sport fields by sport type and area
   */
  static async getSportFieldsByTypeAndArea(sportTypeId, areaId, searchTerm = null) {
    try {
      const pool = await poolPromise;
      
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
        query += ` AND (sf.FieldName LIKE @SearchTerm OR f.FacilityName LIKE @SearchTerm)`;
        request.input('SearchTerm', sql.VarChar, `%${searchTerm}%`);
      }
      
      query += ` ORDER BY f.FacilityName, sf.FieldName`;
      
      const result = await request.query(query);
      
      return { success: true, data: result.recordset };
    } catch (error) {
      console.error('SportFieldModel.getSportFieldsByTypeAndArea error:', error);
      throw error;
    }
  }

  /**
   * Update sport field
   */
  static async updateSportField(fieldId, fieldData) {
    try {
      const pool = await poolPromise;
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
      console.error('SportFieldModel.updateSportField error:', error);
      throw error;
    }
  }

  /**
   * Delete sport field
   */
  static async deleteSportField(fieldId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .query('DELETE FROM SportField WHERE FieldID = @FieldID');
      
      return { success: true, rowsAffected: result.rowsAffected[0] };
    } catch (error) {
      console.error('SportFieldModel.deleteSportField error:', error);
      throw error;
    }
  }

  /**
   * Get field availability for a specific date
   */
  static async getFieldAvailability(fieldId, date) {
    try {
      const pool = await poolPromise;
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
      console.error('SportFieldModel.getFieldAvailability error:', error);
      throw error;
    }
  }

  /**
   * Add sport field image
   */
  static async addSportFieldImage(fieldId, imageUrl) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('FieldID', sql.Int, fieldId)
        .input('ImageUrl', sql.VarChar, imageUrl)
        .query(`
          INSERT INTO SportFieldImage (FieldID, ImageUrl, UploadedDate)
          OUTPUT INSERTED.*
          VALUES (@FieldID, @ImageUrl, GETDATE())
        `);
      
      return { success: true, data: result.recordset[0] };
    } catch (error) {
      console.error('SportFieldModel.addSportFieldImage error:', error);
      throw error;
    }
  }

  /**
   * Delete sport field image
   */
  static async deleteSportFieldImage(imageId) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('ImageID', sql.Int, imageId)
        .query('DELETE FROM SportFieldImage WHERE ImageID = @ImageID');
      
      return { success: true, rowsAffected: result.rowsAffected[0] };
    } catch (error) {
      console.error('SportFieldModel.deleteSportFieldImage error:', error);
      throw error;
    }
  }
}

module.exports = SportFieldModel;