const axios = require('axios');
const crypto = require('crypto');
const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { encrypt, decrypt } = require('../utils/encryption');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SCOPES = [
  'Calendars.ReadWrite',
  'OnlineMeetings.ReadWrite',
  'User.Read',
  'offline_access',
];

/**
 * Load Microsoft OAuth credentials from Settings table
 */
const getMicrosoftCredentials = async () => {
  const { Setting } = require('../models');
  const keys = [
    'microsoft.client_id',
    'microsoft.client_secret',
    'microsoft.redirect_uri',
    'microsoft.tenant_id',
  ];
  const settings = await Setting.findAll({
    where: { setting_key: { [Op.in]: keys } },
    raw: true,
  });

  const config = {};
  for (const s of settings) {
    config[s.setting_key] = s.setting_value;
  }

  if (!config['microsoft.client_id'] || !config['microsoft.client_secret']) {
    throw ApiError.badRequest(
      'Microsoft integration is not configured. Please set Client ID and Client Secret in Settings.'
    );
  }

  return {
    clientId: config['microsoft.client_id'],
    clientSecret: config['microsoft.client_secret'],
    redirectUri:
      config['microsoft.redirect_uri'] ||
      'http://localhost:5000/api/integrations/microsoft/callback',
    tenantId: config['microsoft.tenant_id'] || 'common',
  };
};

/**
 * Refresh Microsoft tokens if expired
 */
const refreshTokenIfNeeded = async (integration) => {
  if (integration.token_expiry && new Date(integration.token_expiry) > new Date()) {
    return decrypt(integration.access_token);
  }

  const creds = await getMicrosoftCredentials();
  const refreshToken = decrypt(integration.refresh_token);

  if (!refreshToken) {
    throw ApiError.badRequest('Microsoft refresh token missing. Please reconnect your account.');
  }

  const tokenUrl = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: SCOPES.join(' '),
  });

  const res = await axios.post(tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const tokens = res.data;
  const updateData = {
    access_token: encrypt(tokens.access_token),
    token_expiry: new Date(Date.now() + tokens.expires_in * 1000),
  };
  if (tokens.refresh_token) {
    updateData.refresh_token = encrypt(tokens.refresh_token);
  }

  await integration.update(updateData);
  return tokens.access_token;
};

/**
 * Get an authenticated axios config for Microsoft Graph API
 */
const getAuthenticatedHeaders = async (userId) => {
  const { UserIntegration } = require('../models');
  const integration = await UserIntegration.findOne({
    where: { user_id: userId, provider: 'microsoft', is_active: true },
  });

  if (!integration) {
    throw ApiError.badRequest(
      'Microsoft account not connected. Please connect your Microsoft account in Profile settings.'
    );
  }

  const accessToken = await refreshTokenIfNeeded(integration);
  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    integration,
  };
};

const microsoftService = {
  /**
   * Generate Microsoft OAuth authorization URL
   */
  getAuthUrl: async (userId) => {
    const creds = await getMicrosoftCredentials();
    const state = Buffer.from(
      JSON.stringify({
        userId,
        nonce: crypto.randomBytes(16).toString('hex'),
      })
    ).toString('base64');

    const params = new URLSearchParams({
      client_id: creds.clientId,
      response_type: 'code',
      redirect_uri: creds.redirectUri,
      scope: SCOPES.join(' '),
      state,
      response_mode: 'query',
      prompt: 'consent',
    });

    const url = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
    return { url, state };
  },

  /**
   * Handle OAuth callback — exchange code for tokens
   */
  handleCallback: async (code, stateParam) => {
    const { UserIntegration } = require('../models');

    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(stateParam, 'base64').toString());
    } catch {
      throw ApiError.badRequest('Invalid OAuth state parameter');
    }

    const { userId } = stateData;
    if (!userId) {
      throw ApiError.badRequest('Missing user ID in OAuth state');
    }

    const creds = await getMicrosoftCredentials();
    const tokenUrl = `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: creds.redirectUri,
      scope: SCOPES.join(' '),
    });

    const tokenRes = await axios.post(tokenUrl, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const tokens = tokenRes.data;

    // Get user profile from Graph
    const profileRes = await axios.get(`${GRAPH_BASE}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = profileRes.data;

    // Upsert integration record
    const existingIntegration = await UserIntegration.findOne({
      where: { user_id: userId, provider: 'microsoft' },
    });

    const integrationData = {
      user_id: userId,
      provider: 'microsoft',
      access_token: encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : existingIntegration?.refresh_token || null,
      token_expiry: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope || SCOPES.join(' '),
      provider_email: profile.mail || profile.userPrincipalName,
      provider_user_id: profile.id,
      is_active: true,
      sync_error: null,
    };

    if (existingIntegration) {
      await existingIntegration.update(integrationData);
    } else {
      await UserIntegration.create(integrationData);
    }

    return { userId, userEmail: profile.mail || profile.userPrincipalName };
  },

  /**
   * Disconnect Microsoft account
   */
  disconnect: async (userId) => {
    const { UserIntegration } = require('../models');
    const integration = await UserIntegration.findOne({
      where: { user_id: userId, provider: 'microsoft' },
    });

    if (!integration) {
      throw ApiError.notFound('Microsoft integration not found');
    }

    await integration.destroy();
    return { message: 'Microsoft account disconnected' };
  },

  /**
   * Get connection status for a user
   */
  getStatus: async (userId) => {
    const { UserIntegration } = require('../models');
    const integration = await UserIntegration.findOne({
      where: { user_id: userId, provider: 'microsoft' },
      attributes: [
        'id',
        'provider_email',
        'is_active',
        'last_sync_at',
        'sync_error',
        'created_at',
      ],
    });

    return {
      connected: !!integration && integration.is_active,
      email: integration?.provider_email || null,
      lastSyncAt: integration?.last_sync_at || null,
      syncError: integration?.sync_error || null,
      connectedAt: integration?.created_at || null,
    };
  },

  /**
   * Create an Outlook Calendar event (with optional Teams meeting)
   */
  createOutlookEvent: async (userId, eventData, addTeamsMeeting = false) => {
    const { headers } = await getAuthenticatedHeaders(userId);

    const outlookEvent = {
      subject: eventData.title,
      body: {
        contentType: 'HTML',
        content: eventData.description || '',
      },
      start: {
        dateTime: new Date(eventData.start_time).toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(eventData.end_time).toISOString(),
        timeZone: 'UTC',
      },
      isAllDay: eventData.all_day || false,
      location: {
        displayName: eventData.location || '',
      },
      attendees: (eventData.attendees || [])
        .filter((a) => a.email)
        .map((a) => ({
          emailAddress: { address: a.email, name: a.name || a.email },
          type: 'required',
        })),
    };

    if (addTeamsMeeting) {
      outlookEvent.isOnlineMeeting = true;
      outlookEvent.onlineMeetingProvider = 'teamsForBusiness';
    }

    const res = await axios.post(`${GRAPH_BASE}/me/calendar/events`, outlookEvent, { headers });

    const teamsMeetLink = res.data.onlineMeeting?.joinUrl || null;

    return {
      outlookEventId: res.data.id,
      teamsMeetingLink: teamsMeetLink,
    };
  },

  /**
   * Update an Outlook Calendar event
   */
  updateOutlookEvent: async (userId, outlookEventId, eventData, addTeamsMeeting = false) => {
    const { headers } = await getAuthenticatedHeaders(userId);

    const outlookEvent = {
      subject: eventData.title,
      body: {
        contentType: 'HTML',
        content: eventData.description || '',
      },
      start: {
        dateTime: new Date(eventData.start_time).toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(eventData.end_time).toISOString(),
        timeZone: 'UTC',
      },
      isAllDay: eventData.all_day || false,
      location: {
        displayName: eventData.location || '',
      },
      attendees: (eventData.attendees || [])
        .filter((a) => a.email)
        .map((a) => ({
          emailAddress: { address: a.email, name: a.name || a.email },
          type: 'required',
        })),
    };

    if (addTeamsMeeting) {
      outlookEvent.isOnlineMeeting = true;
      outlookEvent.onlineMeetingProvider = 'teamsForBusiness';
    }

    const res = await axios.patch(
      `${GRAPH_BASE}/me/calendar/events/${outlookEventId}`,
      outlookEvent,
      { headers }
    );

    const teamsMeetLink = res.data.onlineMeeting?.joinUrl || null;

    return {
      outlookEventId: res.data.id,
      teamsMeetingLink: teamsMeetLink,
    };
  },

  /**
   * Delete an Outlook Calendar event
   */
  deleteOutlookEvent: async (userId, outlookEventId) => {
    try {
      const { headers } = await getAuthenticatedHeaders(userId);
      await axios.delete(`${GRAPH_BASE}/me/calendar/events/${outlookEventId}`, { headers });
      return true;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 410) {
        return true;
      }
      console.error('Failed to delete Outlook event:', err.message);
      return false;
    }
  },

  /**
   * Pull events from Outlook Calendar
   */
  pullOutlookEvents: async (userId, timeMin, timeMax) => {
    try {
      const { headers, integration } = await getAuthenticatedHeaders(userId);

      const startDateTime = new Date(timeMin).toISOString();
      const endDateTime = new Date(timeMax).toISOString();

      const res = await axios.get(
        `${GRAPH_BASE}/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$top=250&$orderby=start/dateTime`,
        { headers }
      );

      await integration.update({ last_sync_at: new Date(), sync_error: null });

      return (res.data.value || []).map((item) => ({
        outlook_event_id: item.id,
        title: item.subject || '(No title)',
        description: item.bodyPreview || '',
        start_time: item.start?.dateTime,
        end_time: item.end?.dateTime,
        all_day: item.isAllDay || false,
        location: item.location?.displayName || '',
        teams_meeting_link: item.onlineMeeting?.joinUrl || null,
        attendees: (item.attendees || []).map((a) => ({
          email: a.emailAddress?.address,
          name: a.emailAddress?.name || a.emailAddress?.address,
          responseStatus: a.status?.response,
        })),
        source: 'microsoft',
      }));
    } catch (err) {
      const { UserIntegration } = require('../models');
      await UserIntegration.update(
        { sync_error: err.message },
        { where: { user_id: userId, provider: 'microsoft' } }
      );
      console.error('Outlook Calendar pull failed for user', userId, ':', err.message);
      return [];
    }
  },
};

module.exports = microsoftService;
