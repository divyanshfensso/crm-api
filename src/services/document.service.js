const { Op } = require('sequelize');
const fs = require('fs');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { sanitizeFKFields } = require('../utils/helpers');

const documentService = {
  /**
   * Get all documents with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated documents list
   */
  getAll: async (query) => {
    const { Document, User, Contact, Company, Deal } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, contact_id, company_id, deal_id, mime_type, folder } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['original_name', 'description']);
      Object.assign(where, searchCondition);
    }

    // Filter by contact
    if (contact_id) {
      where.contact_id = contact_id;
    }

    // Filter by company
    if (company_id) {
      where.company_id = company_id;
    }

    // Filter by deal
    if (deal_id) {
      where.deal_id = deal_id;
    }

    // Filter by mime type
    if (mime_type) {
      where.mime_type = mime_type;
    }

    // Filter by folder
    if (folder) {
      if (folder === '__unfiled__') {
        where.folder = { [Op.is]: null };
      } else {
        where.folder = folder;
      }
    }

    const { count, rows } = await Document.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
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
   * Get document by ID with full details
   * @param {number} id - Document ID
   * @returns {Promise<Object>} Document with relations
   */
  getById: async (id) => {
    const { Document, User, Contact, Company, Deal } = require('../models');

    const document = await Document.findByPk(id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
        }
      ]
    });

    if (!document) {
      throw ApiError.notFound('Document not found');
    }

    return document;
  },

  /**
   * Create a new document record
   * @param {Object} fileData - File data from multer (filename, originalname, path, size, mimetype)
   * @param {Object} metadata - Additional metadata (contact_id, company_id, deal_id, description)
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created document
   */
  create: async (fileData, metadata, userId) => {
    const { Document } = require('../models');

    const cleanMeta = sanitizeFKFields(metadata, ['contact_id', 'company_id', 'deal_id']);
    const documentData = {
      file_name: fileData.filename,
      original_name: fileData.originalname,
      file_path: fileData.path,
      file_size: fileData.size,
      mime_type: fileData.mimetype,
      description: cleanMeta.description || null,
      folder: metadata.folder || null,
      contact_id: cleanMeta.contact_id,
      company_id: cleanMeta.company_id,
      deal_id: cleanMeta.deal_id,
      uploaded_by: userId
    };

    const document = await Document.create(documentData);

    // Fetch the created document with relations
    return await documentService.getById(document.id);
  },

  /**
   * Soft delete a document and remove file from disk
   * @param {number} id - Document ID
   * @returns {Promise<Object>} Deleted document info
   */
  delete: async (id) => {
    const { Document } = require('../models');

    const document = await Document.findByPk(id);

    if (!document) {
      throw ApiError.notFound('Document not found');
    }

    // Remove file from disk (catch errors silently)
    try {
      fs.unlinkSync(document.file_path);
    } catch (err) {
      // File may already be deleted or inaccessible - continue silently
    }

    await document.destroy();

    return { id: document.id };
  },

  /**
   * Get documents by entity type and entity ID
   * @param {string} entityType - Entity type (contact, company, deal)
   * @param {number} entityId - Entity ID
   * @returns {Promise<Array>} Documents for the entity
   */
  getByEntity: async (entityType, entityId) => {
    const { Document, User, Contact, Company, Deal } = require('../models');

    const fieldMap = {
      contact: 'contact_id',
      company: 'company_id',
      deal: 'deal_id'
    };

    const field = fieldMap[entityType];
    if (!field) {
      throw ApiError.badRequest('Invalid entity type. Must be contact, company, or deal');
    }

    const documents = await Document.findAll({
      where: { [field]: entityId },
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return documents;
  },

  /**
   * Get distinct folder names
   * @returns {Promise<Array<string>>} Folder names
   */
  getFolders: async () => {
    const { Document, sequelize } = require('../models');

    const results = await Document.findAll({
      attributes: [
        [sequelize.fn('DISTINCT', sequelize.col('folder')), 'folder'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      ],
      where: {
        folder: { [Op.not]: null },
      },
      group: ['folder'],
      order: [['folder', 'ASC']],
      raw: true,
    });

    return results.map((r) => ({ name: r.folder, count: parseInt(r.count) }));
  },

  /**
   * Update a document's folder
   * @param {number} id - Document ID
   * @param {string|null} folder - Folder name (null to unfile)
   * @returns {Promise<Object>} Updated document
   */
  updateFolder: async (id, folder) => {
    const { Document } = require('../models');

    const document = await Document.findByPk(id);
    if (!document) {
      throw ApiError.notFound('Document not found');
    }

    await document.update({ folder: folder || null });
    return documentService.getById(id);
  },
};

module.exports = documentService;
