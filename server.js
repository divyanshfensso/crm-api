require('dotenv').config();

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const corsConfig = require('./src/config/cors');
const { sequelize } = require('./src/models');
const routes = require('./src/routes');
const { errorHandler } = require('./src/middleware/errorHandler');
const { setupCronJobs } = require('./src/services/workflow-cron.service');
const { setupWebhookRetryCron } = require('./src/services/webhook-retry.cron');
const { setupNotificationCron } = require('./src/services/notification-cron.service');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors(corsConfig));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static file serving for uploads
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Facilis CRM API is running', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api', routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use(errorHandler);

// Database sync and server start
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully.');

    if (process.env.NODE_ENV === 'development') {
      // Only verify tables exist by default (fast startup)
      // Use SYNC_ALTER=true npm start when you change model schemas
      const syncOptions = process.env.SYNC_ALTER === 'true' ? { alter: true } : {};
      await sequelize.sync(syncOptions);
      console.log('Database synced.');
    }

    // Start cron jobs
    setupCronJobs();
    setupWebhookRetryCron();
    setupNotificationCron();

    app.listen(PORT, () => {
      console.log(`Facilis CRM API running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
