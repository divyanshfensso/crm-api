const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');

/**
 * Get configured Gemini model instance
 * Loads API key from Settings table first, falls back to .env
 */
const getModel = async (systemInstruction = '') => {
  const { Setting } = require('../models');

  const setting = await Setting.findOne({ where: { setting_key: 'ai.api_key' } });
  const apiKey = setting?.setting_value || process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw ApiError.badRequest(
      'Gemini API key is not configured. Go to Settings > General to add your API key.'
    );
  }

  const modelSetting = await Setting.findOne({ where: { setting_key: 'ai.model' } });
  const modelName = modelSetting?.setting_value || 'gemini-2.0-flash';

  const genAI = new GoogleGenerativeAI(apiKey);
  const config = { model: modelName };
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }

  return genAI.getGenerativeModel(config);
};

/**
 * Strip markdown code fences from AI response
 */
const stripCodeFences = (text) => {
  return text
    .replace(/^```(?:html|json|javascript)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
};

/**
 * Parse JSON from AI response safely
 */
const safeParseJSON = (text) => {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    throw ApiError.internal('Failed to parse AI response');
  }
};

/**
 * Get available template variables per module
 */
const getModuleVariables = (module) => {
  const map = {
    contacts: '{{first_name}}, {{last_name}}, {{email}}, {{phone}}, {{company_name}}, {{job_title}}',
    deals: '{{deal_title}}, {{deal_value}}, {{stage_name}}, {{contact_name}}, {{expected_close_date}}',
    quotes: '{{quote_number}}, {{total}}, {{valid_until}}, {{contact_name}}, {{company_name}}',
    invoices: '{{invoice_number}}, {{total}}, {{due_date}}, {{contact_name}}, {{company_name}}',
    leads: '{{first_name}}, {{last_name}}, {{email}}, {{company_name}}, {{lead_source}}, {{status}}',
  };
  return map[module] || '{{first_name}}, {{last_name}}, {{email}}';
};

const aiService = {
  /**
   * Test AI connection by sending a simple prompt
   */
  testConnection: async () => {
    try {
      const model = await getModel();
      const result = await model.generateContent('Respond with exactly: "Connection successful"');
      const text = result.response.text().trim();
      return { status: 'connected', response: text };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key')) {
        throw ApiError.badRequest('Invalid Gemini API key. Please check your configuration.');
      }
      throw ApiError.internal('AI connection test failed: ' + error.message);
    }
  },

  /**
   * Generate a complete email template
   */
  generateEmailTemplate: async (purpose, module, tone, keyPoints = '') => {
    try {
      const model = await getModel(
        'You are an expert email copywriter for a CRM system. Generate professional email templates with clean HTML and inline styles.'
      );

      const prompt = `Generate an email template for a CRM system.

Purpose: ${purpose}
Module: ${module}
Tone: ${tone}
${keyPoints ? `Additional requirements: ${keyPoints}` : ''}

Available variables for ${module}: ${getModuleVariables(module)}

Return ONLY a JSON object (no code fences):
{
  "name": "Template name (concise, max 50 chars)",
  "subject": "Email subject line using {{variables}} where appropriate",
  "body_html": "Complete HTML email body with inline styles, proper greeting using {{first_name}}, clear sections, and professional sign-off. Use a clean, modern design with proper spacing.",
  "variables": ["first_name", "last_name"]
}

Requirements:
- Use inline CSS styles for all elements
- Include a proper greeting with {{first_name}}
- Structure with clear paragraphs
- End with a professional signature placeholder
- Keep subject under 60 characters
- Make the HTML render well in email clients`;

      const result = await model.generateContent(prompt);
      return safeParseJSON(result.response.text());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Email template generation failed: ' + error.message);
    }
  },

  /**
   * Score leads using AI analysis
   */
  scoreLeads: async (leadIds) => {
    const { Lead, Activity } = require('../models');

    try {
      const model = await getModel(
        'You are a sales intelligence AI. Analyze lead data and score prospects based on conversion potential. Be precise and consistent.'
      );

      const leads = await Lead.findAll({
        where: { id: leadIds },
        include: [
          { association: 'activities', attributes: ['id', 'type', 'created_at'] },
        ],
      });

      if (leads.length === 0) {
        throw ApiError.notFound('No leads found with the provided IDs');
      }

      const updates = [];

      for (const lead of leads) {
        const activityCount = lead.activities?.length || 0;
        const recentActivities = lead.activities?.filter((a) => {
          const daysAgo = (Date.now() - new Date(a.created_at).getTime()) / (1000 * 60 * 60 * 24);
          return daysAgo <= 30;
        }).length || 0;

        const prompt = `Score this sales lead from 0-100.

Lead:
- Name: ${lead.first_name} ${lead.last_name}
- Email: ${lead.email || 'Not provided'}
- Job Title: ${lead.job_title || 'Not provided'}
- Company: ${lead.company_name || 'Not provided'}
- Source: ${lead.lead_source || 'Unknown'}
- Status: ${lead.status}
- Total Activities: ${activityCount}
- Recent Activities (30 days): ${recentActivities}
- Notes: ${lead.notes ? lead.notes.substring(0, 200) : 'None'}

Return ONLY JSON:
{"score": 75, "reasoning": "Brief 1-2 sentence explanation"}

Scoring guide:
- 80-100: Decision-maker, engaged, quality company, strong fit
- 50-79: Some positive signals, needs nurturing
- 20-49: Limited engagement or unclear fit
- 0-19: Poor fit or unresponsive`;

        try {
          const result = await model.generateContent(prompt);
          const parsed = safeParseJSON(result.response.text());
          updates.push({
            id: lead.id,
            score: Math.min(100, Math.max(0, parseInt(parsed.score) || 0)),
            score_reasoning: parsed.reasoning || '',
          });
        } catch {
          // Skip individual leads that fail
          continue;
        }
      }

      // Bulk update
      for (const update of updates) {
        await Lead.update(
          { score: update.score, score_reasoning: update.score_reasoning },
          { where: { id: update.id } }
        );
      }

      return { scored: updates.length, total: leadIds.length, results: updates };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('AI lead scoring failed: ' + error.message);
    }
  },

  /**
   * Analyze a deal for risk and win probability
   */
  analyzeDeal: async (dealId) => {
    const { Deal, Activity } = require('../models');

    try {
      const deal = await Deal.findByPk(dealId, {
        include: [
          { association: 'stage' },
          { association: 'pipeline', include: [{ association: 'stages' }] },
          { association: 'contact' },
          { association: 'company' },
          { association: 'owner' },
        ],
      });

      if (!deal) throw ApiError.notFound('Deal not found');

      // Get activity count
      const activityCount = await Activity.count({ where: { deal_id: dealId } });
      const recentActivityCount = await Activity.count({
        where: {
          deal_id: dealId,
          created_at: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      });

      const now = new Date();
      const daysSinceCreated = Math.floor((now - new Date(deal.created_at)) / (1000 * 60 * 60 * 24));
      const daysInCurrentStage = Math.floor((now - new Date(deal.updated_at)) / (1000 * 60 * 60 * 24));

      const totalStages = deal.pipeline?.stages?.length || 6;
      const currentStagePosition = deal.stage?.position || 1;

      const model = await getModel(
        'You are a sales analytics AI. Analyze deal data and provide accurate risk assessments and win probability predictions.'
      );

      const prompt = `Analyze this sales deal.

Deal:
- Title: ${deal.title}
- Value: ${deal.value}
- Stage: ${deal.stage?.name || 'Unknown'} (stage ${currentStagePosition} of ${totalStages})
- Pipeline: ${deal.pipeline?.name || 'Default'}
- Status: ${deal.status || 'open'}
- Age: ${daysSinceCreated} days
- Days in current stage: ${daysInCurrentStage}
- Total activities: ${activityCount}
- Activities in last 30 days: ${recentActivityCount}
- Expected close: ${deal.expected_close_date || 'Not set'}
- Contact: ${deal.contact ? `${deal.contact.first_name} ${deal.contact.last_name}` : 'None'}
- Company: ${deal.company?.name || 'None'}
- Probability: ${deal.probability || 'Not set'}%

Return ONLY JSON:
{
  "win_probability": 65,
  "risk_level": "low",
  "risk_factors": ["Factor 1", "Factor 2"],
  "next_best_action": "Specific actionable recommendation",
  "summary": "One sentence deal health summary"
}

risk_level must be: "low", "medium", or "high"
Provide 0-4 risk factors. Be specific and actionable.`;

      const result = await model.generateContent(prompt);
      const parsed = safeParseJSON(result.response.text());

      return {
        deal_id: dealId,
        deal_title: deal.title,
        win_probability: Math.min(100, Math.max(0, parseInt(parsed.win_probability) || 50)),
        risk_level: ['low', 'medium', 'high'].includes(parsed.risk_level) ? parsed.risk_level : 'medium',
        risk_factors: Array.isArray(parsed.risk_factors) ? parsed.risk_factors : [],
        next_best_action: parsed.next_best_action || 'Continue regular follow-up',
        summary: parsed.summary || '',
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Deal analysis failed: ' + error.message);
    }
  },

  /**
   * Generate a contact summary
   */
  summarizeContact: async (contactId) => {
    const { Contact, Deal, Activity } = require('../models');

    try {
      const contact = await Contact.findByPk(contactId, {
        include: [
          { association: 'company' },
          { association: 'deals', include: [{ association: 'stage' }] },
        ],
      });

      if (!contact) throw ApiError.notFound('Contact not found');

      const activityCount = await Activity.count({ where: { contact_id: contactId } });
      const recentActivityCount = await Activity.count({
        where: {
          contact_id: contactId,
          created_at: { [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      });

      const openDeals = contact.deals?.filter((d) => d.status === 'open') || [];
      const wonDeals = contact.deals?.filter((d) => d.status === 'won') || [];
      const totalDealValue = contact.deals?.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0) || 0;

      const model = await getModel();

      const prompt = `Write a concise executive summary for this CRM contact.

Contact:
- Name: ${contact.first_name} ${contact.last_name}
- Title: ${contact.job_title || 'Unknown'}
- Company: ${contact.company?.name || 'None'}
- Email: ${contact.email || 'None'}
- Phone: ${contact.phone || 'None'}
- Status: ${contact.status || 'active'}
- Total Activities: ${activityCount}
- Recent Activities (30 days): ${recentActivityCount}
- Total Deals: ${contact.deals?.length || 0}
- Open Deals: ${openDeals.length}
- Won Deals: ${wonDeals.length}
- Total Deal Value: ${totalDealValue}

Write 3-4 sentences covering: role, engagement level, key opportunities, and recommended next steps. Return plain text only.`;

      const result = await model.generateContent(prompt);
      return { summary: result.response.text().trim() };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Contact summary failed: ' + error.message);
    }
  },

  /**
   * Generate a company summary
   */
  summarizeCompany: async (companyId) => {
    const { Company, Contact, Deal } = require('../models');

    try {
      const company = await Company.findByPk(companyId, {
        include: [
          { association: 'contacts', attributes: ['id', 'first_name', 'last_name', 'job_title'] },
          { association: 'deals', include: [{ association: 'stage' }] },
        ],
      });

      if (!company) throw ApiError.notFound('Company not found');

      const openDeals = company.deals?.filter((d) => d.status === 'open') || [];
      const wonDeals = company.deals?.filter((d) => d.status === 'won') || [];
      const totalValue = company.deals?.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0) || 0;

      const model = await getModel();

      const prompt = `Write a concise executive summary for this CRM company account.

Company:
- Name: ${company.name}
- Industry: ${company.industry || 'Unknown'}
- Website: ${company.website || 'None'}
- Size: ${company.employee_count || 'Unknown'} employees
- Total Contacts: ${company.contacts?.length || 0}
- Key Contacts: ${company.contacts?.slice(0, 5).map((c) => `${c.first_name} ${c.last_name} (${c.job_title || 'N/A'})`).join(', ') || 'None'}
- Total Deals: ${company.deals?.length || 0}
- Open Deals: ${openDeals.length}
- Won Deals: ${wonDeals.length}
- Total Deal Value: ${totalValue}

Write 3-4 sentences covering: company profile, relationship depth, revenue potential, and recommended strategy. Return plain text only.`;

      const result = await model.generateContent(prompt);
      return { summary: result.response.text().trim() };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Company summary failed: ' + error.message);
    }
  },

  /**
   * Suggest email subject lines
   */
  suggestSubjectLines: async (body, module, purpose = '') => {
    try {
      const model = await getModel();

      const bodyPreview = (body || '').replace(/<[^>]*>/g, '').substring(0, 500);

      const prompt = `Generate 5 compelling email subject lines for a CRM email.

Email body preview: ${bodyPreview || 'No body content provided'}
Module: ${module || 'general'}
Purpose: ${purpose || 'general communication'}
Available variables: ${getModuleVariables(module)}

Return ONLY JSON:
{"suggestions": ["Subject 1", "Subject 2", "Subject 3", "Subject 4", "Subject 5"]}

Guidelines:
- Under 60 characters each
- Use {{variables}} where appropriate (e.g., {{first_name}})
- Varied styles: direct, value-focused, question, action-oriented, personalized
- Professional tone`;

      const result = await model.generateContent(prompt);
      return safeParseJSON(result.response.text());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Subject line suggestion failed: ' + error.message);
    }
  },

  /**
   * Generate dashboard AI insights
   */
  getDashboardInsights: async () => {
    const { Deal, Lead, Task, Activity, Contact, sequelize } = require('../models');

    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

      const [
        totalDeals,
        staleDeals,
        overdueTasks,
        newLeads,
        newContacts,
        recentActivities,
        wonDealsThisMonth,
        lostDealsThisMonth,
      ] = await Promise.all([
        Deal.count({ where: { status: 'open' } }),
        Deal.count({
          where: {
            updated_at: { [Op.lt]: thirtyDaysAgo },
            status: 'open',
          },
        }),
        Task.count({
          where: {
            due_date: { [Op.lt]: now },
            status: { [Op.ne]: 'completed' },
          },
        }),
        Lead.count({ where: { created_at: { [Op.gte]: thirtyDaysAgo } } }),
        Contact.count({ where: { created_at: { [Op.gte]: thirtyDaysAgo } } }),
        Activity.count({ where: { created_at: { [Op.gte]: sevenDaysAgo } } }),
        Deal.count({
          where: {
            status: 'won',
            updated_at: { [Op.gte]: thirtyDaysAgo },
          },
        }),
        Deal.count({
          where: {
            status: 'lost',
            updated_at: { [Op.gte]: thirtyDaysAgo },
          },
        }),
      ]);

      const model = await getModel(
        'You are a CRM analytics AI. Provide concise, actionable business insights. Be specific with numbers.'
      );

      const prompt = `Analyze this CRM data and provide 4-5 actionable insights.

Metrics:
- Open Deals: ${totalDeals}
- Stale Deals (no update in 30 days): ${staleDeals}
- Overdue Tasks: ${overdueTasks}
- New Leads (30 days): ${newLeads}
- New Contacts (30 days): ${newContacts}
- Activities (7 days): ${recentActivities}
- Won Deals (30 days): ${wonDealsThisMonth}
- Lost Deals (30 days): ${lostDealsThisMonth}

Return ONLY JSON:
{
  "insights": [
    {"type": "warning", "message": "Insight about risks or issues"},
    {"type": "success", "message": "Insight about positive trends"},
    {"type": "info", "message": "Insight about opportunities"}
  ]
}

type must be: "warning", "success", or "info"
Each message under 120 characters. Be specific with numbers. Focus on actionable items.`;

      const result = await model.generateContent(prompt);
      return safeParseJSON(result.response.text());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Dashboard insights failed: ' + error.message);
    }
  },

  /**
   * Parse natural language into report configuration
   */
  parseReportQuery: async (query) => {
    try {
      const model = await getModel(
        'You are a report builder AI for a CRM system. Convert natural language queries into structured report configurations.'
      );

      const prompt = `Convert this natural language query into a report configuration.

User query: "${query}"

Available entities and their columns:
- contacts: first_name, last_name, email, phone, job_title, company_name, status, lead_source, created_at, owner (user)
- leads: first_name, last_name, email, phone, company_name, job_title, lead_source, status, score, created_at, owner (user)
- deals: title, value, status (open/won/lost), probability, expected_close_date, created_at, stage (name), pipeline (name), contact (name), company (name), owner (user)
- companies: name, industry, website, employee_count, created_at
- tasks: title, status, priority, due_date, created_at, assigned_to (user)
- activities: activity_type (call/email/meeting/note/task), subject, created_at, user (name)
- invoices: invoice_number, total, status, issue_date, due_date, currency
- quotes: quote_number, total, status, valid_until, currency

Return ONLY JSON:
{
  "name": "Report name",
  "entity": "deals",
  "columns": ["title", "value", "stage", "owner"],
  "filters": [
    {"field": "status", "operator": "equals", "value": "won"}
  ],
  "sort": {"field": "value", "direction": "DESC"},
  "group_by": "owner",
  "chart_type": "bar"
}

Operators: equals, not_equals, contains, greater_than, less_than, between, in
chart_type: bar, pie, line, or null (table only)
Use sensible defaults. If the query mentions time periods, calculate approximate dates.`;

      const result = await model.generateContent(prompt);
      return safeParseJSON(result.response.text());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Report query parsing failed: ' + error.message);
    }
  },

  /**
   * Analyze CSV data for smart import — detect entity type, map columns, suggest transformations
   */
  analyzeImportCSV: async (headers, sampleRows, entityTypeHint = null) => {
    try {
      const model = await getModel(
        'You are a CRM data import assistant. Analyze CSV data and intelligently map columns to CRM database fields. Be precise and return valid JSON only.'
      );

      const sampleDataStr = sampleRows
        .map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`)
        .join('\n');

      const prompt = `Analyze this CSV file for import into a CRM system.

CSV Headers: ${JSON.stringify(headers)}

Sample Data (first ${sampleRows.length} rows):
${sampleDataStr}

${entityTypeHint && entityTypeHint !== 'auto' ? `The user selected entity type: ${entityTypeHint}` : 'Auto-detect the most appropriate entity type based on the columns and data.'}

Available entity types and their database fields:
- contacts: first_name, last_name, email, phone, mobile, company_name, job_title, department, lead_source, status (active|inactive|prospect|customer|churned), address_line1, address_line2, city, state, country, zip_code, notes
- companies: name, industry, website, phone, email, employee_count, annual_revenue, address_line1, address_line2, city, state, country, zip_code, description
- leads: first_name, last_name, email, phone, company_name, job_title, lead_source, status (new|contacted|qualified|unqualified|converted|lost), score, notes
- deals: title, value, currency, probability, status (open|won|lost), expected_close_date, contact_name, company_name, stage, notes

Return ONLY a JSON object:
{
  "detected_entity": "contacts",
  "entity_confidence": 0.95,
  "entity_reasoning": "Brief explanation",
  "mappings": [
    {
      "csv_column": "Full Name",
      "crm_field": "first_name",
      "confidence": 0.9,
      "transformation": "split_name_first",
      "notes": "Will extract first name from full name"
    }
  ],
  "unmapped_columns": ["Column that doesn't map to any CRM field"],
  "warnings": ["Any data quality warnings"]
}

Rules:
- A single CSV column CAN map to multiple CRM fields (e.g., "Full Name" -> first_name AND last_name as separate entries)
- confidence is 0.0 to 1.0
- Valid transformations: null (direct copy), "split_name_first", "split_name_last", "normalize_date", "normalize_status", "normalize_phone", "to_number", "to_lowercase"
- Use "split_name_first" and "split_name_last" when a single column contains a full name that needs splitting
- For columns that don't map to any CRM field, list them in unmapped_columns
- Be smart about semantic matching: "Tel" -> phone, "Company" -> company_name, "Role" -> job_title, etc.
- detected_entity must be one of: contacts, companies, leads, deals`;

      const result = await model.generateContent(prompt);
      const parsed = safeParseJSON(result.response.text());

      // Validate and sanitize the response
      const validEntities = ['contacts', 'companies', 'leads', 'deals'];
      if (!validEntities.includes(parsed.detected_entity)) {
        parsed.detected_entity = entityTypeHint && entityTypeHint !== 'auto' ? entityTypeHint : 'contacts';
      }

      const validTransformations = [null, 'split_name_first', 'split_name_last', 'normalize_date', 'normalize_status', 'normalize_phone', 'to_number', 'to_lowercase'];
      if (Array.isArray(parsed.mappings)) {
        parsed.mappings = parsed.mappings.map(m => ({
          csv_column: m.csv_column || '',
          crm_field: m.crm_field || '',
          confidence: Math.min(1, Math.max(0, parseFloat(m.confidence) || 0.5)),
          transformation: validTransformations.includes(m.transformation) ? m.transformation : null,
          notes: m.notes || '',
        }));
      } else {
        parsed.mappings = [];
      }

      parsed.entity_confidence = Math.min(1, Math.max(0, parseFloat(parsed.entity_confidence) || 0.5));
      parsed.unmapped_columns = Array.isArray(parsed.unmapped_columns) ? parsed.unmapped_columns : [];
      parsed.warnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];

      return parsed;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Import CSV analysis failed: ' + error.message);
    }
  },

  /**
   * Summarize activities for a contact or deal
   */
  summarizeActivities: async (entityType, entityId) => {
    const { Activity } = require('../models');

    try {
      const whereClause = {};
      if (entityType === 'contact') whereClause.contact_id = entityId;
      else if (entityType === 'deal') whereClause.deal_id = entityId;
      else if (entityType === 'lead') whereClause.lead_id = entityId;
      else throw ApiError.badRequest('Invalid entity type');

      const activities = await Activity.findAll({
        where: whereClause,
        include: [{ association: 'user', attributes: ['first_name', 'last_name'] }],
        order: [['created_at', 'DESC']],
        limit: 30,
      });

      if (activities.length === 0) {
        return { summary: 'No activities recorded yet.' };
      }

      const activityText = activities
        .map(
          (a) =>
            `[${new Date(a.created_at).toLocaleDateString()}] ${a.activity_type}: ${a.subject || ''} ${a.notes ? '- ' + a.notes.substring(0, 100) : ''} (by ${a.user ? `${a.user.first_name} ${a.user.last_name}` : 'Unknown'})`
        )
        .join('\n');

      const model = await getModel();

      const prompt = `Summarize these CRM activity records into a concise narrative.

Activities (most recent first):
${activityText}

Write a 2-3 paragraph summary covering:
- Overall engagement pattern and frequency
- Key milestones or important interactions
- Current momentum and recommended next steps

Return plain text only. Be concise and actionable.`;

      const result = await model.generateContent(prompt);
      return { summary: result.response.text().trim() };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw ApiError.internal('Activity summarization failed: ' + error.message);
    }
  },
};

module.exports = aiService;
