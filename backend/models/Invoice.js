/**
 * Invoice Model
 * Handles all database operations for booking invoices and payments
 */
const InvoiceDAL = require('../DAL/InvoiceDAL');

class InvoiceModel {
  /**
   * Create a new invoice for a booking
   */
  static async createInvoice(invoiceData) {
    return InvoiceDAL.createInvoice(invoiceData);
  }

  /**
   * Get invoice by ID with full details
   */
  static async getInvoiceById(invoiceId) {
    return InvoiceDAL.getInvoiceById(invoiceId);
  }

  /**
   * Get invoice by booking ID
   */
  static async getInvoiceByBookingId(bookingId) {
    return InvoiceDAL.getInvoiceByBookingId(bookingId);
  }

  /**
   * Get invoices by customer
   */
  static async getInvoicesByCustomer(customerId, status = null, page = 1, limit = 20) {
    return InvoiceDAL.getInvoicesByCustomer(customerId, status, page, limit);
  }

  /**
   * Get invoices by facility owner
   */
  static async getInvoicesByFacilityOwner(ownerId, status = null, page = 1, limit = 20) {
    return InvoiceDAL.getInvoicesByFacilityOwner(ownerId, status, page, limit);
  }

  /**
   * Update invoice status (for payment confirmation)
   */
  static async updateInvoiceStatus(invoiceId, status) {
    return InvoiceDAL.updateInvoiceStatus(invoiceId, status);
  }

  /**
   * Mark invoice as paid
   */
  static async markAsPaid(invoiceId) {
    return InvoiceDAL.markAsPaid(invoiceId);
  }

  /**
   * Process refund
   */
  static async processRefund(invoiceId, refundAmount, reason = null) {
    return InvoiceDAL.processRefund(invoiceId, refundAmount, reason);
  }

  /**
   * Get revenue statistics
   */
  static async getRevenueStatistics(ownerId, startDate, endDate) {
    return InvoiceDAL.getRevenueStatistics(ownerId, startDate, endDate);
  }

  /**
   * Calculate total amount for a booking
   */
  static calculateBookingAmount(startTime, endTime, hourlyRate, deposit = 0) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const hours = Math.ceil((end - start) / (1000 * 60 * 60)); // Convert milliseconds to hours
    const totalAmount = (hours * hourlyRate) - deposit;
    
    return {
      hours,
      totalAmount: Math.max(0, totalAmount), // Ensure non-negative
      hourlyRate,
      deposit
    };
  }
}

module.exports = InvoiceModel;