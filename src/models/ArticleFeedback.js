module.exports = (sequelize, DataTypes) => {
  class ArticleFeedback extends require('sequelize').Model {
    static associate(models) {
      ArticleFeedback.belongsTo(models.KBArticle, { foreignKey: 'article_id', as: 'article', onDelete: 'CASCADE' });
      ArticleFeedback.belongsTo(models.User, { foreignKey: 'user_id', as: 'user', onDelete: 'SET NULL' });
    }
  }

  ArticleFeedback.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    article_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'kb_articles', key: 'id' } },
    user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
    is_helpful: { type: DataTypes.BOOLEAN, allowNull: true },
    comment: { type: DataTypes.TEXT, allowNull: true },
  }, {
    sequelize, modelName: 'ArticleFeedback', tableName: 'article_feedbacks',
    timestamps: true, underscored: true, updatedAt: false,
    indexes: [
      { fields: ['article_id'] },
      { fields: ['user_id'] },
    ]
  });

  return ArticleFeedback;
};
