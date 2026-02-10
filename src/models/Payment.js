const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Payment extends Model {
    static associate(models) {
      Payment.belongsTo(models.Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
      Payment.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    }
  }

  Payment.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    invoice_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'invoices', key: 'id' } },
    amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
    payment_date: { type: DataTypes.DATEONLY, allowNull: false },
    payment_method: { type: DataTypes.ENUM('cash', 'bank_transfer', 'credit_card', 'check', 'other'), allowNull: false },
    reference_number: { type: DataTypes.STRING(100), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'Payment', tableName: 'payments',
    timestamps: true, underscored: true,
    indexes: [
      { fields: ['invoice_id'] }, { fields: ['payment_date'] },
      { fields: ['payment_method'] }, { fields: ['created_at'] },
    ]
  });

  return Payment;
};
