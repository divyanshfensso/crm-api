const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class InvoiceItem extends Model {
    static associate(models) {
      InvoiceItem.belongsTo(models.Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
    }
  }

  InvoiceItem.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    invoice_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'invoices', key: 'id' } },
    description: { type: DataTypes.STRING(500), allowNull: false },
    quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1 },
    unit_price: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    discount_percent: { type: DataTypes.DECIMAL(5, 2), allowNull: true, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  }, {
    sequelize, modelName: 'InvoiceItem', tableName: 'invoice_items',
    timestamps: true, underscored: true,
    indexes: [{ fields: ['invoice_id'] }]
  });

  return InvoiceItem;
};
