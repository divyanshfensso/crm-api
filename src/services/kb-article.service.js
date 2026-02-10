const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');

const kbArticleService = {
  /**
   * Get all articles with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated articles list
   */
  getAll: async (query) => {
    const { KBArticle, KBCategory, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, category_id, status, tags } = query;
    const order = getSorting(query, 'created_at', 'DESC');

    const where = {};

    // Search on title, content, excerpt
    if (search) {
      const searchCondition = buildSearchCondition(search, ['title', 'content', 'excerpt']);
      Object.assign(where, searchCondition);
    }

    // Filter by category_id
    if (category_id) {
      where.category_id = category_id;
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by tags (JSON field)
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : tags.split(',').map((t) => t.trim());
      where.tags = {
        [Op.or]: tagList.map((tag) => ({
          [Op.like]: `%${tag}%`,
        })),
      };
    }

    const { count, rows } = await KBArticle.findAndCountAll({
      where,
      include: [
        {
          model: KBCategory,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: User,
          as: 'author',
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
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  },

  /**
   * Get article by ID with category, author, feedbacks. Increment view_count.
   * @param {number} id - Article ID
   * @returns {Promise<Object>} Article with relations
   */
  getById: async (id) => {
    const { KBArticle, KBCategory, User, ArticleFeedback } = require('../models');

    const article = await KBArticle.findByPk(id, {
      include: [
        {
          model: KBCategory,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: User,
          as: 'author',
          attributes: ['id', 'first_name', 'last_name'],
        },
        {
          model: ArticleFeedback,
          as: 'feedbacks',
        },
      ],
    });

    if (!article) {
      throw ApiError.notFound('Article not found');
    }

    // Increment view_count
    await article.increment('view_count');

    return article;
  },

  /**
   * Create a new article
   * @param {Object} data - Article data
   * @param {number} userId - Current user ID (author)
   * @returns {Promise<Object>} Created article
   */
  create: async (data, userId) => {
    const { KBArticle } = require('../models');

    // Set author_id
    data.author_id = userId;

    // Auto-generate slug from title if not provided
    if (!data.slug) {
      data.slug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Check slug uniqueness, append number if duplicate
    let slug = data.slug;
    let suffix = 1;
    while (await KBArticle.findOne({ where: { slug } })) {
      slug = `${data.slug}-${suffix}`;
      suffix++;
    }
    data.slug = slug;

    // If status is 'published', set published_at
    if (data.status === 'published') {
      data.published_at = new Date();
    }

    const article = await KBArticle.create(data);

    return await kbArticleService.getById(article.id);
  },

  /**
   * Update an existing article
   * @param {number} id - Article ID
   * @param {Object} data - Updated article data
   * @returns {Promise<Object>} Updated article
   */
  update: async (id, data) => {
    const { KBArticle } = require('../models');

    const article = await KBArticle.findByPk(id);

    if (!article) {
      throw ApiError.notFound('Article not found');
    }

    // If slug is being changed, check uniqueness
    if (data.slug && data.slug !== article.slug) {
      let slug = data.slug;
      let suffix = 1;
      while (await KBArticle.findOne({ where: { slug, id: { [Op.ne]: id } } })) {
        slug = `${data.slug}-${suffix}`;
        suffix++;
      }
      data.slug = slug;
    }

    // If status changes to 'published' and published_at is null, set published_at
    if (data.status === 'published' && !article.published_at) {
      data.published_at = new Date();
    }

    await article.update(data);

    return await kbArticleService.getById(id);
  },

  /**
   * Soft delete an article
   * @param {number} id - Article ID
   * @returns {Promise<Object>} Deleted article info
   */
  delete: async (id) => {
    const { KBArticle } = require('../models');

    const article = await KBArticle.findByPk(id);

    if (!article) {
      throw ApiError.notFound('Article not found');
    }

    await article.destroy();

    return { id: article.id };
  },

  /**
   * Publish an article
   * @param {number} id - Article ID
   * @returns {Promise<Object>} Published article
   */
  publish: async (id) => {
    const { KBArticle } = require('../models');

    const article = await KBArticle.findByPk(id);

    if (!article) {
      throw ApiError.notFound('Article not found');
    }

    await article.update({
      status: 'published',
      published_at: new Date(),
    });

    return await kbArticleService.getById(id);
  },

  /**
   * Add feedback to an article
   * @param {number} articleId - Article ID
   * @param {Object} data - Feedback data (is_helpful, comment)
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created feedback
   */
  addFeedback: async (articleId, data, userId) => {
    const { KBArticle, ArticleFeedback } = require('../models');

    const article = await KBArticle.findByPk(articleId);

    if (!article) {
      throw ApiError.notFound('Article not found');
    }

    const feedback = await ArticleFeedback.create({
      article_id: articleId,
      user_id: userId,
      is_helpful: data.is_helpful,
      comment: data.comment || null,
    });

    return feedback;
  },

  /**
   * Search published articles
   * @param {Object} query - Search query parameters
   * @returns {Promise<Object>} Paginated search results
   */
  search: async (query) => {
    const { KBArticle, KBCategory, User } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { q } = query;

    const where = {
      status: 'published',
    };

    if (q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${q}%` } },
        { content: { [Op.like]: `%${q}%` } },
      ];
    }

    const { count, rows } = await KBArticle.findAndCountAll({
      where,
      include: [
        {
          model: KBCategory,
          as: 'category',
          attributes: ['id', 'name', 'slug'],
        },
        {
          model: User,
          as: 'author',
          attributes: ['id', 'first_name', 'last_name'],
        },
      ],
      order: [['published_at', 'DESC']],
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
  },
};

module.exports = kbArticleService;
