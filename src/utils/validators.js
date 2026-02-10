const Joi = require('joi');

/**
 * User Registration Schema
 */
const registerSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .trim()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required'
    }),
  firstName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .trim()
    .messages({
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters',
      'any.required': 'First name is required'
    }),
  lastName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .trim()
    .messages({
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters',
      'any.required': 'Last name is required'
    }),
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .allow('', null)
    .messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
  roleId: Joi.number()
    .integer()
    .positive()
    .optional()
});

/**
 * User Login Schema
 */
const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .trim()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Password is required'
    })
});

/**
 * Update User Schema
 */
const updateUserSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .optional()
    .messages({
      'string.min': 'First name must be at least 2 characters long',
      'string.max': 'First name cannot exceed 50 characters'
    }),
  lastName: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .optional()
    .messages({
      'string.min': 'Last name must be at least 2 characters long',
      'string.max': 'Last name cannot exceed 50 characters'
    }),
  phone: Joi.string()
    .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .allow('', null)
    .optional()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number'
    }),
  profileImage: Joi.string()
    .uri()
    .allow('', null)
    .optional(),
  isActive: Joi.boolean()
    .optional(),
  roleId: Joi.number()
    .integer()
    .positive()
    .optional()
}).min(1);

/**
 * Change Password Schema
 */
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      'any.required': 'Current password is required'
    }),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .invalid(Joi.ref('currentPassword'))
    .messages({
      'string.min': 'New password must be at least 8 characters long',
      'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'New password is required',
      'any.invalid': 'New password must be different from current password'
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Password confirmation is required'
    })
});

/**
 * Create Role Schema
 */
const createRoleSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .required()
    .trim()
    .messages({
      'string.min': 'Role name must be at least 2 characters long',
      'string.max': 'Role name cannot exceed 50 characters',
      'any.required': 'Role name is required'
    }),
  description: Joi.string()
    .max(255)
    .allow('', null)
    .optional()
    .trim()
    .messages({
      'string.max': 'Description cannot exceed 255 characters'
    }),
  permissions: Joi.array()
    .items(Joi.string())
    .optional()
    .default([])
});

/**
 * Update Role Schema
 */
const updateRoleSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .optional()
    .messages({
      'string.min': 'Role name must be at least 2 characters long',
      'string.max': 'Role name cannot exceed 50 characters'
    }),
  description: Joi.string()
    .max(255)
    .allow('', null)
    .optional()
    .trim()
    .messages({
      'string.max': 'Description cannot exceed 255 characters'
    }),
  permissions: Joi.array()
    .items(Joi.string())
    .optional()
}).min(1);

/**
 * ID Parameter Schema
 */
const idParamSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.base': 'ID must be a number',
      'number.integer': 'ID must be an integer',
      'number.positive': 'ID must be positive',
      'any.required': 'ID is required'
    })
});

/**
 * Pagination Query Schema
 */
const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  search: Joi.string()
    .allow('', null)
    .optional()
    .trim(),
  sortBy: Joi.string()
    .optional()
    .trim()
    .default('createdAt'),
  sortOrder: Joi.string()
    .valid('ASC', 'DESC', 'asc', 'desc')
    .optional()
    .default('DESC')
    .messages({
      'any.only': 'Sort order must be either ASC or DESC'
    })
});

/**
 * Email Schema
 */
const emailSchema = Joi.object({
  email: Joi.string()
    .email()
    .required()
    .lowercase()
    .trim()
    .messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    })
});

/**
 * Reset Password Schema
 */
const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Reset token is required'
    }),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required'
    }),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Passwords do not match',
      'any.required': 'Password confirmation is required'
    })
});

/**
 * Contact Schemas
 */
const createContactSchema = Joi.object({
  first_name: Joi.string().min(1).max(100).required().trim(),
  last_name: Joi.string().min(1).max(100).required().trim(),
  email: Joi.string().email().allow('', null).optional().trim(),
  phone: Joi.string().max(20).allow('', null).optional(),
  mobile: Joi.string().max(20).allow('', null).optional(),
  company_id: Joi.number().integer().positive().allow(null).optional(),
  job_title: Joi.string().max(100).allow('', null).optional().trim(),
  department: Joi.string().max(100).allow('', null).optional().trim(),
  lead_source: Joi.string().max(50).allow('', null).optional(),
  status: Joi.string().valid('active', 'inactive', 'prospect', 'customer', 'churned').optional(),
  address_line1: Joi.string().max(255).allow('', null).optional(),
  address_line2: Joi.string().max(255).allow('', null).optional(),
  city: Joi.string().max(100).allow('', null).optional(),
  state: Joi.string().max(100).allow('', null).optional(),
  country: Joi.string().max(100).allow('', null).optional(),
  zip_code: Joi.string().max(20).allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  owner_id: Joi.number().integer().positive().allow(null).optional(),
});

const updateContactSchema = createContactSchema.fork(
  ['first_name', 'last_name'],
  (schema) => schema.optional()
).min(1);

/**
 * Company Schemas
 */
const createCompanySchema = Joi.object({
  name: Joi.string().min(1).max(200).required().trim(),
  industry: Joi.string().max(100).allow('', null).optional(),
  website: Joi.string().max(255).allow('', null).optional(),
  phone: Joi.string().max(20).allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional().trim(),
  employee_count: Joi.number().integer().min(0).allow(null).optional(),
  annual_revenue: Joi.number().min(0).allow(null).optional(),
  address_line1: Joi.string().max(255).allow('', null).optional(),
  address_line2: Joi.string().max(255).allow('', null).optional(),
  city: Joi.string().max(100).allow('', null).optional(),
  state: Joi.string().max(100).allow('', null).optional(),
  country: Joi.string().max(100).allow('', null).optional(),
  zip_code: Joi.string().max(20).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  health_score: Joi.number().integer().min(0).max(100).allow(null).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  parent_company_id: Joi.number().integer().positive().allow(null).optional(),
  owner_id: Joi.number().integer().positive().allow(null).optional(),
});

const updateCompanySchema = createCompanySchema.fork(
  ['name'],
  (schema) => schema.optional()
).min(1);

/**
 * Lead Schemas
 */
const createLeadSchema = Joi.object({
  first_name: Joi.string().min(1).max(100).required().trim(),
  last_name: Joi.string().min(1).max(100).required().trim(),
  email: Joi.string().email().allow('', null).optional().trim(),
  phone: Joi.string().max(20).allow('', null).optional(),
  company_name: Joi.string().max(200).allow('', null).optional(),
  job_title: Joi.string().max(100).allow('', null).optional(),
  lead_source: Joi.string().max(50).allow('', null).optional(),
  status: Joi.string().valid('new', 'contacted', 'qualified', 'unqualified', 'converted', 'lost').optional(),
  score: Joi.number().integer().min(0).max(100).allow(null).optional(),
  notes: Joi.string().allow('', null).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  owner_id: Joi.number().integer().positive().allow(null).optional(),
});

const updateLeadSchema = createLeadSchema.fork(
  ['first_name', 'last_name'],
  (schema) => schema.optional()
).min(1);

const convertLeadSchema = Joi.object({
  dealTitle: Joi.string().max(200).allow('', null).optional(),
  dealValue: Joi.number().min(0).allow(null).optional(),
  pipelineId: Joi.number().integer().positive().allow(null).optional(),
});

/**
 * Deal Schemas
 */
const createDealSchema = Joi.object({
  title: Joi.string().min(1).max(200).required().trim(),
  contact_id: Joi.number().integer().positive().allow(null).optional(),
  company_id: Joi.number().integer().positive().allow(null).optional(),
  pipeline_id: Joi.number().integer().positive().allow(null).optional(),
  stage_id: Joi.number().integer().positive().allow(null).optional(),
  value: Joi.number().min(0).allow(null).optional(),
  currency: Joi.string().length(3).optional().default('USD'),
  probability: Joi.number().integer().min(0).max(100).allow(null).optional(),
  expected_close_date: Joi.date().allow(null).optional(),
  status: Joi.string().valid('open', 'won', 'lost').optional(),
  lost_reason: Joi.string().max(255).allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  owner_id: Joi.number().integer().positive().allow(null).optional(),
});

const updateDealSchema = createDealSchema.fork(
  ['title'],
  (schema) => schema.optional()
).min(1);

const updateDealStageSchema = Joi.object({
  stageId: Joi.number().integer().positive().required(),
});

/**
 * Activity Schemas
 */
const createActivitySchema = Joi.object({
  type: Joi.string().valid('note', 'call', 'email', 'meeting', 'task').required(),
  subject: Joi.string().min(1).max(255).required().trim(),
  description: Joi.string().allow('', null).optional(),
  contact_id: Joi.number().integer().positive().allow(null).optional(),
  company_id: Joi.number().integer().positive().allow(null).optional(),
  deal_id: Joi.number().integer().positive().allow(null).optional(),
  lead_id: Joi.number().integer().positive().allow(null).optional(),
  due_date: Joi.date().allow(null).optional(),
  completed: Joi.boolean().optional(),
});

const updateActivitySchema = createActivitySchema.fork(
  ['type', 'subject'],
  (schema) => schema.optional()
).min(1);

/**
 * Task Schemas
 */
const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(255).required().trim(),
  description: Joi.string().allow('', null).optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').optional(),
  due_date: Joi.date().allow(null).optional(),
  assigned_to: Joi.number().integer().positive().allow(null).optional(),
  contact_id: Joi.number().integer().positive().allow(null).optional(),
  company_id: Joi.number().integer().positive().allow(null).optional(),
  deal_id: Joi.number().integer().positive().allow(null).optional(),
});

const updateTaskSchema = createTaskSchema.fork(
  ['title'],
  (schema) => schema.optional()
).min(1);

/**
 * Document Schema
 */
const createDocumentSchema = Joi.object({
  contact_id: Joi.number().integer().positive().allow(null).optional(),
  company_id: Joi.number().integer().positive().allow(null).optional(),
  deal_id: Joi.number().integer().positive().allow(null).optional(),
  description: Joi.string().max(500).allow('', null).optional(),
});

/**
 * Email Template Schemas
 */
const createEmailTemplateSchema = Joi.object({
  name: Joi.string().min(1).max(200).required().trim(),
  subject: Joi.string().min(1).max(500).required().trim(),
  body_html: Joi.string().required(),
  module: Joi.string().max(50).allow('', null).optional(),
  variables: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('').optional(),
  })).optional(),
  is_active: Joi.boolean().optional(),
});

const updateEmailTemplateSchema = createEmailTemplateSchema.fork(
  ['name', 'subject', 'body_html'],
  (schema) => schema.optional()
).min(1);

/**
 * Quote Schemas
 */
const quoteItemSchema = Joi.object({
  id: Joi.number().integer().positive().optional(),
  description: Joi.string().min(1).max(500).required(),
  quantity: Joi.number().min(0.01).required(),
  unit_price: Joi.number().min(0).required(),
  discount_percent: Joi.number().min(0).max(100).allow(null).optional(),
});

const createQuoteSchema = Joi.object({
  contact_id: Joi.number().integer().positive().allow(null).optional(),
  company_id: Joi.number().integer().positive().allow(null).optional(),
  deal_id: Joi.number().integer().positive().allow(null).optional(),
  status: Joi.string().valid('draft', 'sent', 'accepted', 'rejected', 'expired').optional(),
  tax_rate: Joi.number().min(0).max(100).allow(null).optional(),
  discount_amount: Joi.number().min(0).allow(null).optional(),
  currency: Joi.string().length(3).optional(),
  valid_until: Joi.date().allow(null).optional(),
  notes: Joi.string().allow('', null).optional(),
  items: Joi.array().items(quoteItemSchema).min(1).required(),
});

const updateQuoteSchema = createQuoteSchema.fork(
  ['items'],
  (schema) => schema.optional()
).min(1);

/**
 * Invoice Schemas
 */
const invoiceItemSchema = Joi.object({
  id: Joi.number().integer().positive().optional(),
  description: Joi.string().min(1).max(500).required(),
  quantity: Joi.number().min(0.01).required(),
  unit_price: Joi.number().min(0).required(),
  discount_percent: Joi.number().min(0).max(100).allow(null).optional(),
});

const createInvoiceSchema = Joi.object({
  quote_id: Joi.number().integer().positive().allow(null).optional(),
  contact_id: Joi.number().integer().positive().allow(null).optional(),
  company_id: Joi.number().integer().positive().allow(null).optional(),
  deal_id: Joi.number().integer().positive().allow(null).optional(),
  status: Joi.string().valid('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled').optional(),
  tax_rate: Joi.number().min(0).max(100).allow(null).optional(),
  discount_amount: Joi.number().min(0).allow(null).optional(),
  currency: Joi.string().length(3).optional(),
  issue_date: Joi.date().optional(),
  due_date: Joi.date().allow(null).optional(),
  notes: Joi.string().allow('', null).optional(),
  items: Joi.array().items(invoiceItemSchema).min(1).required(),
});

const updateInvoiceSchema = createInvoiceSchema.fork(
  ['items'],
  (schema) => schema.optional()
).min(1);

/**
 * Payment Schemas
 */
const createPaymentSchema = Joi.object({
  invoice_id: Joi.number().integer().positive().required(),
  amount: Joi.number().min(0.01).required(),
  payment_date: Joi.date().required(),
  payment_method: Joi.string().valid('cash', 'bank_transfer', 'credit_card', 'check', 'other').required(),
  reference_number: Joi.string().max(100).allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
});

const updatePaymentSchema = createPaymentSchema.fork(
  ['invoice_id', 'amount', 'payment_date', 'payment_method'],
  (schema) => schema.optional()
).min(1);

/**
 * Calendar Event Schemas
 */
const createCalendarEventSchema = Joi.object({
  title: Joi.string().min(1).max(255).required().trim(),
  description: Joi.string().allow('', null).optional(),
  start_time: Joi.date().required(),
  end_time: Joi.date().required(),
  all_day: Joi.boolean().optional(),
  location: Joi.string().max(255).allow('', null).optional(),
  attendees: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().allow('').optional(),
  })).optional(),
  contact_id: Joi.number().integer().positive().allow(null).optional(),
  company_id: Joi.number().integer().positive().allow(null).optional(),
  deal_id: Joi.number().integer().positive().allow(null).optional(),
});

const updateCalendarEventSchema = createCalendarEventSchema.fork(
  ['title', 'start_time', 'end_time'],
  (schema) => schema.optional()
).min(1);

/**
 * Report Schemas (Phase 4)
 */
const createReportSchema = Joi.object({
  name: Joi.string().min(1).max(200).required().trim(),
  description: Joi.string().allow('', null).optional(),
  entity_type: Joi.string().valid('contacts', 'leads', 'deals', 'companies', 'activities', 'tasks', 'quotes', 'invoices', 'payments').required(),
  columns: Joi.array().items(Joi.string()).optional(),
  filters: Joi.object().optional(),
  grouping: Joi.object().optional(),
  sorting: Joi.object().optional(),
  chart_config: Joi.object().optional(),
  is_public: Joi.boolean().optional(),
});

const updateReportSchema = createReportSchema.fork(
  ['name', 'entity_type'],
  (schema) => schema.optional()
).min(1);

/**
 * Data Export Schema
 */
const createDataExportSchema = Joi.object({
  entity_types: Joi.array().items(Joi.string().valid('contacts', 'leads', 'deals', 'companies', 'activities', 'tasks', 'quotes', 'invoices')).min(1).required(),
  format: Joi.string().valid('csv', 'json').required(),
});

/**
 * Import Schemas
 */
const importMappingSchema = Joi.object({
  mapping: Joi.object().required(),
});

/**
 * Email Campaign Schemas
 */
const createEmailCampaignSchema = Joi.object({
  name: Joi.string().min(1).max(200).required().trim(),
  subject: Joi.string().min(1).max(500).required().trim(),
  template_id: Joi.number().integer().positive().allow(null).optional(),
  audience_filter: Joi.object().optional(),
  scheduled_at: Joi.date().allow(null).optional(),
  status: Joi.string().valid('draft', 'scheduled').optional(),
});

const updateEmailCampaignSchema = createEmailCampaignSchema.fork(
  ['name', 'subject'],
  (schema) => schema.optional()
).min(1);

/**
 * API Key Schemas
 */
const createApiKeySchema = Joi.object({
  name: Joi.string().min(1).max(200).required().trim(),
  scopes: Joi.array().items(Joi.string()).optional(),
  rate_limit: Joi.number().integer().min(1).max(100000).optional(),
  expires_at: Joi.date().allow(null).optional(),
});

/**
 * Webhook Schemas
 */
const createWebhookSchema = Joi.object({
  name: Joi.string().min(1).max(200).required().trim(),
  url: Joi.string().uri().max(500).required(),
  events: Joi.array().items(Joi.string()).min(1).required(),
  is_active: Joi.boolean().optional(),
});

const updateWebhookSchema = createWebhookSchema.fork(
  ['name', 'url', 'events'],
  (schema) => schema.optional()
).min(1);

/**
 * Knowledge Base Category Schemas
 */
const createKBCategorySchema = Joi.object({
  name: Joi.string().min(1).max(200).required().trim(),
  slug: Joi.string().max(255).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  parent_id: Joi.number().integer().positive().allow(null).optional(),
  position: Joi.number().integer().min(0).optional(),
  icon: Joi.string().max(50).allow('', null).optional(),
  is_published: Joi.boolean().optional(),
});

const updateKBCategorySchema = createKBCategorySchema.fork(
  ['name'],
  (schema) => schema.optional()
).min(1);

/**
 * Knowledge Base Article Schemas
 */
const createKBArticleSchema = Joi.object({
  category_id: Joi.number().integer().positive().allow(null).optional(),
  title: Joi.string().min(1).max(500).required().trim(),
  slug: Joi.string().max(255).allow('', null).optional(),
  content: Joi.string().allow('', null).optional(),
  excerpt: Joi.string().allow('', null).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
  status: Joi.string().valid('draft', 'published', 'archived').optional(),
});

const updateKBArticleSchema = createKBArticleSchema.fork(
  ['title'],
  (schema) => schema.optional()
).min(1);

/**
 * Article Feedback Schema
 */
const createArticleFeedbackSchema = Joi.object({
  is_helpful: Joi.boolean().required(),
  comment: Joi.string().allow('', null).optional(),
});

/**
 * Workflow Schemas
 */
const workflowStepSchema = Joi.object({
  id: Joi.number().integer().positive().optional(),
  position: Joi.number().integer().min(0).required(),
  step_type: Joi.string().valid('condition', 'action', 'delay').required(),
  config: Joi.object().required(),
});

const createWorkflowSchema = Joi.object({
  name: Joi.string().min(1).max(200).required().trim(),
  description: Joi.string().allow('', null).optional(),
  entity_type: Joi.string().valid('contact', 'lead', 'deal', 'company', 'task').required(),
  trigger_type: Joi.string().valid('create', 'update', 'delete', 'time_based', 'manual').required(),
  trigger_config: Joi.object().allow(null).optional(),
  is_active: Joi.boolean().optional(),
  steps: Joi.array().items(workflowStepSchema).optional(),
});

const updateWorkflowSchema = createWorkflowSchema.fork(
  ['name', 'entity_type', 'trigger_type'],
  (schema) => schema.optional()
).min(1);

module.exports = {
  registerSchema,
  loginSchema,
  updateUserSchema,
  changePasswordSchema,
  createRoleSchema,
  updateRoleSchema,
  idParamSchema,
  paginationSchema,
  emailSchema,
  resetPasswordSchema,
  createContactSchema,
  updateContactSchema,
  createCompanySchema,
  updateCompanySchema,
  createLeadSchema,
  updateLeadSchema,
  convertLeadSchema,
  createDealSchema,
  updateDealSchema,
  updateDealStageSchema,
  createActivitySchema,
  updateActivitySchema,
  createTaskSchema,
  updateTaskSchema,
  createDocumentSchema,
  createEmailTemplateSchema,
  updateEmailTemplateSchema,
  createQuoteSchema,
  updateQuoteSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  createPaymentSchema,
  updatePaymentSchema,
  createCalendarEventSchema,
  updateCalendarEventSchema,
  // Phase 4
  createReportSchema,
  updateReportSchema,
  createDataExportSchema,
  importMappingSchema,
  createEmailCampaignSchema,
  updateEmailCampaignSchema,
  createApiKeySchema,
  createWebhookSchema,
  updateWebhookSchema,
  createKBCategorySchema,
  updateKBCategorySchema,
  createKBArticleSchema,
  updateKBArticleSchema,
  createArticleFeedbackSchema,
  createWorkflowSchema,
  updateWorkflowSchema,
};
