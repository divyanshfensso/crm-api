const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Import database configuration
const dbConfig = require('../config/database');

// Get the sequelize instance from the config
const { sequelize } = dbConfig;

// Initialize models object
const db = {};

// Import all model definitions
const User = require('./User')(sequelize, DataTypes);
const Role = require('./Role')(sequelize, DataTypes);
const Permission = require('./Permission')(sequelize, DataTypes);
const UserRole = require('./UserRole')(sequelize, DataTypes);
const RolePermission = require('./RolePermission')(sequelize, DataTypes);
const AuditLog = require('./AuditLog')(sequelize, DataTypes);
const GdprConsent = require('./GdprConsent')(sequelize, DataTypes);
const Setting = require('./Setting')(sequelize, DataTypes);

// Phase 2 models
const Contact = require('./Contact')(sequelize, DataTypes);
const Company = require('./Company')(sequelize, DataTypes);
const Lead = require('./Lead')(sequelize, DataTypes);
const Pipeline = require('./Pipeline')(sequelize, DataTypes);
const PipelineStage = require('./PipelineStage')(sequelize, DataTypes);
const Deal = require('./Deal')(sequelize, DataTypes);
const Activity = require('./Activity')(sequelize, DataTypes);
const Tag = require('./Tag')(sequelize, DataTypes);

// Phase 3 models
const Task = require('./Task')(sequelize, DataTypes);
const Document = require('./Document')(sequelize, DataTypes);
const EmailTemplate = require('./EmailTemplate')(sequelize, DataTypes);
const EmailLog = require('./EmailLog')(sequelize, DataTypes);
const Quote = require('./Quote')(sequelize, DataTypes);
const QuoteItem = require('./QuoteItem')(sequelize, DataTypes);
const Invoice = require('./Invoice')(sequelize, DataTypes);
const InvoiceItem = require('./InvoiceItem')(sequelize, DataTypes);
const Payment = require('./Payment')(sequelize, DataTypes);
const CalendarEvent = require('./CalendarEvent')(sequelize, DataTypes);

// Phase 4 models
const Report = require('./Report')(sequelize, DataTypes);
const DataExport = require('./DataExport')(sequelize, DataTypes);
const ImportJob = require('./ImportJob')(sequelize, DataTypes);
const EmailCampaign = require('./EmailCampaign')(sequelize, DataTypes);
const EmailCampaignRecipient = require('./EmailCampaignRecipient')(sequelize, DataTypes);
const ApiKey = require('./ApiKey')(sequelize, DataTypes);
const ApiLog = require('./ApiLog')(sequelize, DataTypes);
const Webhook = require('./Webhook')(sequelize, DataTypes);
const WebhookDelivery = require('./WebhookDelivery')(sequelize, DataTypes);
const KBCategory = require('./KBCategory')(sequelize, DataTypes);
const KBArticle = require('./KBArticle')(sequelize, DataTypes);
const ArticleFeedback = require('./ArticleFeedback')(sequelize, DataTypes);
const Workflow = require('./Workflow')(sequelize, DataTypes);
const WorkflowStep = require('./WorkflowStep')(sequelize, DataTypes);
const WorkflowLog = require('./WorkflowLog')(sequelize, DataTypes);

// Phase 5 models (Integrations)
const UserIntegration = require('./UserIntegration')(sequelize, DataTypes);

// Phase 6 models
const Notification = require('./Notification')(sequelize, DataTypes);

// Add models to db object
db.User = User;
db.Role = Role;
db.Permission = Permission;
db.UserRole = UserRole;
db.RolePermission = RolePermission;
db.AuditLog = AuditLog;
db.GdprConsent = GdprConsent;
db.Setting = Setting;
db.Contact = Contact;
db.Company = Company;
db.Lead = Lead;
db.Pipeline = Pipeline;
db.PipelineStage = PipelineStage;
db.Deal = Deal;
db.Activity = Activity;
db.Tag = Tag;
db.Task = Task;
db.Document = Document;
db.EmailTemplate = EmailTemplate;
db.EmailLog = EmailLog;
db.Quote = Quote;
db.QuoteItem = QuoteItem;
db.Invoice = Invoice;
db.InvoiceItem = InvoiceItem;
db.Payment = Payment;
db.CalendarEvent = CalendarEvent;
db.Report = Report;
db.DataExport = DataExport;
db.ImportJob = ImportJob;
db.EmailCampaign = EmailCampaign;
db.EmailCampaignRecipient = EmailCampaignRecipient;
db.ApiKey = ApiKey;
db.ApiLog = ApiLog;
db.Webhook = Webhook;
db.WebhookDelivery = WebhookDelivery;
db.KBCategory = KBCategory;
db.KBArticle = KBArticle;
db.ArticleFeedback = ArticleFeedback;
db.Workflow = Workflow;
db.WorkflowStep = WorkflowStep;
db.WorkflowLog = WorkflowLog;
db.UserIntegration = UserIntegration;
db.Notification = Notification;

// Setup associations
// Call associate method on each model if it exists
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Add sequelize instance and Sequelize constructor to exports
db.sequelize = sequelize;
db.Sequelize = Sequelize;

/**
 * Sync all models with database
 * @param {Object} options - Sequelize sync options
 * @returns {Promise}
 */
db.syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('All models were synchronized successfully.');
    return true;
  } catch (error) {
    console.error('Error synchronizing models:', error);
    throw error;
  }
};

/**
 * Close database connection
 * @returns {Promise}
 */
db.closeConnection = async () => {
  try {
    await sequelize.close();
    console.log('Database connection closed successfully.');
    return true;
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw error;
  }
};

/**
 * Test database connection
 * @returns {Promise<boolean>}
 */
db.testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};

/**
 * Drop all tables (use with caution!)
 * @returns {Promise}
 */
db.dropAllTables = async () => {
  try {
    await sequelize.drop();
    console.log('All tables dropped successfully.');
    return true;
  } catch (error) {
    console.error('Error dropping tables:', error);
    throw error;
  }
};

/**
 * Get model by name
 * @param {string} modelName - Name of the model
 * @returns {Model|null}
 */
db.getModel = (modelName) => {
  return db[modelName] || null;
};

/**
 * Execute raw query
 * @param {string} sql - SQL query
 * @param {Object} options - Query options
 * @returns {Promise}
 */
db.query = async (sql, options = {}) => {
  try {
    const results = await sequelize.query(sql, options);
    return results;
  } catch (error) {
    console.error('Error executing query:', error);
    throw error;
  }
};

/**
 * Start a transaction
 * @param {Object} options - Transaction options
 * @returns {Promise<Transaction>}
 */
db.transaction = async (options = {}) => {
  return sequelize.transaction(options);
};

module.exports = db;
