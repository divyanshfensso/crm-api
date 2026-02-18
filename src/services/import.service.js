const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { ENUMS, normalizeEnumFields } = require('../config/enums');

/**
 * Detect file encoding from BOM bytes and convert UTF-16 files to UTF-8.
 * Returns the (possibly converted) file path to use for parsing.
 */
function ensureUtf8(filePath) {
  const buf = Buffer.alloc(4);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);

  // UTF-16 LE BOM: FF FE
  if (buf[0] === 0xFF && buf[1] === 0xFE) {
    const raw = fs.readFileSync(filePath);
    const text = raw.toString('utf16le').replace(/^\uFEFF/, '');
    const utf8Path = filePath + '.utf8.csv';
    fs.writeFileSync(utf8Path, text, 'utf8');
    return utf8Path;
  }
  // UTF-16 BE BOM: FE FF
  if (buf[0] === 0xFE && buf[1] === 0xFF) {
    const raw = fs.readFileSync(filePath);
    // Swap bytes for BE → LE then decode
    for (let i = 0; i < raw.length - 1; i += 2) {
      const tmp = raw[i];
      raw[i] = raw[i + 1];
      raw[i + 1] = tmp;
    }
    const text = raw.toString('utf16le').replace(/^\uFEFF/, '');
    const utf8Path = filePath + '.utf8.csv';
    fs.writeFileSync(utf8Path, text, 'utf8');
    return utf8Path;
  }
  return filePath; // Already UTF-8 (or ASCII)
}

/**
 * Auto-detect CSV delimiter by reading the first 2 lines and testing common separators.
 * Returns the delimiter character that produces the most consistent column split.
 */
function detectDelimiter(filePath) {
  const CANDIDATES = [',', ';', '\t', '|'];

  // Read first ~8KB to get at least 2 lines
  const fd = fs.openSync(filePath, 'r');
  const chunk = Buffer.alloc(8192);
  const bytesRead = fs.readSync(fd, chunk, 0, 8192, 0);
  fs.closeSync(fd);

  const text = chunk.toString('utf8', 0, bytesRead).replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

  if (lines.length < 1) return ','; // fallback

  const headerLine = lines[0];
  const dataLine = lines.length > 1 ? lines[1] : null;

  let bestDelimiter = ',';
  let bestScore = 0;

  for (const delim of CANDIDATES) {
    const headerCols = headerLine.split(delim).length;
    if (headerCols <= 1) continue; // This delimiter doesn't split the header

    let score = headerCols; // More columns = more likely the right delimiter
    if (dataLine) {
      const dataCols = dataLine.split(delim).length;
      // Bonus if header and data row have same column count
      if (dataCols === headerCols) score += headerCols * 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delim;
    }
  }

  return bestDelimiter;
}

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

// Required fields per entity type
const REQUIRED_FIELDS = {
  contacts: ['first_name', 'last_name'],
  companies: ['name'],
  leads: ['first_name', 'last_name'],
  deals: ['title'],
};

/**
 * Apply a deterministic transformation to a value
 */
function transformValue(value, transformation) {
  if (value === null || value === undefined || !transformation) return value;
  const str = String(value).trim();
  if (!str) return str;

  switch (transformation) {
    case 'split_name_first':
      return str.split(/\s+/)[0] || str;
    case 'split_name_last': {
      const parts = str.split(/\s+/);
      return parts.length > 1 ? parts.slice(1).join(' ') : '';
    }
    case 'normalize_date': {
      const d = new Date(str);
      return isNaN(d.getTime()) ? str : d.toISOString().split('T')[0];
    }
    case 'normalize_status':
      return str.toLowerCase().replace(/\s+/g, '_');
    case 'normalize_phone':
      return str.replace(/[^+\d]/g, '');
    case 'to_number': {
      const num = parseFloat(str.replace(/[^0-9.\-]/g, ''));
      return isNaN(num) ? str : num;
    }
    case 'to_lowercase':
      return str.toLowerCase();
    default:
      return str;
  }
}

/**
 * Apply new-format mappings (array-based) to a CSV row
 * Returns a mapped row object ready for DB insertion
 */
function normalizeCsvRowKeys(row) {
  const normalized = {};
  for (const [key, value] of Object.entries(row)) {
    // Strip BOM, zero-width chars, trim whitespace, normalize quotes
    const cleanKey = key
      .replace(/^\uFEFF/, '')
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
      .replace(/^["']|["']$/g, '')
      .trim();
    normalized[cleanKey] = value;
  }
  return normalized;
}

function applyMappings(csvRow, mappings) {
  const normalizedRow = normalizeCsvRowKeys(csvRow);
  const mappedRow = {};
  const notesAccumulator = [];
  let tagsAccumulator = [];

  for (const mapping of mappings) {
    const { csv_column, crm_field, transformation } = mapping;
    if (!crm_field || crm_field === '') continue; // Skip column

    // Normalize the csv_column key the same way
    const cleanCol = (csv_column || '').replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').replace(/^["']|["']$/g, '').trim();
    const rawValue = normalizedRow[cleanCol];
    if (rawValue === undefined || rawValue === '') continue;

    if (crm_field === '__notes__') {
      notesAccumulator.push(`${csv_column}: ${rawValue}`);
    } else if (crm_field === '__tags__') {
      tagsAccumulator.push(String(rawValue).trim());
    } else if (crm_field.startsWith('custom_fields.')) {
      const cfKey = crm_field.substring('custom_fields.'.length);
      if (!mappedRow.custom_fields) mappedRow.custom_fields = {};
      mappedRow.custom_fields[cfKey] = transformValue(rawValue, transformation);
    } else {
      const transformed = transformValue(rawValue, transformation);
      mappedRow[crm_field] = transformed;
    }
  }

  // Append accumulated notes
  if (notesAccumulator.length > 0) {
    const existingNotes = mappedRow.notes || '';
    const importNotes = '[Imported Data]\n' + notesAccumulator.join('\n');
    mappedRow.notes = existingNotes ? `${existingNotes}\n\n${importNotes}` : importNotes;
  }

  // Append accumulated tags
  if (tagsAccumulator.length > 0) {
    const existingTags = Array.isArray(mappedRow.tags) ? mappedRow.tags : [];
    mappedRow.tags = [...existingTags, ...tagsAccumulator];
  }

  return mappedRow;
}

/**
 * Check if column_mapping is in the new format (has mappings array)
 */
function isNewMappingFormat(columnMapping) {
  return columnMapping && Array.isArray(columnMapping.mappings);
}

/**
 * Resolve human-readable name references to foreign key IDs.
 * Handles: company_name → company_id, contact_name → contact_id, stage → stage_id
 */
async function resolveReferences(entityType, row) {
  const models = require('../models');

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
   */
  getAll: async (query) => {
    const { ImportJob, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, entity_type, status } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    if (search) {
      const searchCondition = buildSearchCondition(search, ['filename']);
      Object.assign(where, searchCondition);
    }

    if (entity_type) {
      where.entity_type = entity_type;
    }

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
   * Update the entity type of an import job (after AI detection)
   */
  updateEntityType: async (importId, entityType) => {
    const { ImportJob } = require('../models');

    if (!ENTITY_COLUMNS[entityType]) {
      throw ApiError.badRequest(`Invalid entity type: ${entityType}. Valid types: ${Object.keys(ENTITY_COLUMNS).join(', ')}`);
    }

    const importJob = await ImportJob.findByPk(importId);
    if (!importJob) {
      throw ApiError.notFound('Import job not found');
    }

    await importJob.update({ entity_type: entityType });
    return importJob;
  },

  /**
   * Preview the first 10 rows of an import job's CSV file
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
    const parsePath = ensureUtf8(importJob.file_path);
    const separator = detectDelimiter(parsePath);

    return new Promise((resolve, reject) => {
      const rows = [];
      let headers = [];

      const stream = fs.createReadStream(parsePath)
        .pipe(csvParser({ bom: true, separator }))
        .on('headers', (h) => {
          // Normalize headers: strip BOM, zero-width chars, trim whitespace
          headers = h.map(name => name
            .replace(/^\uFEFF/, '')
            .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
            .replace(/^["']|["']$/g, '')
            .trim()
          );
        })
        .on('data', (row) => {
          rows.push(normalizeCsvRowKeys(row));
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
   * Supports both old format { csvCol: dbCol } and new format { mappings: [...] }
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
   * Validate import data before processing (dry-run)
   * Reads up to 100 rows, applies mapping + transforms, checks for issues
   */
  validate: async (importId) => {
    const { ImportJob } = require('../models');
    const csvParser = require('csv-parser');

    const importJob = await ImportJob.findByPk(importId);
    if (!importJob) {
      throw ApiError.notFound('Import job not found');
    }

    if (!fs.existsSync(importJob.file_path)) {
      throw ApiError.notFound('Import file not found on disk');
    }

    let columnMapping = importJob.column_mapping || {};
    // Safety: handle MySQL returning JSON as string (double-serialization)
    if (typeof columnMapping === 'string') {
      try { columnMapping = JSON.parse(columnMapping); } catch (e) { /* keep as-is */ }
    }
    const entityType = importJob.entity_type;
    const useNewFormat = isNewMappingFormat(columnMapping);
    const required = REQUIRED_FIELDS[entityType] || [];
    const entityEnums = ENUMS[entityType] || {};

    const parsePath = ensureUtf8(importJob.file_path);
    const separator = detectDelimiter(parsePath);

    // Debug diagnostics — included in API response
    const _debug = {
      separator,
      columnMappingType: typeof columnMapping,
      useNewFormat,
      mappingSample: useNewFormat ? (columnMapping.mappings || []).slice(0, 2) : 'legacy',
    };

    return new Promise((resolve, reject) => {
      const warnings = [];
      let totalRows = 0;
      let validRows = 0;
      let errorRows = 0;
      const maxRows = 100;

      const stream = fs.createReadStream(parsePath)
        .pipe(csvParser({ bom: true, separator }));

      stream.on('headers', (h) => {
        _debug.csvHeaders = h;
        console.log('[Import Validate] CSV headers:', h, '| separator:', JSON.stringify(separator));
      });

      stream.on('data', (row) => {
        totalRows++;
        if (totalRows > maxRows) return;

        // Capture debug info from first row
        if (totalRows === 1) {
          _debug.firstRowKeys = Object.keys(row);
          _debug.firstRowSample = Object.fromEntries(Object.entries(row).slice(0, 3));
        }

        // Apply mapping (normalize CSV row keys to handle BOM/whitespace mismatches)
        const normalizedRow = normalizeCsvRowKeys(row);
        let mappedRow;
        if (useNewFormat) {
          mappedRow = applyMappings(row, columnMapping.mappings);
        } else {
          mappedRow = {};
          for (const [csvCol, value] of Object.entries(normalizedRow)) {
            const dbCol = columnMapping[csvCol];
            const targetCol = dbCol !== undefined ? dbCol : csvCol;
            if (!targetCol) continue;
            if (value !== undefined && value !== '') {
              mappedRow[targetCol] = value;
            }
          }
        }

        // Capture mapped row debug for first row
        if (totalRows === 1) {
          _debug.firstMappedRow = JSON.parse(JSON.stringify(mappedRow));
        }

        let rowHasError = false;

        // Check required fields
        for (const field of required) {
          if (!mappedRow[field] || String(mappedRow[field]).trim() === '') {
            const existing = warnings.find(w => w.type === 'missing_required' && w.field === field);
            if (existing) {
              existing.rows.push(totalRows);
              existing.message = `${existing.rows.length} rows missing required field "${field}"`;
            } else {
              warnings.push({
                type: 'missing_required',
                field,
                message: `1 row missing required field "${field}"`,
                severity: 'error',
                rows: [totalRows],
              });
            }
            rowHasError = true;
          }
        }

        // Check enum values
        for (const [field, validValues] of Object.entries(entityEnums)) {
          if (mappedRow[field] && typeof mappedRow[field] === 'string') {
            const normalized = mappedRow[field].trim().toLowerCase().replace(/\s+/g, '_');
            const match = validValues.find(v => v.toLowerCase() === normalized);
            if (!match) {
              const existing = warnings.find(w => w.type === 'invalid_enum' && w.field === field);
              if (existing) {
                existing.rows.push(totalRows);
                existing.message = `${existing.rows.length} rows have invalid "${field}" value`;
              } else {
                warnings.push({
                  type: 'invalid_enum',
                  field,
                  message: `Row ${totalRows} has invalid "${field}" value: "${mappedRow[field]}". Valid: ${validValues.join(', ')}`,
                  severity: 'warning',
                  rows: [totalRows],
                });
              }
            }
          }
        }

        // Check email format
        if (mappedRow.email && typeof mappedRow.email === 'string') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(mappedRow.email.trim())) {
            const existing = warnings.find(w => w.type === 'invalid_email');
            if (existing) {
              existing.rows.push(totalRows);
              existing.message = `${existing.rows.length} rows have invalid email format`;
            } else {
              warnings.push({
                type: 'invalid_email',
                field: 'email',
                message: `Row ${totalRows} has invalid email format`,
                severity: 'warning',
                rows: [totalRows],
              });
            }
          }
        }

        // Check numeric fields
        const numericFields = ['employee_count', 'annual_revenue', 'value', 'probability', 'score'];
        for (const field of numericFields) {
          if (mappedRow[field] && typeof mappedRow[field] === 'string') {
            const cleaned = mappedRow[field].replace(/[^0-9.\-]/g, '');
            if (cleaned && isNaN(parseFloat(cleaned))) {
              const existing = warnings.find(w => w.type === 'invalid_number' && w.field === field);
              if (existing) {
                existing.rows.push(totalRows);
                existing.message = `${existing.rows.length} rows have invalid number in "${field}"`;
              } else {
                warnings.push({
                  type: 'invalid_number',
                  field,
                  message: `Row ${totalRows} has invalid number in "${field}"`,
                  severity: 'warning',
                  rows: [totalRows],
                });
              }
            }
          }
        }

        if (rowHasError) {
          errorRows++;
        } else {
          validRows++;
        }
      });

      stream.on('end', () => {
        // Calculate quality score
        const analyzedRows = Math.min(totalRows, maxRows);
        const qualityScore = analyzedRows > 0
          ? Math.round((validRows / analyzedRows) * 100)
          : 0;

        resolve({
          total_rows: totalRows,
          analyzed_rows: analyzedRows,
          valid_rows: validRows,
          error_rows: errorRows,
          quality_score: qualityScore,
          warnings: warnings.map(w => ({
            type: w.type,
            field: w.field,
            message: w.message,
            severity: w.severity,
            affected_rows: w.rows.slice(0, 10), // Limit displayed rows
            count: w.rows.length,
          })),
          _debug,
        });
      });

      stream.on('error', (err) => {
        reject(ApiError.badRequest(`Error reading CSV file: ${err.message}`));
      });
    });
  },

  /**
   * Process an import job: read CSV, create records, track progress.
   * Supports both old mapping format and new AI-powered mapping format.
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
    let columnMapping = importJob.column_mapping || {};
    // Safety: handle MySQL returning JSON as string (double-serialization)
    if (typeof columnMapping === 'string') {
      try { columnMapping = JSON.parse(columnMapping); } catch (e) { /* keep as-is */ }
    }
    const useNewFormat = isNewMappingFormat(columnMapping);
    const parsePath = ensureUtf8(importJob.file_path);
    const separator = detectDelimiter(parsePath);

    return new Promise((resolve, reject) => {
      let successCount = 0;
      let errorCount = 0;
      let processedRows = 0;
      const errorLog = [];

      const stream = fs.createReadStream(parsePath)
        .pipe(csvParser({ bom: true, separator }));

      const rowPromises = [];

      stream.on('data', (row) => {
        // Apply column mapping based on format (normalize keys for BOM/whitespace)
        const normalizedRow = normalizeCsvRowKeys(row);
        let mappedRow;

        if (useNewFormat) {
          // New AI-powered format: { mappings: [...] }
          mappedRow = applyMappings(row, columnMapping.mappings);
        } else {
          // Legacy format: { csvCol: dbCol }
          mappedRow = {};
          for (const [csvCol, value] of Object.entries(normalizedRow)) {
            const dbCol = columnMapping[csvCol];
            const targetCol = dbCol !== undefined ? dbCol : csvCol;
            if (!targetCol) continue;
            if (value !== undefined && value !== '') {
              mappedRow[targetCol] = value;
            }
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
