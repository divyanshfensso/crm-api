module.exports = (sequelize, DataTypes) => {
  class KBArticle extends require('sequelize').Model {
    static associate(models) {
      KBArticle.belongsTo(models.KBCategory, { foreignKey: 'category_id', as: 'category', onDelete: 'SET NULL' });
      KBArticle.belongsTo(models.User, { foreignKey: 'author_id', as: 'author', onDelete: 'NO ACTION' });
      KBArticle.hasMany(models.ArticleFeedback, { foreignKey: 'article_id', as: 'feedbacks' });
    }
  }

  KBArticle.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    category_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'kb_categories', key: 'id' } },
    title: { type: DataTypes.STRING(500), allowNull: false, validate: { notEmpty: { msg: 'Title is required' } } },
    slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
    content: { type: DataTypes.TEXT('long'), allowNull: true },
    excerpt: { type: DataTypes.TEXT, allowNull: true },
    tags: { type: DataTypes.JSON, allowNull: true },
    status: { type: DataTypes.ENUM('draft', 'published', 'archived'), allowNull: false, defaultValue: 'draft' },
    view_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    author_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
    published_at: { type: DataTypes.DATE, allowNull: true },
    is_public: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    share_token: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  }, {
    sequelize, modelName: 'KBArticle', tableName: 'kb_articles',
    timestamps: true, underscored: true, paranoid: true,
    indexes: [
      { fields: ['slug'], unique: true },
      { fields: ['category_id'] },
      { fields: ['author_id'] },
      { fields: ['status'] },
    ]
  });

  return KBArticle;
};
