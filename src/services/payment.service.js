const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

const paymentService = {
  /**
   * Get all payments with pagination and filters
   */
  getAll: async (query) => {
    const { Payment, Invoice, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { invoice_id, payment_method, start_date, end_date } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Filter by invoice
    if (invoice_id) {
      where.invoice_id = invoice_id;
    }

    // Filter by payment method
    if (payment_method) {
      where.payment_method = payment_method;
    }

    // Filter by date range
    if (start_date || end_date) {
      where.payment_date = {};
      if (start_date) {
        where.payment_date[Op.gte] = start_date;
      }
      if (end_date) {
        where.payment_date[Op.lte] = end_date;
      }
    }

    const { count, rows } = await Payment.findAndCountAll({
      where,
      include: [
        {
          model: Invoice,
          as: 'invoice',
          attributes: ['id', 'invoice_number', 'total', 'status'],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
      order,
      limit,
      offset,
      distinct: true,
    });

    return {
      data: rows,
      meta: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
    };
  },

  /**
   * Get payment by ID
   */
  getById: async (id) => {
    const { Payment, Invoice, User } = require('../models');

    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: Invoice,
          as: 'invoice',
          attributes: ['id', 'invoice_number', 'total', 'status'],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
    });

    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }

    return payment;
  },

  /**
   * Create a new payment
   */
  create: async (data, userId) => {
    const { Payment, Invoice } = require('../models');
    const invoiceService = require('./invoice.service');

    // Validate invoice exists
    const invoice = await Invoice.findByPk(data.invoice_id);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    // Validate total payments + new amount does not exceed invoice total
    const existingPayments = await Payment.sum('amount', {
      where: { invoice_id: data.invoice_id },
    });
    const totalAfterPayment = parseFloat(existingPayments || 0) + parseFloat(data.amount);

    if (totalAfterPayment > parseFloat(invoice.total)) {
      throw ApiError.badRequest(
        `Payment amount exceeds invoice total. Maximum allowed: ${(parseFloat(invoice.total) - parseFloat(existingPayments || 0)).toFixed(2)}`
      );
    }

    const payment = await Payment.create({
      invoice_id: data.invoice_id,
      amount: data.amount,
      payment_date: data.payment_date,
      payment_method: data.payment_method,
      reference_number: data.reference_number || null,
      notes: data.notes || null,
      created_by: userId,
    });

    // Update invoice payment status
    await invoiceService.updatePaymentStatus(data.invoice_id);

    return paymentService.getById(payment.id);
  },

  /**
   * Update a payment
   */
  update: async (id, data) => {
    const { Payment, Invoice } = require('../models');
    const invoiceService = require('./invoice.service');

    const payment = await Payment.findByPk(id);
    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }

    const updateData = {};
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.payment_date !== undefined) updateData.payment_date = data.payment_date;
    if (data.payment_method !== undefined) updateData.payment_method = data.payment_method;
    if (data.reference_number !== undefined) updateData.reference_number = data.reference_number;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // If amount is changing, validate it against invoice total
    if (data.amount !== undefined) {
      const invoice = await Invoice.findByPk(payment.invoice_id);
      const existingPayments = await Payment.sum('amount', {
        where: {
          invoice_id: payment.invoice_id,
          id: { [Op.ne]: id },
        },
      });
      const totalAfterUpdate = parseFloat(existingPayments || 0) + parseFloat(data.amount);

      if (totalAfterUpdate > parseFloat(invoice.total)) {
        throw ApiError.badRequest(
          `Payment amount exceeds invoice total. Maximum allowed: ${(parseFloat(invoice.total) - parseFloat(existingPayments || 0)).toFixed(2)}`
        );
      }
    }

    await payment.update(updateData);

    // Update invoice payment status
    await invoiceService.updatePaymentStatus(payment.invoice_id);

    return paymentService.getById(id);
  },

  /**
   * Delete a payment (hard delete - payments are not paranoid)
   */
  delete: async (id) => {
    const { Payment } = require('../models');
    const invoiceService = require('./invoice.service');

    const payment = await Payment.findByPk(id);
    if (!payment) {
      throw ApiError.notFound('Payment not found');
    }

    const invoiceId = payment.invoice_id;

    await payment.destroy();

    // Update invoice payment status
    await invoiceService.updatePaymentStatus(invoiceId);

    return payment;
  },
};

module.exports = paymentService;
