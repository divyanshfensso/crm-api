const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Invoice extends Model {
    static associate(models) {
      Invoice.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      Invoice.belongsTo(models.Quote, { foreignKey: 'quote_id', as: 'quote' });
      Invoice.belongsTo(models.Contact, { foreignKey: 'contact_id', as: 'contact' });
      Invoice.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
      Invoice.belongsTo(models.Deal, { foreignKey: 'deal_id', as: 'deal' });
      Invoice.hasMany(models.InvoiceItem, { foreignKey: 'invoice_id', as: 'items' });
      Invoice.hasMany(models.Payment, { foreignKey: 'invoice_id', as: 'payments' });
    }
  }

  Invoice.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    invoice_number: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    quote_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'quotes', key: 'id' } },
    contact_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'contacts', key: 'id' } },
    company_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'companies', key: 'id' } },
    deal_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'deals', key: 'id' } },
    status: { type: DataTypes.ENUM('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'), allowNull: false, defaultValue: 'draft' },
    subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    tax_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: true, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: true, defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: true, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    amount_paid: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    amount_due: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
    issue_date: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'Invoice', tableName: 'invoices',
    timestamps: true, underscored: true, paranoid: true,
    indexes: [
      { fields: ['invoice_number'], unique: true },
      { fields: ['quote_id'] }, { fields: ['contact_id'] },
      { fields: ['company_id'] }, { fields: ['deal_id'] },
      { fields: ['status'] }, { fields: ['due_date'] },
      { fields: ['created_at'] },
    ]
  });

  return Invoice;
};
