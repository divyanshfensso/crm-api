const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EmailTemplate extends Model {
    static associate(models) {
      EmailTemplate.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      EmailTemplate.hasMany(models.EmailLog, { foreignKey: 'template_id', as: 'logs' });
    }
  }

  EmailTemplate.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(200), allowNull: false, validate: { notEmpty: { msg: 'Template name is required' } } },
    subject: { type: DataTypes.STRING(500), allowNull: false, validate: { notEmpty: { msg: 'Subject is required' } } },
    body_html: { type: DataTypes.TEXT('long'), allowNull: false },
    module: { type: DataTypes.STRING(50), allowNull: true },
    variables: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  }, {
    sequelize, modelName: 'EmailTemplate', tableName: 'email_templates',
    timestamps: true, underscored: true, paranoid: true,
    indexes: [
      { fields: ['module'] }, { fields: ['is_active'] },
      { fields: ['created_at'] },
    ]
  });

  return EmailTemplate;
};
