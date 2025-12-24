const sql = require('mssql');
const { poolPromise } = require('../../config/db');

class Report {
  constructor(data) {
    this.ReportID = data.ReportID;
    this.ReporterID = data.ReporterID;
    this.ReportedContentType = data.ReportedContentType; // 'post', 'story', 'comment'
    this.ReportedContentID = data.ReportedContentID;
    this.ReportReason = data.ReportReason;
    this.ReportDescription = data.ReportDescription;
    this.Status = data.Status; // 'pending', 'reviewed', 'resolved', 'dismissed'
    this.AdminNote = data.AdminNote;
    this.ReviewedBy = data.ReviewedBy;
    this.ReviewedAt = data.ReviewedAt;
    this.CreatedAt = data.CreatedAt;
    this.UpdatedAt = data.UpdatedAt;
  }

  static async createTable() {
    try {
      const pool = await poolPromise;
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Reports' AND xtype='U')
        CREATE TABLE Reports (
          ReportID INT IDENTITY(1,1) PRIMARY KEY,
          ReporterID INT NOT NULL,
          ReportedContentType NVARCHAR(20) NOT NULL CHECK (ReportedContentType IN ('post', 'story', 'comment', 'facility')),
          ReportedContentID NVARCHAR(100) NOT NULL,
          ReportReason NVARCHAR(255) NULL,
          ReportDescription NVARCHAR(MAX) NULL,
          Status NVARCHAR(20) DEFAULT 'pending' CHECK (Status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
          AdminNote NVARCHAR(MAX) NULL,
          ReviewedBy INT NULL,
          ReviewedAt DATETIME NULL,
          CreatedAt DATETIME DEFAULT GETDATE(),
          UpdatedAt DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (ReporterID) REFERENCES Account(AccountID),
          FOREIGN KEY (ReviewedBy) REFERENCES Account(AccountID)
        )
      `);
      console.log('✅ Reports table created or already exists');
    } catch (err) {
      console.error('❌ Error creating Reports table:', err);
      throw err;
    }
  }

  toFrontendFormat() {
    return {
      id: this.ReportID,
      reporterId: this.ReporterID,
      contentType: this.ReportedContentType,
      contentId: this.ReportedContentID,
      reason: this.ReportReason,
      description: this.ReportDescription,
      status: this.Status,
      adminNote: this.AdminNote,
      reviewedBy: this.ReviewedBy,
      reviewedAt: this.ReviewedAt,
      createdAt: this.CreatedAt,
      updatedAt: this.UpdatedAt
    };
  }
}

module.exports = Report;
