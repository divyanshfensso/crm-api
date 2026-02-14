const { Op } = require('sequelize');
const ApiError = require('../utils/apiError');
const { getPagination, getSorting, buildSearchCondition } = require('../utils/pagination');
const { sanitizeFKFields } = require('../utils/helpers');

const CALENDAR_FK_FIELDS = ['contact_id', 'company_id', 'deal_id'];

const calendarService = {
  /**
   * Get all calendar events with pagination, search, and filters
   * @param {Object} query - Query parameters
   * @returns {Promise<Object>} Paginated events list
   */
  getAll: async (query) => {
    const { CalendarEvent, User, Contact, Company, Deal } = require('../models');
    const { page, limit, offset } = getPagination(query);
    const { search, date_from, date_to, contact_id, company_id, deal_id } = query;
    const order = getSorting(query, 'start_time', 'DESC');

    const where = {};

    // Search functionality
    if (search) {
      const searchCondition = buildSearchCondition(search, ['title', 'description', 'location']);
      Object.assign(where, searchCondition);
    }

    // Filter by date range
    if (date_from || date_to) {
      where.start_time = {};
      if (date_from) {
        where.start_time[Op.gte] = new Date(date_from);
      }
      if (date_to) {
        where.start_time[Op.lte] = new Date(date_to);
      }
    }

    // Filter by contact
    if (contact_id) {
      where.contact_id = contact_id;
    }

    // Filter by company
    if (company_id) {
      where.company_id = company_id;
    }

    // Filter by deal
    if (deal_id) {
      where.deal_id = deal_id;
    }

    const { count, rows } = await CalendarEvent.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
        }
      ],
      order,
      limit,
      offset,
      distinct: true
    });

    return {
      data: rows,
      meta: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    };
  },

  /**
   * Get calendar event by ID with full details
   * @param {number} id - Event ID
   * @returns {Promise<Object>} Event with relations
   */
  getById: async (id) => {
    const { CalendarEvent, User, Contact, Company, Deal } = require('../models');

    const event = await CalendarEvent.findByPk(id, {
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
        }
      ]
    });

    if (!event) {
      throw ApiError.notFound('Calendar event not found');
    }

    return event;
  },

  /**
   * Create a new calendar event
   * @param {Object} data - Event data
   * @param {number} userId - Current user ID
   * @returns {Promise<Object>} Created event
   */
  create: async (data, userId) => {
    const { CalendarEvent } = require('../models');
    const { sendEventInvitations } = require('../utils/calendarInvitation');

    const sendInvitations = data.send_invitations !== false;
    const cleanData = sanitizeFKFields(data, CALENDAR_FK_FIELDS);
    const eventData = {
      ...cleanData,
      created_by: userId
    };

    const event = await CalendarEvent.create(eventData);

    // Google Calendar sync
    if (data.sync_to_google) {
      try {
        const googleService = require('./google.service');
        const addMeetLink = data.add_google_meet === true;
        const googleResult = await googleService.createGoogleEvent(userId, data, addMeetLink);
        await event.update({
          google_event_id: googleResult.googleEventId,
          google_meet_link: googleResult.googleMeetLink,
          sync_to_google: true,
        });
      } catch (googleErr) {
        console.error('Google Calendar sync failed during create:', googleErr.message);
        if (googleErr.response?.data) {
          console.error('Google API error details:', JSON.stringify(googleErr.response.data));
        }
        await event.update({ sync_to_google: true });
      }
    }

    // Outlook Calendar sync
    if (data.sync_to_outlook) {
      try {
        const microsoftService = require('./microsoft.service');
        const addTeamsMeeting = data.add_teams_meeting === true;
        const outlookResult = await microsoftService.createOutlookEvent(userId, data, addTeamsMeeting);
        await event.update({
          outlook_event_id: outlookResult.outlookEventId,
          teams_meeting_link: outlookResult.teamsMeetingLink,
          sync_to_outlook: true,
        });
      } catch (outlookErr) {
        console.error('Outlook Calendar sync failed during create:', outlookErr.message);
        if (outlookErr.response?.data) {
          console.error('Outlook API error details:', JSON.stringify(outlookErr.response.data));
        }
        await event.update({ sync_to_outlook: true });
      }
    }

    // Fetch the created event with relations
    const fullEvent = await calendarService.getById(event.id);

    // Send invitations asynchronously (do not block response)
    if (sendInvitations && fullEvent.attendees && fullEvent.attendees.length > 0) {
      sendEventInvitations(fullEvent, userId, false).catch((err) => {
        console.error('Failed to send calendar invitations:', err);
      });
    }

    return fullEvent;
  },

  /**
   * Update an existing calendar event
   * @param {number} id - Event ID
   * @param {Object} data - Updated event data
   * @returns {Promise<Object>} Updated event
   */
  update: async (id, data) => {
    const { CalendarEvent } = require('../models');
    const { sendEventInvitations } = require('../utils/calendarInvitation');

    const event = await CalendarEvent.findByPk(id);

    if (!event) {
      throw ApiError.notFound('Calendar event not found');
    }

    const sendInvitations = data.send_invitations !== false;
    const cleanData = sanitizeFKFields(data, CALENDAR_FK_FIELDS);
    await event.update(cleanData);

    // Google Calendar sync
    const shouldSync = data.sync_to_google !== undefined ? data.sync_to_google : event.sync_to_google;
    if (shouldSync) {
      try {
        const googleService = require('./google.service');
        if (event.google_event_id) {
          const addMeetLink = data.add_google_meet === true && !event.google_meet_link;
          const googleResult = await googleService.updateGoogleEvent(
            event.created_by, event.google_event_id, { ...event.toJSON(), ...cleanData }, addMeetLink
          );
          if (googleResult.googleMeetLink && !event.google_meet_link) {
            await event.update({ google_meet_link: googleResult.googleMeetLink });
          }
        } else {
          const addMeetLink = data.add_google_meet === true;
          const googleResult = await googleService.createGoogleEvent(
            event.created_by, { ...event.toJSON(), ...cleanData }, addMeetLink
          );
          await event.update({
            google_event_id: googleResult.googleEventId,
            google_meet_link: googleResult.googleMeetLink,
            sync_to_google: true,
          });
        }
      } catch (googleErr) {
        console.error('Google Calendar sync failed during update:', googleErr.message);
      }
    }

    // Outlook Calendar sync
    const shouldSyncOutlook = data.sync_to_outlook !== undefined ? data.sync_to_outlook : event.sync_to_outlook;
    if (shouldSyncOutlook) {
      try {
        const microsoftService = require('./microsoft.service');
        if (event.outlook_event_id) {
          const addTeamsMeeting = data.add_teams_meeting === true && !event.teams_meeting_link;
          const outlookResult = await microsoftService.updateOutlookEvent(
            event.created_by, event.outlook_event_id, { ...event.toJSON(), ...cleanData }, addTeamsMeeting
          );
          if (outlookResult.teamsMeetingLink && !event.teams_meeting_link) {
            await event.update({ teams_meeting_link: outlookResult.teamsMeetingLink });
          }
        } else {
          const addTeamsMeeting = data.add_teams_meeting === true;
          const outlookResult = await microsoftService.createOutlookEvent(
            event.created_by, { ...event.toJSON(), ...cleanData }, addTeamsMeeting
          );
          await event.update({
            outlook_event_id: outlookResult.outlookEventId,
            teams_meeting_link: outlookResult.teamsMeetingLink,
            sync_to_outlook: true,
          });
        }
      } catch (outlookErr) {
        console.error('Outlook Calendar sync failed during update:', outlookErr.message);
      }
    }

    // Fetch the updated event with relations
    const fullEvent = await calendarService.getById(id);

    // Send updated invitations asynchronously
    if (sendInvitations && fullEvent.attendees && fullEvent.attendees.length > 0) {
      sendEventInvitations(fullEvent, event.created_by, true).catch((err) => {
        console.error('Failed to send updated calendar invitations:', err);
      });
    }

    return fullEvent;
  },

  /**
   * Soft delete a calendar event
   * @param {number} id - Event ID
   * @returns {Promise<Object>} Deleted event info
   */
  delete: async (id) => {
    const { CalendarEvent } = require('../models');

    const event = await CalendarEvent.findByPk(id);

    if (!event) {
      throw ApiError.notFound('Calendar event not found');
    }

    // Delete from Google Calendar if synced
    if (event.sync_to_google && event.google_event_id) {
      try {
        const googleService = require('./google.service');
        await googleService.deleteGoogleEvent(event.created_by, event.google_event_id);
      } catch (googleErr) {
        console.error('Google Calendar delete sync failed:', googleErr.message);
      }
    }

    // Delete from Outlook Calendar if synced
    if (event.sync_to_outlook && event.outlook_event_id) {
      try {
        const microsoftService = require('./microsoft.service');
        await microsoftService.deleteOutlookEvent(event.created_by, event.outlook_event_id);
      } catch (outlookErr) {
        console.error('Outlook Calendar delete sync failed:', outlookErr.message);
      }
    }

    await event.destroy();

    return { id: event.id };
  },

  /**
   * Get all events in a date range without pagination (for calendar rendering)
   * @param {string} startDate - Start date
   * @param {string} endDate - End date
   * @returns {Promise<Array>} Events in the date range
   */
  getByDateRange: async (startDate, endDate) => {
    const { CalendarEvent, User, Contact, Company, Deal } = require('../models');

    const events = await CalendarEvent.findAll({
      where: {
        start_time: {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate)
        }
      },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Contact,
          as: 'contact',
          attributes: ['id', 'first_name', 'last_name']
        },
        {
          model: Company,
          as: 'company',
          attributes: ['id', 'name']
        },
        {
          model: Deal,
          as: 'deal',
          attributes: ['id', 'title']
        }
      ],
      order: [['start_time', 'ASC']]
    });

    return events;
  }
};

module.exports = calendarService;
