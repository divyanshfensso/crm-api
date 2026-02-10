const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { sanitizeFKFields } = require('../utils/helpers');

const QUOTE_FK_FIELDS = ['contact_id', 'company_id', 'deal_id'];

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

const generateQuoteNumber = async () => {
  const { Quote } = require('../models');
  const lastQuote = await Quote.findOne({ order: [['id', 'DESC']], paranoid: false });
  const nextNum = lastQuote ? lastQuote.id + 1 : 1;
  return `QUO-${String(nextNum).padStart(4, '0')}`;
};

const quoteService = {
  /**
   * Get all quotes with pagination, search, and filters
   */
  getAll: async (query) => {
    const { Quote, User, Contact, Company, QuoteItem } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, status, contact_id, company_id } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search by quote_number
    if (search) {
      where.quote_number = { [Op.like]: `%${search}%` };
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

    const { count, rows } = await Quote.findAndCountAll({
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
          model: QuoteItem,
          as: 'items',
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
   * Get quote by ID with full details
   */
  getById: async (id) => {
    const { Quote, User, Contact, Company, Deal, QuoteItem, Invoice } = require('../models');

    const quote = await Quote.findByPk(id, {
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
          model: QuoteItem,
          as: 'items',
        },
        {
          model: Invoice,
          as: 'invoice',
        },
      ],
    });

    if (!quote) {
      throw ApiError.notFound('Quote not found');
    }

    return quote;
  },

  /**
   * Create a new quote
   */
  create: async (data, userId) => {
    const { Quote, QuoteItem, sequelize } = require('../models');

    const result = await sequelize.transaction(async (t) => {
      const quoteNumber = await generateQuoteNumber();

      const items = data.items || [];
      const totals = calculateTotals(items, data.tax_rate || 0, data.discount_amount || 0);

      const cleanData = sanitizeFKFields(data, QUOTE_FK_FIELDS);
      const quote = await Quote.create(
        {
          quote_number: quoteNumber,
          contact_id: cleanData.contact_id,
          company_id: cleanData.company_id,
          deal_id: cleanData.deal_id,
          status: data.status || 'draft',
          subtotal: totals.subtotal,
          tax_rate: data.tax_rate || 0,
          tax_amount: totals.tax_amount,
          discount_amount: data.discount_amount || 0,
          total: totals.total,
          currency: data.currency || 'USD',
          valid_until: data.valid_until || null,
          notes: data.notes || null,
          created_by: userId,
        },
        { transaction: t }
      );

      if (items.length > 0) {
        const quoteItems = items.map((item) => ({
          quote_id: quote.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          total: parseFloat(
            calculateItemTotal(item.quantity, item.unit_price, item.discount_percent).toFixed(2)
          ),
        }));
        await QuoteItem.bulkCreate(quoteItems, { transaction: t });
      }

      return quote;
    });

    return quoteService.getById(result.id);
  },

  /**
   * Update a quote
   */
  update: async (id, data) => {
    const { Quote, QuoteItem, sequelize } = require('../models');

    const quote = await Quote.findByPk(id);
    if (!quote) {
      throw ApiError.notFound('Quote not found');
    }

    const result = await sequelize.transaction(async (t) => {
      const cleanData = sanitizeFKFields(data, QUOTE_FK_FIELDS);
      const updateData = {};
      if (cleanData.contact_id !== undefined) updateData.contact_id = cleanData.contact_id;
      if (cleanData.company_id !== undefined) updateData.company_id = cleanData.company_id;
      if (cleanData.deal_id !== undefined) updateData.deal_id = cleanData.deal_id;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.currency !== undefined) updateData.currency = data.currency;
      if (data.valid_until !== undefined) updateData.valid_until = data.valid_until;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.tax_rate !== undefined) updateData.tax_rate = data.tax_rate;
      if (data.discount_amount !== undefined) updateData.discount_amount = data.discount_amount;

      // If items provided, replace existing and recalculate totals
      if (data.items) {
        await QuoteItem.destroy({ where: { quote_id: id }, transaction: t });

        const items = data.items;
        const taxRate = data.tax_rate !== undefined ? data.tax_rate : quote.tax_rate;
        const discountAmount =
          data.discount_amount !== undefined ? data.discount_amount : quote.discount_amount;
        const totals = calculateTotals(items, taxRate, discountAmount);

        updateData.subtotal = totals.subtotal;
        updateData.tax_amount = totals.tax_amount;
        updateData.total = totals.total;

        const quoteItems = items.map((item) => ({
          quote_id: id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          total: parseFloat(
            calculateItemTotal(item.quantity, item.unit_price, item.discount_percent).toFixed(2)
          ),
        }));
        await QuoteItem.bulkCreate(quoteItems, { transaction: t });
      }

      await quote.update(updateData, { transaction: t });
      return quote;
    });

    return quoteService.getById(id);
  },

  /**
   * Soft delete a quote
   */
  delete: async (id) => {
    const { Quote, QuoteItem } = require('../models');

    const quote = await Quote.findByPk(id);
    if (!quote) {
      throw ApiError.notFound('Quote not found');
    }

    await QuoteItem.destroy({ where: { quote_id: id } });
    await quote.destroy();
    return quote;
  },

  /**
   * Convert a quote to an invoice
   */
  convertToInvoice: async (quoteId, userId) => {
    const { Quote, QuoteItem, Invoice, InvoiceItem, sequelize } = require('../models');
    const invoiceService = require('./invoice.service');

    const quote = await Quote.findByPk(quoteId, {
      include: [{ model: QuoteItem, as: 'items' }],
    });

    if (!quote) {
      throw ApiError.notFound('Quote not found');
    }

    if (quote.status === 'accepted') {
      throw ApiError.badRequest('Quote has already been converted to an invoice');
    }

    const invoice = await sequelize.transaction(async (t) => {
      // Generate invoice number
      const lastInvoice = await Invoice.findOne({
        order: [['id', 'DESC']],
        paranoid: false,
      });
      const nextNum = lastInvoice ? lastInvoice.id + 1 : 1;
      const invoiceNumber = `INV-${String(nextNum).padStart(4, '0')}`;

      const newInvoice = await Invoice.create(
        {
          invoice_number: invoiceNumber,
          quote_id: quote.id,
          contact_id: quote.contact_id,
          company_id: quote.company_id,
          deal_id: quote.deal_id,
          status: 'draft',
          subtotal: quote.subtotal,
          tax_rate: quote.tax_rate,
          tax_amount: quote.tax_amount,
          discount_amount: quote.discount_amount,
          total: quote.total,
          amount_paid: 0,
          amount_due: quote.total,
          currency: quote.currency,
          issue_date: new Date(),
          notes: quote.notes,
          created_by: userId,
        },
        { transaction: t }
      );

      // Create invoice items from quote items
      if (quote.items && quote.items.length > 0) {
        const invoiceItems = quote.items.map((item) => ({
          invoice_id: newInvoice.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          total: item.total,
        }));
        await InvoiceItem.bulkCreate(invoiceItems, { transaction: t });
      }

      // Update quote status to accepted
      await quote.update({ status: 'accepted' }, { transaction: t });

      return newInvoice;
    });

    return invoiceService.getById(invoice.id);
  },

  /**
   * Get quote statistics
   */
  getStats: async () => {
    const { Quote, sequelize } = require('../models');

    // Counts by status
    const statusCounts = await Quote.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    });

    // Total value of all quotes
    const totalValue = await Quote.sum('total');

    return {
      byStatus: statusCounts.reduce((acc, row) => {
        acc[row.status] = parseInt(row.count);
        return acc;
      }, {}),
      totalValue: parseFloat(totalValue || 0).toFixed(2),
    };
  },
};

module.exports = quoteService;
