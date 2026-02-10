const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { sanitizeFKFields } = require('../utils/helpers');

const KB_CATEGORY_FK_FIELDS = ['parent_id'];

const kbCategoryService = {
  /**
   * Get all categories as tree or flat paginated list
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Categories tree or paginated list
   */
  getAll: async (query) => {
    const { KBCategory, KBArticle } = require('../models');
    const { flat, search } = query;

    // Flat paginated list
    if (flat === 'true' || flat === true) {
      const { page, limit, offset } = getPagination(query);
      const order = getSorting(query, 'position', 'ASC');

      const where = {};

      if (search) {
        const searchCondition = buildSearchCondition(search, ['name', 'description']);
        Object.assign(where, searchCondition);
      }

      const { count, rows } = await KBCategory.findAndCountAll({
        where,
        include: [
          {
            model: KBCategory,
            as: 'children',
            attributes: ['id', 'name', 'slug'],
          },
        ],
        order,
        limit,
        offset,
        distinct: true,
      });

      return {
        data: rows,
        meta: {
          page,
          limit,
          total: count,
          totalPages: Math.ceil(count / limit),
        },
      };
    }

    // Tree structure: fetch all categories with children and article counts
    const categories = await KBCategory.findAll({
      where: { parent_id: null },
      include: [
        {
          model: KBCategory,
          as: 'children',
          include: [
            {
              model: KBArticle,
              as: 'articles',
              attributes: [],
            },
          ],
        },
        {
          model: KBArticle,
          as: 'articles',
          attributes: [],
        },
      ],
      order: [
        ['position', 'ASC'],
        [{ model: KBCategory, as: 'children' }, 'position', 'ASC'],
      ],
    });

    // Add article counts
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const articleCount = await KBArticle.count({ where: { category_id: cat.id } });
        const catJson = cat.toJSON();
        catJson.article_count = articleCount;

        if (catJson.children) {
          catJson.children = await Promise.all(
            catJson.children.map(async (child) => {
              const childArticleCount = await KBArticle.count({ where: { category_id: child.id } });
              child.article_count = childArticleCount;
              return child;
            })
          );
        }

        return catJson;
      })
    );

    return { data: categoriesWithCounts };
  },

  /**
   * Get category by ID with children and articles
   * @param {number} id - Category ID
   * @returns {Promise<Object>} Category with relations
   */
  getById: async (id) => {
    const { KBCategory, KBArticle, User } = require('../models');

    const category = await KBCategory.findByPk(id, {
      include: [
        {
          model: KBCategory,
          as: 'children',
          order: [['position', 'ASC']],
        },
        {
          model: KBArticle,
          as: 'articles',
          include: [
            {
              model: User,
              as: 'author',
              attributes: ['id', 'first_name', 'last_name'],
            },
          ],
          limit: 50,
          order: [['created_at', 'DESC']],
        },
      ],
    });

    if (!category) {
      throw ApiError.notFound('Category not found');
    }

    return category;
  },

  /**
   * Create a new category
   * @param {Object} data - Category data
   * @returns {Promise<Object>} Created category
   */
  create: async (data) => {
    const { KBCategory } = require('../models');

    const cleanData = sanitizeFKFields(data, KB_CATEGORY_FK_FIELDS);

    // Auto-generate slug from name if not provided
    if (!cleanData.slug) {
      cleanData.slug = cleanData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Check slug uniqueness, append number if duplicate
    let slug = cleanData.slug;
    let suffix = 1;
    while (await KBCategory.findOne({ where: { slug } })) {
      slug = `${cleanData.slug}-${suffix}`;
      suffix++;
    }
    cleanData.slug = slug;

    const category = await KBCategory.create(cleanData);

    return await kbCategoryService.getById(category.id);
  },

  /**
   * Update an existing category
   * @param {number} id - Category ID
   * @param {Object} data - Updated category data
   * @returns {Promise<Object>} Updated category
   */
  update: async (id, data) => {
    const { KBCategory } = require('../models');

    const category = await KBCategory.findByPk(id);

    if (!category) {
      throw ApiError.notFound('Category not found');
    }

    const cleanData = sanitizeFKFields(data, KB_CATEGORY_FK_FIELDS);

    // If slug is being changed, check uniqueness
    if (cleanData.slug && cleanData.slug !== category.slug) {
      let slug = cleanData.slug;
      let suffix = 1;
      while (await KBCategory.findOne({ where: { slug, id: { [Op.ne]: id } } })) {
        slug = `${cleanData.slug}-${suffix}`;
        suffix++;
      }
      cleanData.slug = slug;
    }

    await category.update(cleanData);

    return await kbCategoryService.getById(id);
  },

  /**
   * Soft delete a category
   * @param {number} id - Category ID
   * @returns {Promise<Object>} Deleted category info
   */
  delete: async (id) => {
    const { KBCategory } = require('../models');

    const category = await KBCategory.findByPk(id);

    if (!category) {
      throw ApiError.notFound('Category not found');
    }

    // Nullify child categories' parent_id
    await KBCategory.update(
      { parent_id: null },
      { where: { parent_id: id } }
    );

    await category.destroy();

    return { id: category.id };
  },

  /**
   * Reorder a category by updating its position
   * @param {number} id - Category ID
   * @param {number} position - New position value
   * @returns {Promise<Object>} Updated category
   */
  reorder: async (id, position) => {
    const { KBCategory } = require('../models');

    const category = await KBCategory.findByPk(id);

    if (!category) {
      throw ApiError.notFound('Category not found');
    }

    await category.update({ position });

    return await kbCategoryService.getById(id);
  },
};

module.exports = kbCategoryService;
