const { GoogleGenerativeAI } = require('@google/generative-ai');
const ApiError = require('../utils/apiError');

const SYSTEM_INSTRUCTION = `You are an expert technical writer for a knowledge base system.
Return clean semantic HTML only — no markdown, no code fences, no \`\`\`html wrappers, no <html>/<head>/<body> tags.
Use these HTML elements: h2, h3, h4, p, ul, ol, li, blockquote, pre, code, table, thead, tbody, tr, th, td, strong, em, a, hr, img, mark, sup, sub.
Do NOT use h1 (the article title is rendered separately).
Write engaging, well-structured content with clear headings and logical flow.
For code blocks, use <pre><code class="language-{lang}"> syntax.`;

/**
 * Get configured Gemini model instance
 */
const getModel = () => {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw ApiError.badRequest(
      'Google AI API key is not configured. Please set GOOGLE_AI_API_KEY in your environment variables.'
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: SYSTEM_INSTRUCTION,
  });
};

/**
 * Strip markdown code fences from AI response
 */
const stripCodeFences = (text) => {
  return text
    .replace(/^```(?:html|json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
};

const aiGenerationService = {
  /**
   * Generate a complete article from a topic
   * @param {string} topic - The topic to write about
   * @param {string} tone - Writing tone (professional, casual, technical, educational)
   * @returns {Promise<Object>} { title, content, excerpt, tags }
   */
  generateArticle: async (topic, tone = 'professional') => {
    try {
      const model = getModel();

      const prompt = `Write a comprehensive knowledge base article about: "${topic}"

Tone: ${tone}

Return a JSON object (no code fences, just raw JSON) with these fields:
{
  "title": "Article title (concise, descriptive)",
  "content": "Full article HTML content (use h2, h3 for sections, p for paragraphs, ul/ol for lists, blockquote for callouts, pre/code for code examples, table for data)",
  "excerpt": "2-3 sentence summary of the article (plain text, no HTML)",
  "tags": ["tag1", "tag2", "tag3"]
}

Make the content detailed (at least 800 words) with multiple sections, examples, and practical advice.`;

      const result = await model.generateContent(prompt);
      const responseText = stripCodeFences(result.response.text());

      try {
        const parsed = JSON.parse(responseText);
        return {
          title: parsed.title || topic,
          content: parsed.content || '',
          excerpt: parsed.excerpt || '',
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        };
      } catch (parseError) {
        // If JSON parsing fails, treat the whole response as content
        return {
          title: topic,
          content: responseText,
          excerpt: '',
          tags: [],
        };
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key')) {
        throw ApiError.badRequest('Invalid Google AI API key. Please check your configuration.');
      }
      if (error.message?.includes('RATE_LIMIT') || error.message?.includes('429')) {
        throw ApiError.badRequest('AI rate limit reached. Please try again in a moment.');
      }
      throw ApiError.internal('AI generation failed: ' + (error.message || 'Unknown error'));
    }
  },

  /**
   * Enhance existing article content
   * @param {string} content - Existing HTML content
   * @param {string} instructions - Enhancement instructions
   * @returns {Promise<Object>} { content }
   */
  enhanceContent: async (content, instructions = 'Improve grammar, structure, and clarity') => {
    try {
      const model = getModel();

      const prompt = `Enhance the following knowledge base article content based on these instructions: "${instructions}"

Current content:
${content}

Return ONLY the improved HTML content. Keep the same structure but enhance the writing quality, fix any issues, and apply the requested improvements. Do not wrap in code fences or JSON — return raw HTML only.`;

      const result = await model.generateContent(prompt);
      const responseText = stripCodeFences(result.response.text());

      return { content: responseText };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key')) {
        throw ApiError.badRequest('Invalid Google AI API key. Please check your configuration.');
      }
      throw ApiError.internal('AI enhancement failed: ' + (error.message || 'Unknown error'));
    }
  },

  /**
   * Generate new content to append to existing article
   * @param {string} existingContent - Current article HTML content
   * @param {string} instructions - What to add
   * @returns {Promise<Object>} { content } (only the new portion)
   */
  appendContent: async (existingContent, instructions) => {
    try {
      const model = getModel();

      const prompt = `The following is an existing knowledge base article:

${existingContent}

Based on the above context, generate NEW content to add at the end of this article. Instructions: "${instructions}"

Return ONLY the new HTML content that should be appended. Do not repeat existing content. Do not wrap in code fences or JSON — return raw HTML only. Start with a heading (h2 or h3) for the new section.`;

      const result = await model.generateContent(prompt);
      const responseText = stripCodeFences(result.response.text());

      return { content: responseText };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key')) {
        throw ApiError.badRequest('Invalid Google AI API key. Please check your configuration.');
      }
      throw ApiError.internal('AI content generation failed: ' + (error.message || 'Unknown error'));
    }
  },

  /**
   * Suggest workflow steps from a natural language description
   * @param {string} description - What the workflow should do
   * @param {string} entityType - The entity type (contact, deal, lead, etc.)
   * @returns {Promise<Array>} Array of step objects
   */
  suggestWorkflowSteps: async (description, entityType = 'deal') => {
    try {
      const model = getModel();

      const prompt = `You are designing automation workflow steps for a CRM system.

Entity type: ${entityType}

Available step types:
1. "condition" — Check a field value. Config: { "field": "field_name", "operator": "equals|not_equals|contains|greater_than|less_than", "value": "target_value" }
2. "action" — Perform an action. Config must have "action_type" which is one of:
   - "update_field": { "action_type": "update_field", "field": "field_name", "value": "new_value" }
   - "create_task": { "action_type": "create_task", "title": "task title", "description": "task desc", "priority": "high|medium|low" }
   - "send_email": { "action_type": "send_email", "template": "template_name", "to": "owner|contact" }
   - "assign_user": { "action_type": "assign_user", "assignment": "round_robin|specific", "user_id": null }
3. "delay" — Wait before next step. Config: { "duration": 1, "unit": "minutes|hours|days" }

User request: "${description}"

Return a JSON array (no code fences) of workflow steps:
[
  { "step_type": "condition|action|delay", "config": {...}, "description": "Human-readable explanation" }
]

Generate 2-6 practical steps that accomplish the user's goal.`;

      const result = await model.generateContent(prompt);
      const responseText = stripCodeFences(result.response.text());

      try {
        const parsed = JSON.parse(responseText);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key')) {
        throw ApiError.badRequest('Invalid Google AI API key. Please check your configuration.');
      }
      throw ApiError.internal('AI suggestion failed: ' + (error.message || 'Unknown error'));
    }
  },

  /**
   * Suggest permissions for a role based on name and description
   * @param {string} roleName - Name of the role
   * @param {string} description - Description of the role
   * @returns {Promise<Object>} { permissions: ["module:action", ...], reasoning: "..." }
   */
  suggestRolePermissions: async (roleName, description = '') => {
    try {
      const model = getModel();

      const prompt = `You are an RBAC expert for a CRM system. Suggest appropriate permissions for a role.

Role name: "${roleName}"
Role description: "${description || 'No description provided'}"

Available modules: users, roles, settings, contacts, leads, deals, companies, activities, dashboard, reports, tasks, calendar, quotes, invoices, documents, email_templates, email_logs, data_exports, imports, email_campaigns, knowledge_base, api_keys, webhooks, workflows, pipelines

Available actions per module: create, read, update, delete, export, import

Return a JSON object (no code fences):
{
  "permissions": ["module:action", "module:action", ...],
  "reasoning": "Brief explanation of why these permissions were chosen"
}

Be conservative — only grant permissions that the role reasonably needs. A "Sales Rep" doesn't need "users:delete" or "roles:create". Every role should have "dashboard:read".`;

      const result = await model.generateContent(prompt);
      const responseText = stripCodeFences(result.response.text());

      try {
        const parsed = JSON.parse(responseText);
        return {
          permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
          reasoning: parsed.reasoning || '',
        };
      } catch {
        return { permissions: [], reasoning: 'Failed to parse AI response' };
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('API key')) {
        throw ApiError.badRequest('Invalid Google AI API key. Please check your configuration.');
      }
      throw ApiError.internal('AI suggestion failed: ' + (error.message || 'Unknown error'));
    }
  },
};

module.exports = aiGenerationService;
