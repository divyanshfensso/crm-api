const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class QuoteItem extends Model {
    static associate(models) {
      QuoteItem.belongsTo(models.Quote, { foreignKey: 'quote_id', as: 'quote' });
    }
  }

  QuoteItem.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    quote_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'quotes', key: 'id' } },
    description: { type: DataTypes.STRING(500), allowNull: false },
    quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1 },
    unit_price: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    discount_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: true, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  }, {
    sequelize, modelName: 'QuoteItem', tableName: 'quote_items',
    timestamps: true, underscored: true,
    indexes: [{ fields: ['quote_id'] }]
  });

  return QuoteItem;
};
