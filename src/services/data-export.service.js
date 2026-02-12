const { Op } = require('sequelize');
const fs = require('fs');
const path = require('path');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting } = require('../utils/pagination');

const modelMap = {
  contacts: 'Contact',
  leads: 'Lead',
  deals: 'Deal',
  companies: 'Company',
  activities: 'Activity',
  tasks: 'Task',
  quotes: 'Quote',
  invoices: 'Invoice',
  payments: 'Payment'
};

/**
 * Get association includes for a given entity type.
 * Returns Sequelize include options to eager-load related names.
 */
function getEntityIncludes(entityType, db) {
  const includes = {
    contacts: [
      { model: db.Company, as: 'company', attributes: ['name'] },
      { model: db.User, as: 'owner', attributes: ['first_name', 'last_name'] },
    ],
    deals: [
      { model: db.Contact, as: 'contact', attributes: ['first_name', 'last_name', 'email'] },
      { model: db.Company, as: 'company', attributes: ['name'] },
      { model: db.PipelineStage, as: 'stage', attributes: ['name'] },
      { model: db.User, as: 'owner', attributes: ['first_name', 'last_name'] },
    ],
    leads: [
      { model: db.User, as: 'owner', attributes: ['first_name', 'last_name'] },
    ],
    companies: [
      { model: db.User, as: 'owner', attributes: ['first_name', 'last_name'] },
    ],
    activities: [
      { model: db.User, as: 'user', attributes: ['first_name', 'last_name'] },
    ],
    tasks: [
      { model: db.User, as: 'assignee', attributes: ['first_name', 'last_name'] },
    ],
  };
  return includes[entityType] || [];
}

/**
 * Flatten nested association objects into human-readable columns.
 * E.g., { company: { name: 'Acme' } } → { company_name: 'Acme' }
 */
function flattenRecord(record) {
  const flat = { ...record };

  if (flat.contact && typeof flat.contact === 'object') {
    flat.contact_name = `${flat.contact.first_name || ''} ${flat.contact.last_name || ''}`.trim();
    flat.contact_email = flat.contact.email || '';
    delete flat.contact;
  }

  if (flat.company && typeof flat.company === 'object') {
    flat.company_name = flat.company.name || '';
    delete flat.company;
  }

  if (flat.stage && typeof flat.stage === 'object') {
    flat.stage_name = flat.stage.name || '';
    delete flat.stage;
  }

  if (flat.owner && typeof flat.owner === 'object') {
    flat.owner_name = `${flat.owner.first_name || ''} ${flat.owner.last_name || ''}`.trim();
    delete flat.owner;
  }

  if (flat.user && typeof flat.user === 'object') {
    flat.user_name = `${flat.user.first_name || ''} ${flat.user.last_name || ''}`.trim();
    delete flat.user;
  }

  if (flat.assignee && typeof flat.assignee === 'object') {
    flat.assignee_name = `${flat.assignee.first_name || ''} ${flat.assignee.last_name || ''}`.trim();
    delete flat.assignee;
  }

  // Remove nested objects that may remain (e.g., pipeline, creator)
  for (const key of Object.keys(flat)) {
    if (flat[key] && typeof flat[key] === 'object' && !Array.isArray(flat[key]) && !(flat[key] instanceof Date)) {
      delete flat[key];
    }
  }

  return flat;
}

const dataExportService = {
  /**
   * Create a new data export request
   * @param {Array} entityTypes - Entity types to export
   * @param {string} format - Export format ('csv' or 'json')
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created data export record
   */
  create: async (entityTypes, format, userId) => {
    const { DataExport } = require('../models');

    const exportRecord = await DataExport.create({
      entity_types: entityTypes,
      format: format || 'csv',
      status: 'pending',
      user_id: userId,
      created_by: userId
    });

    // Process export asynchronously
    dataExportService.processExport(exportRecord.id).catch((err) => {
      console.error('Export processing error:', err.message);
    });

    return exportRecord;
  },

  /**
   * Get all data exports for a user with pagination
   * @param {Object} query - Query parameters
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Paginated data exports list
   */
  getAll: async (query, userId) => {
    const { DataExport, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const order = getSorting(query, 'created_at', 'DESC');

    const where = { user_id: userId };

    const { count, rows } = await DataExport.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
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
        totalPages: Math.ceil(count / limit),
        hasNextPage: page < Math.ceil(count / limit),
        hasPrevPage: page > 1
      }
    };
  },

  /**
   * Get data export by ID
   * @param {number} id - Export ID
   * @returns {Promise<Object>} Data export with creator
   */
  getById: async (id) => {
    const { DataExport, User } = require('../models');

    const exportRecord = await DataExport.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });

    if (!exportRecord) {
      throw ApiError.notFound('Data export not found');
    }

    return exportRecord;
  },

  /**
   * Process a data export (core async operation)
   * @param {number} exportId - Export record ID
   */
  processExport: async (exportId) => {
    const db = require('../models');
    const { DataExport } = db;

    const exportRecord = await DataExport.findByPk(exportId);
    if (!exportRecord) return;

    try {
      // Update status to processing
      await exportRecord.update({ status: 'processing' });

      const entityTypes = exportRecord.entity_types;
      const allData = {};

      // Collect data for each entity type
      for (const entityType of entityTypes) {
        const modelName = modelMap[entityType];
        if (!modelName) continue;

        const Model = db[modelName];
        if (!Model) continue;

        // Build where clause: records owned by or created by the user
        // Handle models that may not have owner_id
        const modelAttributes = Object.keys(Model.rawAttributes);
        const hasOwnerId = modelAttributes.includes('owner_id');

        let where;
        if (hasOwnerId) {
          where = {
            [Op.or]: [
              { owner_id: exportRecord.user_id },
              { created_by: exportRecord.user_id }
            ]
          };
        } else {
          where = { created_by: exportRecord.user_id };
        }

        // Include associations for human-readable names
        const includes = getEntityIncludes(entityType, db);

        const records = await Model.findAll({ where, include: includes });
        allData[entityType] = records.map((record) => {
          const json = record.toJSON ? record.toJSON() : record;
          return flattenRecord(json);
        });
      }

      // Ensure exports directory exists
      const exportsDir = path.join(process.cwd(), 'uploads', 'exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const entityKeys = Object.keys(allData);
      let filePath;
      let fileSize;

      if (entityKeys.length > 1) {
        // Multiple entities: create ZIP archive
        const archiver = require('archiver');
        const zipFileName = `export_${exportId}_${Date.now()}.zip`;
        filePath = path.join(exportsDir, zipFileName);

        await new Promise((resolve, reject) => {
          const output = fs.createWriteStream(filePath);
          const archive = archiver('zip', { zlib: { level: 9 } });

          output.on('close', () => {
            fileSize = archive.pointer();
            resolve();
          });

          archive.on('error', (err) => reject(err));
          archive.pipe(output);

          for (const entityType of entityKeys) {
            const records = allData[entityType];

            if (exportRecord.format === 'csv') {
              const { stringify } = require('csv-stringify/sync');
              const csvContent = records.length > 0
                ? stringify(records, { header: true })
                : '';
              archive.append(csvContent, { name: `${entityType}.csv` });
            } else {
              const jsonContent = JSON.stringify(records, null, 2);
              archive.append(jsonContent, { name: `${entityType}.json` });
            }
          }

          archive.finalize();
        });
      } else {
        // Single entity: save directly
        const entityType = entityKeys[0];
        const records = allData[entityType] || [];

        if (exportRecord.format === 'csv') {
          const { stringify } = require('csv-stringify/sync');
          const csvContent = records.length > 0
            ? stringify(records, { header: true })
            : '';
          const fileName = `export_${exportId}_${entityType}_${Date.now()}.csv`;
          filePath = path.join(exportsDir, fileName);
          fs.writeFileSync(filePath, csvContent, 'utf-8');
          fileSize = Buffer.byteLength(csvContent, 'utf-8');
        } else {
          const jsonContent = JSON.stringify(records, null, 2);
          const fileName = `export_${exportId}_${entityType}_${Date.now()}.json`;
          filePath = path.join(exportsDir, fileName);
          fs.writeFileSync(filePath, jsonContent, 'utf-8');
          fileSize = Buffer.byteLength(jsonContent, 'utf-8');
        }
      }

      // Update export record as completed
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await exportRecord.update({
        status: 'completed',
        file_path: filePath,
        file_size: fileSize,
        expires_at: expiresAt
      });
    } catch (error) {
      // Update export record as failed
      await exportRecord.update({
        status: 'failed',
        error_message: error.message
      });
    }
  },

  /**
   * Download an export file
   * @param {number} id - Export ID
   * @param {number} userId - Current user ID
   * @returns {Promise<string>} File path
   */
  downloadExport: async (id, userId) => {
    const exportRecord = await dataExportService.getById(id);

    if (exportRecord.user_id !== userId) {
      throw ApiError.notFound('Data export not found');
    }

    if (!exportRecord.file_path || !fs.existsSync(exportRecord.file_path)) {
      throw ApiError.notFound('Export file not found');
    }

    return exportRecord.file_path;
  },

  /**
   * Delete a data export and its file
   * @param {number} id - Export ID
   * @returns {Promise<Object>} Deleted export info
   */
  delete: async (id) => {
    const { DataExport } = require('../models');

    const exportRecord = await DataExport.findByPk(id);

    if (!exportRecord) {
      throw ApiError.notFound('Data export not found');
    }

    // Remove file from disk (catch errors silently)
    if (exportRecord.file_path) {
      try {
        fs.unlinkSync(exportRecord.file_path);
      } catch (err) {
        // File may already be deleted or inaccessible - continue silently
      }
    }

    await exportRecord.destroy();

    return { id: exportRecord.id };
  }
};

module.exports = dataExportService;
