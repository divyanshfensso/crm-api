const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Document extends Model {
    static associate(models) {
      Document.belongsTo(models.User, { foreignKey: 'uploaded_by', as: 'uploader' });
      Document.belongsTo(models.Contact, { foreignKey: 'contact_id', as: 'contact' });
      Document.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
      Document.belongsTo(models.Deal, { foreignKey: 'deal_id', as: 'deal' });
    }
  }

  Document.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    file_name: { type: DataTypes.STRING(255), allowNull: false },
    original_name: { type: DataTypes.STRING(255), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: false },
    file_size: { type: DataTypes.INTEGER, allowNull: false },
    mime_type: { type: DataTypes.STRING(100), allowNull: false },
    description: { type: DataTypes.STRING(500), allowNull: true },
    folder: { type: DataTypes.STRING(100), allowNull: true, defaultValue: null },
    contact_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'contacts', key: 'id' } },
    company_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'companies', key: 'id' } },
    deal_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'deals', key: 'id' } },
    uploaded_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'Document', tableName: 'documents',
    timestamps: true, underscored: true, paranoid: true,
    indexes: [
      { fields: ['contact_id'] }, { fields: ['company_id'] },
      { fields: ['deal_id'] }, { fields: ['uploaded_by'] },
      { fields: ['created_at'] }, { fields: ['folder'] },
    ]
  });

  return Document;
};
