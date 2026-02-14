const { google } = require('googleapis');
const { Op } = require('sequelize');
const crypto = require('crypto');
const ApiError = require('../utils/apiError');
const { encrypt, decrypt } = require('../utils/encryption');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * Load Google OAuth credentials from Settings table
 */
const getGoogleCredentials = async () => {
  const { Setting } = require('../models');
  const keys = ['google.client_id', 'google.client_secret', 'google.redirect_uri'];
  const settings = await Setting.findAll({
    where: { setting_key: { [Op.in]: keys } },
    raw: true,
  });

  const config = {};
  for (const s of settings) {
    config[s.setting_key] = s.setting_value;
  }

  if (!config['google.client_id'] || !config['google.client_secret']) {
    throw ApiError.badRequest(
      'Google integration is not configured. Please set Client ID and Client Secret in Settings.'
    );
  }

  return {
    clientId: config['google.client_id'],
    clientSecret: config['google.client_secret'],
    redirectUri: config['google.redirect_uri'] || 'http://localhost:5000/api/integrations/google/callback',
  };
};

/**
 * Create an OAuth2 client instance
 */
const createOAuth2Client = async () => {
  const creds = await getGoogleCredentials();
  return new google.auth.OAuth2(creds.clientId, creds.clientSecret, creds.redirectUri);
};

/**
 * Get an authenticated OAuth2 client for a specific user
 * Handles token refresh automatically
 */
const getAuthenticatedClient = async (userId) => {
  const { UserIntegration } = require('../models');
  const integration = await UserIntegration.findOne({
    where: { user_id: userId, provider: 'google', is_active: true },
  });

  if (!integration) {
    throw ApiError.badRequest(
      'Google account not connected. Please connect your Google account in Profile settings.'
    );
  }

  const oauth2Client = await createOAuth2Client();
  const accessToken = decrypt(integration.access_token);
  const refreshToken = decrypt(integration.refresh_token);

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: integration.token_expiry ? new Date(integration.token_expiry).getTime() : null,
  });

  // Persist refreshed tokens automatically
  oauth2Client.on('tokens', async (tokens) => {
    const updateData = {};
    if (tokens.access_token) {
      updateData.access_token = encrypt(tokens.access_token);
    }
    if (tokens.refresh_token) {
      updateData.refresh_token = encrypt(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      updateData.token_expiry = new Date(tokens.expiry_date);
    }
    if (Object.keys(updateData).length > 0) {
      await integration.update(updateData);
    }
  });

  return { oauth2Client, integration };
};

const googleService = {
  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl: async (userId) => {
    const oauth2Client = await createOAuth2Client();
    const state = Buffer.from(JSON.stringify({
      userId,
      nonce: crypto.randomBytes(16).toString('hex'),
    })).toString('base64');

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state,
      prompt: 'consent',
      include_granted_scopes: true,
    });

    return { url, state };
  },

  /**
   * Handle OAuth callback - exchange code for tokens
   */
  handleCallback: async (code, stateParam) => {
    const { UserIntegration } = require('../models');

    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(stateParam, 'base64').toString());
    } catch (err) {
      throw ApiError.badRequest('Invalid OAuth state parameter');
    }

    const { userId } = stateData;
    if (!userId) {
      throw ApiError.badRequest('Missing user ID in OAuth state');
    }

    const oauth2Client = await createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();

    // Upsert integration record
    const existingIntegration = await UserIntegration.findOne({
      where: { user_id: userId, provider: 'google' },
    });

    const integrationData = {
      user_id: userId,
      provider: 'google',
      access_token: encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : (existingIntegration?.refresh_token || null),
      token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scopes: tokens.scope || SCOPES.join(' '),
      provider_email: userInfo.data.email,
      provider_user_id: userInfo.data.id,
      is_active: true,
      sync_error: null,
    };

    if (existingIntegration) {
      await existingIntegration.update(integrationData);
    } else {
      await UserIntegration.create(integrationData);
    }

    return { userId, userEmail: userInfo.data.email };
  },

  /**
   * Disconnect Google account
   */
  disconnect: async (userId) => {
    const { UserIntegration } = require('../models');
    const integration = await UserIntegration.findOne({
      where: { user_id: userId, provider: 'google' },
    });

    if (!integration) {
      throw ApiError.notFound('Google integration not found');
    }

    // Revoke the token at Google
    try {
      const oauth2Client = await createOAuth2Client();
      const accessToken = decrypt(integration.access_token);
      if (accessToken) {
        await oauth2Client.revokeToken(accessToken);
      }
    } catch (err) {
      console.warn('Failed to revoke Google token:', err.message);
    }

    await integration.destroy();
    return { message: 'Google account disconnected' };
  },

  /**
   * Get connection status for a user
   */
  getStatus: async (userId) => {
    const { UserIntegration } = require('../models');
    const integration = await UserIntegration.findOne({
      where: { user_id: userId, provider: 'google' },
      attributes: ['id', 'provider_email', 'is_active', 'last_sync_at', 'sync_error', 'created_at'],
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
   * Create a Google Calendar event (with optional Meet link)
   */
  createGoogleEvent: async (userId, eventData, addMeetLink = false) => {
    const { oauth2Client } = await getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const googleEvent = {
      summary: eventData.title,
      description: eventData.description || '',
      start: eventData.all_day
        ? { date: new Date(eventData.start_time).toISOString().split('T')[0] }
        : { dateTime: new Date(eventData.start_time).toISOString() },
      end: eventData.all_day
        ? { date: new Date(eventData.end_time).toISOString().split('T')[0] }
        : { dateTime: new Date(eventData.end_time).toISOString() },
      location: eventData.location || '',
      attendees: (eventData.attendees || [])
        .filter(a => a.email)
        .map(a => ({ email: a.email, displayName: a.name })),
    };

    if (addMeetLink) {
      googleEvent.conferenceData = {
        createRequest: {
          requestId: `facilis-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      resource: googleEvent,
      conferenceDataVersion: addMeetLink ? 1 : 0,
      sendUpdates: 'all',
    });

    const meetLink = res.data.conferenceData?.entryPoints
      ?.find(ep => ep.entryPointType === 'video')?.uri || null;

    return {
      googleEventId: res.data.id,
      googleMeetLink: meetLink,
      htmlLink: res.data.htmlLink,
    };
  },

  /**
   * Update a Google Calendar event
   */
  updateGoogleEvent: async (userId, googleEventId, eventData, addMeetLink = false) => {
    const { oauth2Client } = await getAuthenticatedClient(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const googleEvent = {
      summary: eventData.title,
      description: eventData.description || '',
      start: eventData.all_day
        ? { date: new Date(eventData.start_time).toISOString().split('T')[0] }
        : { dateTime: new Date(eventData.start_time).toISOString() },
      end: eventData.all_day
        ? { date: new Date(eventData.end_time).toISOString().split('T')[0] }
        : { dateTime: new Date(eventData.end_time).toISOString() },
      location: eventData.location || '',
      attendees: (eventData.attendees || [])
        .filter(a => a.email)
        .map(a => ({ email: a.email, displayName: a.name })),
    };

    if (addMeetLink) {
      googleEvent.conferenceData = {
        createRequest: {
          requestId: `facilis-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const res = await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      resource: googleEvent,
      conferenceDataVersion: addMeetLink ? 1 : 0,
      sendUpdates: 'all',
    });

    const meetLink = res.data.conferenceData?.entryPoints
      ?.find(ep => ep.entryPointType === 'video')?.uri || null;

    return {
      googleEventId: res.data.id,
      googleMeetLink: meetLink,
      htmlLink: res.data.htmlLink,
    };
  },

  /**
   * Delete a Google Calendar event
   */
  deleteGoogleEvent: async (userId, googleEventId) => {
    try {
      const { oauth2Client } = await getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
        sendUpdates: 'all',
      });
      return true;
    } catch (err) {
      if (err.code === 404 || err.code === 410) {
        return true;
      }
      console.error('Failed to delete Google Calendar event:', err.message);
      return false;
    }
  },

  /**
   * Pull events from Google Calendar for display
   */
  pullGoogleEvents: async (userId, timeMin, timeMax) => {
    try {
      const { oauth2Client, integration } = await getAuthenticatedClient(userId);
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date(timeMin).toISOString(),
        timeMax: new Date(timeMax).toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });

      await integration.update({ last_sync_at: new Date(), sync_error: null });

      return (res.data.items || []).map(item => ({
        google_event_id: item.id,
        title: item.summary || '(No title)',
        description: item.description || '',
        start_time: item.start?.dateTime || item.start?.date,
        end_time: item.end?.dateTime || item.end?.date,
        all_day: !item.start?.dateTime,
        location: item.location || '',
        google_meet_link: item.conferenceData?.entryPoints
          ?.find(ep => ep.entryPointType === 'video')?.uri || null,
        html_link: item.htmlLink,
        attendees: (item.attendees || []).map(a => ({
          email: a.email,
          name: a.displayName || a.email,
          responseStatus: a.responseStatus,
        })),
        source: 'google',
      }));
    } catch (err) {
      const { UserIntegration } = require('../models');
      await UserIntegration.update(
        { sync_error: err.message },
        { where: { user_id: userId, provider: 'google' } }
      );
      console.error('Google Calendar pull failed for user', userId, ':', err.message);
      return [];
    }
  },
};

module.exports = googleService;
