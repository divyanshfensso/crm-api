module.exports = (sequelize, DataTypes) => {
  class KBCategory extends require('sequelize').Model {
    static associate(models) {
      KBCategory.belongsTo(models.KBCategory, {
        foreignKey: 'parent_id',
        as: 'parent',
        onDelete: 'SET NULL',
      });
      KBCategory.hasMany(models.KBCategory, {
        foreignKey: 'parent_id',
        as: 'children',
      });
      KBCategory.hasMany(models.KBArticle, {
        foreignKey: 'category_id',
        as: 'articles',
      });
    }
  }

  KBCategory.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'kb_categories', key: 'id' },
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    is_published: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  }, {
    sequelize,
    modelName: 'KBCategory',
    tableName: 'kb_categories',
    timestamps: true,
    underscored: true,
    paranoid: true,
    indexes: [
      { unique: true, fields: ['slug'] },
      { fields: ['parent_id'] },
    ],
  });

  return KBCategory;
};
