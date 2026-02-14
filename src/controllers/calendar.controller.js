const calendarService = require('../services/calendar.service');
const { asyncHandler } = require('../middleware/errorHandler');
const { createAuditLog } = require('../middleware/audit');
const ApiResponse = require('../utils/apiResponse');

const calendarController = {
  /**
   * Get all calendar events with pagination, search, and filters
   * GET /api/calendar
   */
  getAll: asyncHandler(async (req, res) => {
    const result = await calendarService.getAll(req.query);
    res.json(ApiResponse.paginated(
      'Calendar events retrieved successfully',
      result.data,
      result.meta.page,
      result.meta.limit,
      result.meta.total
    ));
  }),

  /**
   * Get calendar event by ID
   * GET /api/calendar/:id
   */
  getById: asyncHandler(async (req, res) => {
    const event = await calendarService.getById(req.params.id);
    res.json(ApiResponse.success('Calendar event retrieved successfully', { event }));
  }),

  /**
   * Create a new calendar event
   * POST /api/calendar
   */
  create: asyncHandler(async (req, res) => {
    const event = await calendarService.create(req.body, req.user.id);

    await createAuditLog(
      req.user.id,
      'CREATE',
      'CALENDAR_EVENT',
      event.id,
      null,
      req.body,
      req
    );

    res.status(201).json(ApiResponse.created('Calendar event created successfully', { event }));
  }),

  /**
   * Update an existing calendar event
   * PUT /api/calendar/:id
   */
  update: asyncHandler(async (req, res) => {
    const event = await calendarService.update(req.params.id, req.body);

    await createAuditLog(
      req.user.id,
      'UPDATE',
      'CALENDAR_EVENT',
      parseInt(req.params.id),
      null,
      req.body,
      req
    );

    res.json(ApiResponse.success('Calendar event updated successfully', { event }));
  }),

  /**
   * Get Google Calendar events for display alongside Facilis events
   * GET /api/calendar/google-events
   */
  getGoogleEvents: asyncHandler(async (req, res) => {
    const { date_from, date_to } = req.query;
    try {
      const googleService = require('../services/google.service');
      const events = await googleService.pullGoogleEvents(req.user.id, date_from, date_to);
      res.json(ApiResponse.success('Google Calendar events retrieved', { events }));
    } catch (err) {
      res.json(ApiResponse.success('Google Calendar not connected', { events: [] }));
    }
  }),

  /**
   * Delete a calendar event (soft delete)
   * DELETE /api/calendar/:id
   */
  delete: asyncHandler(async (req, res) => {
    const result = await calendarService.delete(req.params.id);

    await createAuditLog(
      req.user.id,
      'DELETE',
      'CALENDAR_EVENT',
      parseInt(req.params.id),
      null,
      null,
      req
    );

    res.json(ApiResponse.success('Calendar event deleted successfully', result));
  })
};

module.exports = calendarController;
