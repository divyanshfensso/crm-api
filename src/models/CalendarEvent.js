const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CalendarEvent extends Model {
    static associate(models) {
      CalendarEvent.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      CalendarEvent.belongsTo(models.Contact, { foreignKey: 'contact_id', as: 'contact' });
      CalendarEvent.belongsTo(models.Company, { foreignKey: 'company_id', as: 'company' });
      CalendarEvent.belongsTo(models.Deal, { foreignKey: 'deal_id', as: 'deal' });
    }
  }

  CalendarEvent.init({
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(255), allowNull: false, validate: { notEmpty: { msg: 'Event title is required' } } },
    description: { type: DataTypes.TEXT, allowNull: true },
    start_time: { type: DataTypes.DATE, allowNull: false },
    end_time: { type: DataTypes.DATE, allowNull: false },
    all_day: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    location: { type: DataTypes.STRING(255), allowNull: true },
    attendees: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
    contact_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'contacts', key: 'id' } },
    company_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'companies', key: 'id' } },
    deal_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'deals', key: 'id' } },
    created_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
    google_event_id: { type: DataTypes.STRING(255), allowNull: true },
    google_meet_link: { type: DataTypes.STRING(500), allowNull: true },
    sync_to_google: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    outlook_event_id: { type: DataTypes.STRING(255), allowNull: true },
    teams_meeting_link: { type: DataTypes.STRING(500), allowNull: true },
    sync_to_outlook: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  }, {
    sequelize, modelName: 'CalendarEvent', tableName: 'calendar_events',
    timestamps: true, underscored: true, paranoid: true,
    indexes: [
      { fields: ['start_time'] }, { fields: ['end_time'] },
      { fields: ['contact_id'] }, { fields: ['company_id'] },
      { fields: ['deal_id'] }, { fields: ['created_by'] },
      { fields: ['google_event_id'] },
      { fields: ['outlook_event_id'] },
    ]
  });

  return CalendarEvent;
};
