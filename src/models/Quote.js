const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Quote extends Model {
    static associate(models) {
      Quote.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      Quote.belongsTo(models.Contact, { foreignKey: 'contact_id', as: 'contact' });
      Quote.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
      Quote.belongsTo(models.Deal, { foreignKey: 'deal_id', as: 'deal' });
      Quote.hasMany(models.QuoteItem, { foreignKey: 'quote_id', as: 'items' });
      Quote.hasOne(models.Invoice, { foreignKey: 'quote_id', as: 'invoice' });
    }
  }

  Quote.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    quote_number: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    contact_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'contacts', key: 'id' } },
    company_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'companies', key: 'id' } },
    deal_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'deals', key: 'id' } },
    status: { type: DataTypes.ENUM('draft', 'sent', 'accepted', 'rejected', 'expired'), allowNull: false, defaultValue: 'draft' },
    subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    tax_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: true, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: true, defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: true, defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
    valid_until: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'Quote', tableName: 'quotes',
    timestamps: true, underscored: true, paranoid: true,
    indexes: [
      { fields: ['quote_number'], unique: true },
      { fields: ['contact_id'] }, { fields: ['company_id'] },
      { fields: ['deal_id'] }, { fields: ['status'] },
      { fields: ['created_at'] },
    ]
  });

  return Quote;
};
