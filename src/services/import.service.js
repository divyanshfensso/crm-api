const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { normalizeEnumFields } = require('../config/enums');

// Template columns — includes human-readable FK name columns alongside ID columns
const ENTITY_COLUMNS = {
  contacts: ['first_name', 'last_name', 'email', 'phone', 'mobile', 'company_name', 'job_title', 'department', 'lead_source', 'status', 'address_line1', 'city', 'state', 'country', 'zip_code'],
  companies: ['name', 'industry', 'website', 'phone', 'email', 'employee_count', 'annual_revenue', 'address_line1', 'city', 'state', 'country', 'zip_code'],
  leads: ['first_name', 'last_name', 'email', 'phone', 'company_name', 'job_title', 'lead_source', 'status', 'score'],
  deals: ['title', 'value', 'currency', 'probability', 'status', 'expected_close_date', 'contact_name', 'company_name', 'stage'],
};

// Example values row for templates — shows valid values for ENUM/FK fields
const ENTITY_EXAMPLES = {
  contacts: ['John', 'Doe', 'john@example.com', '+1234567890', '', 'Acme Corp', 'Manager', 'Sales', 'website', 'active|inactive|prospect|customer|churned', '', '', '', '', ''],
  companies: ['Acme Corp', 'Technology', 'https://acme.com', '+1234567890', 'info@acme.com', '50', '1000000', '', '', '', '', ''],
  leads: ['Jane', 'Smith', 'jane@example.com', '+1234567890', 'Acme Corp', 'Director', 'website', 'new|contacted|qualified|unqualified|converted|lost', '75'],
  deals: ['New Deal', '50000', 'USD|EUR|GBP|INR', '75', 'open|won|lost', '2025-12-31', 'John Doe', 'Acme Corp', 'Qualification'],
};

/**
 * Resolve human-readable name references to foreign key IDs.
 * Handles: company_name → company_id, contact_name → contact_id, stage → stage_id
 */
async function resolveReferences(entityType, row) {
  const models = require('../models');
  const sequelize = models.sequelize || models.Sequelize;

  if (entityType === 'contacts') {
    // company_name → company_id
    if (row.company_name && !row.company_id) {
      const company = await models.Company.findOne({
        where: { name: { [Op.like]: row.company_name.trim() } },
        attributes: ['id'],
        paranoid: true,
      });
      if (company) row.company_id = company.id;
      delete row.company_name;
    }
    // Also handle legacy 'company' field from older templates
    if (row.company && !row.company_id) {
      const company = await models.Company.findOne({
        where: { name: { [Op.like]: row.company.trim() } },
        attributes: ['id'],
        paranoid: true,
      });
      if (company) row.company_id = company.id;
      delete row.company;
    }
  }

  if (entityType === 'deals') {
    // contact_name → contact_id
    if (row.contact_name && !row.contact_id) {
      const nameParts = row.contact_name.trim().split(/\s+/);
      let contact = null;
      if (nameParts.length >= 2) {
        contact = await models.Contact.findOne({
          where: {
            first_name: { [Op.like]: nameParts[0] },
            last_name: { [Op.like]: nameParts.slice(1).join(' ') },
          },
          attributes: ['id'],
          paranoid: true,
        });
      }
      // Fallback: try matching by email
      if (!contact) {
        contact = await models.Contact.findOne({
          where: { email: { [Op.like]: row.contact_name.trim() } },
          attributes: ['id'],
          paranoid: true,
        });
      }
      if (contact) row.contact_id = contact.id;
      delete row.contact_name;
    }

    // company_name → company_id
    if (row.company_name && !row.company_id) {
      const company = await models.Company.findOne({
        where: { name: { [Op.like]: row.company_name.trim() } },
        attributes: ['id'],
        paranoid: true,
      });
      if (company) row.company_id = company.id;
      delete row.company_name;
    }

    // stage → stage_id (+ pipeline_id)
    if (row.stage && !row.stage_id) {
      const stage = await models.PipelineStage.findOne({
        where: { name: { [Op.like]: row.stage.trim() } },
        attributes: ['id', 'pipeline_id'],
      });
      if (stage) {
        row.stage_id = stage.id;
        if (!row.pipeline_id) row.pipeline_id = stage.pipeline_id;
      }
      delete row.stage;
    }
  }

  return row;
}

const importService = {
  /**
   * Get all import jobs with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated import jobs list
   */
  getAll: async (query) => {
    const { ImportJob, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, entity_type, status } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['filename']);
      Object.assign(where, searchCondition);
    }

    // Filter by entity_type
    if (entity_type) {
      where.entity_type = entity_type;
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    const { count, rows } = await ImportJob.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ],
      order,
      limit,
      offset,
      distinct: true
    });

    return {
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  },

  /**
   * Get import job by ID
   * @param {number} id - Import job ID
   * @returns {Promise<Object>} Import job with creator
   */
  getById: async (id) => {
    const { ImportJob, User } = require('../models');

    const importJob = await ImportJob.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    if (!importJob) {
      throw ApiError.notFound('Import job not found');
    }

    return importJob;
  },

  /**
   * Get CSV template for a given entity type.
   * Includes a header row and an example row showing valid values.
   * @param {string} entityType - Entity type (contacts, companies, leads, deals)
   * @returns {string} CSV string with column headers and example row
   */
  getTemplate: (entityType) => {
    const columns = ENTITY_COLUMNS[entityType];

    if (!columns) {
      throw ApiError.badRequest(`Invalid entity type: ${entityType}. Valid types: ${Object.keys(ENTITY_COLUMNS).join(', ')}`);
    }

    const { stringify } = require('csv-stringify/sync');
    const examples = ENTITY_EXAMPLES[entityType] || [];
    const csv = stringify([columns, examples]);

    return csv;
  },

  /**
   * Upload a CSV file and create an import job record
   * @param {Object} file - Multer file object
   * @param {string} entityType - Entity type
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created import job
   */
  upload: async (file, entityType, userId) => {
    const { ImportJob } = require('../models');

    if (!file) {
      throw ApiError.badRequest('File is required');
    }

    if (!ENTITY_COLUMNS[entityType]) {
      throw ApiError.badRequest(`Invalid entity type: ${entityType}. Valid types: ${Object.keys(ENTITY_COLUMNS).join(', ')}`);
    }

    const importJob = await ImportJob.create({
      filename: file.originalname,
      file_path: file.path,
      entity_type: entityType,
      created_by: userId
    });

    return importJob;
  },

  /**
   * Preview the first 10 rows of an import job's CSV file
   * @param {number} importId - Import job ID
   * @returns {Promise<Object>} Headers and first 10 rows
   */
  preview: async (importId) => {
    const { ImportJob } = require('../models');

    const importJob = await ImportJob.findByPk(importId);

    if (!importJob) {
      throw ApiError.notFound('Import job not found');
    }

    if (!fs.existsSync(importJob.file_path)) {
      throw ApiError.notFound('Import file not found on disk');
    }

    const csvParser = require('csv-parser');

    return new Promise((resolve, reject) => {
      const rows = [];
      let headers = [];

      const stream = fs.createReadStream(importJob.file_path)
        .pipe(csvParser())
        .on('headers', (h) => {
          headers = h;
        })
        .on('data', (row) => {
          rows.push(row);
          if (rows.length >= 10) {
            stream.destroy();
          }
        })
        .on('close', () => {
          resolve({ headers, rows });
        })
        .on('end', () => {
          resolve({ headers, rows });
        })
        .on('error', (err) => {
          reject(ApiError.badRequest(`Error reading CSV file: ${err.message}`));
        });
    });
  },

  /**
   * Save column mapping for an import job
   * @param {number} importId - Import job ID
   * @param {Object} mapping - Column mapping (CSV column -> DB column)
   * @returns {Promise<Object>} Updated import job
   */
  mapColumns: async (importId, mapping) => {
    const { ImportJob } = require('../models');

    const importJob = await ImportJob.findByPk(importId);

    if (!importJob) {
      throw ApiError.notFound('Import job not found');
    }

    await importJob.update({ column_mapping: mapping });

    return importJob;
  },

  /**
   * Process an import job: read CSV, create records, track progress.
   * Includes ENUM normalization and FK name-to-ID resolution.
   * @param {number} importId - Import job ID
   * @returns {Promise<Object>} Updated import job with final counts
   */
  process: async (importId) => {
    const { ImportJob } = require('../models');

    const importJob = await ImportJob.findByPk(importId);

    if (!importJob) {
      throw ApiError.notFound('Import job not found');
    }

    if (!fs.existsSync(importJob.file_path)) {
      throw ApiError.notFound('Import file not found on disk');
    }

    const modelMap = {
      contacts: 'Contact',
      companies: 'Company',
      leads: 'Lead',
      deals: 'Deal'
    };

    const modelName = modelMap[importJob.entity_type];
    if (!modelName) {
      throw ApiError.badRequest(`Unsupported entity type: ${importJob.entity_type}`);
    }

    const models = require('../models');
    const Model = models[modelName];

    // Update status to processing
    await importJob.update({ status: 'processing', error_log: [] });

    const csvParser = require('csv-parser');
    const columnMapping = importJob.column_mapping || {};

    return new Promise((resolve, reject) => {
      let successCount = 0;
      let errorCount = 0;
      let processedRows = 0;
      const errorLog = [];

      const stream = fs.createReadStream(importJob.file_path)
        .pipe(csvParser());

      const rowPromises = [];

      stream.on('data', (row) => {
        // Apply column mapping: rename CSV columns to DB columns
        const mappedRow = {};
        for (const [csvCol, value] of Object.entries(row)) {
          const dbCol = columnMapping[csvCol];
          // Skip columns explicitly mapped to "" (Skip Column)
          // If no mapping exists (undefined), fall back to CSV header name
          const targetCol = dbCol !== undefined ? dbCol : csvCol;
          if (!targetCol) continue; // Skip empty-mapped columns
          if (value !== undefined && value !== '') {
            mappedRow[targetCol] = value;
          }
        }

        // Set created_by from the import job creator
        if (importJob.created_by) {
          mappedRow.created_by = importJob.created_by;
        }

        const rowIndex = processedRows + 1;

        // Async processing: normalize enums, resolve FK references, then create
        const rowPromise = (async () => {
          try {
            // 1. Normalize ENUM values (case-insensitive matching)
            normalizeEnumFields(importJob.entity_type, mappedRow);

            // 2. Resolve human-readable FK references to IDs
            await resolveReferences(importJob.entity_type, mappedRow);

            // 3. Sanitize FK fields — convert empty strings to null
            const fkFields = ['company_id', 'contact_id', 'owner_id', 'pipeline_id', 'stage_id'];
            for (const field of fkFields) {
              const val = mappedRow[field];
              if (val === '' || val === undefined || val === '0' || val === 0) {
                mappedRow[field] = null;
              }
            }

            // 4. Create the record
            await Model.create(mappedRow);
            successCount++;
          } catch (err) {
            errorCount++;
            errorLog.push({
              row: rowIndex,
              data: mappedRow,
              error: err.message
            });
          } finally {
            processedRows++;
          }
        })();

        rowPromises.push(rowPromise);
      });

      stream.on('end', async () => {
        try {
          // Wait for all row operations to complete
          await Promise.all(rowPromises);

          // Determine final status
          const finalStatus = errorCount > 0 && successCount === 0 ? 'failed' : 'completed';

          await importJob.update({
            status: finalStatus,
            total_rows: processedRows,
            processed_rows: processedRows,
            success_count: successCount,
            error_count: errorCount,
            error_log: errorLog.length > 0 ? errorLog : null
          });

          resolve(importJob);
        } catch (err) {
          reject(err);
        }
      });

      stream.on('error', async (err) => {
        await importJob.update({ status: 'failed' });
        reject(ApiError.badRequest(`Error processing CSV file: ${err.message}`));
      });
    });
  }
};

module.exports = importService;
