const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

const calculateItemTotal = (quantity, unitPrice, discountPercent = 0) => {
  const subtotal = quantity * unitPrice;
  return subtotal * (1 - (discountPercent || 0) / 100);
};

const calculateTotals = (items, taxRate = 0, discountAmount = 0) => {
  const subtotal = items.reduce(
    (sum, item) => sum + calculateItemTotal(item.quantity, item.unit_price, item.discount_percent),
    0
  );
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount - (discountAmount || 0);
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax_amount: parseFloat(taxAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
};

const generateInvoiceNumber = async () => {
  const { Invoice } = require('../models');
  const lastInvoice = await Invoice.findOne({ order: [['id', 'DESC']], paranoid: false });
  const nextNum = lastInvoice ? lastInvoice.id + 1 : 1;
  return `INV-${String(nextNum).padStart(4, '0')}`;
};

const invoiceService = {
  /**
   * Get all invoices with pagination, search, and filters
   */
  getAll: async (query) => {
    const { Invoice, User, Contact, Company, InvoiceItem, Payment, Quote } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, status, contact_id, company_id } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search by invoice_number
    if (search) {
      where.invoice_number = { [Op.like]: `%${search}%` };
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by contact
    if (contact_id) {
      where.contact_id = contact_id;
    }

    // Filter by company
    if (company_id) {
      where.company_id = company_id;
    }

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name'],
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name'],
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name'],
        },
        {
          model: InvoiceItem,
          as: 'items',
        },
        {
          model: Payment,
          as: 'payments',
        },
        {
          model: Quote,
          as: 'quote',
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
   * Get invoice by ID with full details
   */
  getById: async (id) => {
    const { Invoice, User, Contact, Company, Deal, InvoiceItem, Payment, Quote } = require('../models');

    const invoice = await Invoice.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name'],
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name'],
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name'],
        },
        {
          model: Deal,
          as: 'deal',
        },
        {
          model: InvoiceItem,
          as: 'items',
        },
        {
          model: Payment,
          as: 'payments',
        },
        {
          model: Quote,
          as: 'quote',
        },
      ],
    });

    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    return invoice;
  },

  /**
   * Create a new invoice
   */
  create: async (data, userId) => {
    const { Invoice, InvoiceItem, sequelize } = require('../models');

    const result = await sequelize.transaction(async (t) => {
      const invoiceNumber = await generateInvoiceNumber();

      const items = data.items || [];
      const totals = calculateTotals(items, data.tax_rate || 0, data.discount_amount || 0);

      const invoice = await Invoice.create(
        {
          invoice_number: invoiceNumber,
          quote_id: data.quote_id || null,
          contact_id: data.contact_id || null,
          company_id: data.company_id || null,
          deal_id: data.deal_id || null,
          status: data.status || 'draft',
          subtotal: totals.subtotal,
          tax_rate: data.tax_rate || 0,
          tax_amount: totals.tax_amount,
          discount_amount: data.discount_amount || 0,
          total: totals.total,
          amount_paid: 0,
          amount_due: totals.total,
          currency: data.currency || 'USD',
          issue_date: data.issue_date || new Date(),
          due_date: data.due_date || null,
          notes: data.notes || null,
          created_by: userId,
        },
        { transaction: t }
      );

      if (items.length > 0) {
        const invoiceItems = items.map((item) => ({
          invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          total: parseFloat(
            calculateItemTotal(item.quantity, item.unit_price, item.discount_percent).toFixed(2)
          ),
        }));
        await InvoiceItem.bulkCreate(invoiceItems, { transaction: t });
      }

      return invoice;
    });

    return invoiceService.getById(result.id);
  },

  /**
   * Update an invoice
   */
  update: async (id, data) => {
    const { Invoice, InvoiceItem, sequelize } = require('../models');

    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    const result = await sequelize.transaction(async (t) => {
      const updateData = {};
      if (data.contact_id !== undefined) updateData.contact_id = data.contact_id;
      if (data.company_id !== undefined) updateData.company_id = data.company_id;
      if (data.deal_id !== undefined) updateData.deal_id = data.deal_id;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.currency !== undefined) updateData.currency = data.currency;
      if (data.issue_date !== undefined) updateData.issue_date = data.issue_date;
      if (data.due_date !== undefined) updateData.due_date = data.due_date;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.tax_rate !== undefined) updateData.tax_rate = data.tax_rate;
      if (data.discount_amount !== undefined) updateData.discount_amount = data.discount_amount;

      // If items provided, replace existing and recalculate totals
      if (data.items) {
        await InvoiceItem.destroy({ where: { invoice_id: id }, transaction: t });

        const items = data.items;
        const taxRate = data.tax_rate !== undefined ? data.tax_rate : invoice.tax_rate;
        const discountAmount =
          data.discount_amount !== undefined ? data.discount_amount : invoice.discount_amount;
        const totals = calculateTotals(items, taxRate, discountAmount);

        updateData.subtotal = totals.subtotal;
        updateData.tax_amount = totals.tax_amount;
        updateData.total = totals.total;
        updateData.amount_due = totals.total - parseFloat(invoice.amount_paid || 0);

        const invoiceItems = items.map((item) => ({
          invoice_id: id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          total: parseFloat(
            calculateItemTotal(item.quantity, item.unit_price, item.discount_percent).toFixed(2)
          ),
        }));
        await InvoiceItem.bulkCreate(invoiceItems, { transaction: t });
      }

      await invoice.update(updateData, { transaction: t });
      return invoice;
    });

    return invoiceService.getById(id);
  },

  /**
   * Soft delete an invoice
   */
  delete: async (id) => {
    const { Invoice, InvoiceItem } = require('../models');

    const invoice = await Invoice.findByPk(id);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    await InvoiceItem.destroy({ where: { invoice_id: id } });
    await invoice.destroy();
    return invoice;
  },

  /**
   * Update payment status for an invoice (called by payment service)
   */
  updatePaymentStatus: async (invoiceId) => {
    const { Invoice, Payment, sequelize } = require('../models');

    const invoice = await Invoice.findByPk(invoiceId);
    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    // Sum all payments for this invoice
    const totalPaid = await Payment.sum('amount', {
      where: { invoice_id: invoiceId },
    });

    const amountPaid = parseFloat(totalPaid || 0);
    const total = parseFloat(invoice.total);
    const amountDue = parseFloat((total - amountPaid).toFixed(2));

    let status;
    if (amountPaid >= total) {
      status = 'paid';
    } else if (amountPaid > 0) {
      status = 'partially_paid';
    } else {
      // Keep existing status if no payments (could be draft, sent, or overdue)
      status = invoice.status === 'paid' || invoice.status === 'partially_paid'
        ? 'sent'
        : invoice.status;
    }

    await invoice.update({
      amount_paid: amountPaid,
      amount_due: Math.max(0, amountDue),
      status,
    });

    return invoice;
  },

  /**
   * Get invoice statistics
   */
  getStats: async () => {
    const { Invoice, sequelize } = require('../models');

    // Counts by status
    const statusCounts = await Invoice.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    // Total revenue (sum of total for paid invoices)
    const totalRevenue = await Invoice.sum('total', {
      where: { status: 'paid' },
    });

    // Outstanding amount (sum of amount_due where not cancelled/paid)
    const outstanding = await Invoice.sum('amount_due', {
      where: {
        status: { [Op.notIn]: ['cancelled', 'paid'] },
      },
    });

    return {
      byStatus: statusCounts.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      totalRevenue: parseFloat(totalRevenue || 0).toFixed(2),
      outstanding: parseFloat(outstanding || 0).toFixed(2),
    };
  },
};

module.exports = invoiceService;
