require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { sequelize, Role, Permission } = require('../models');

const MODULES = ['users', 'roles', 'settings', 'contacts', 'leads', 'deals', 'companies', 'activities', 'dashboard', 'reports', 'tasks', 'documents', 'quotes', 'invoices', 'payments', 'calendar', 'email_templates', 'email_logs', 'data_exports', 'imports', 'email_campaigns', 'api_keys', 'webhooks', 'knowledge_base', 'workflows'];
const ACTIONS = ['create', 'read', 'update', 'delete', 'export', 'import'];

const ROLES = [
  { name: 'Super Admin', description: 'Full access to all features and settings', is_system: true },
  { name: 'Admin', description: 'Full access except system configuration', is_system: true },
  { name: 'Manager', description: 'Manage team members and their records', is_system: true },
  { name: 'Sales Rep', description: 'Manage own contacts, leads, and deals', is_system: false },
  { name: 'Support Agent', description: 'View contacts and manage support tickets', is_system: false },
  { name: 'Viewer', description: 'Read-only access to CRM data', is_system: false },
];

// Define which permissions each role gets
const ROLE_PERMISSIONS = {
  'Super Admin': '*', // All permissions
  'Admin': {
    users: ['create', 'read', 'update', 'delete', 'export', 'import'],
    roles: ['create', 'read', 'update', 'delete'],
    settings: ['read', 'update'],
    contacts: ['create', 'read', 'update', 'delete', 'export', 'import'],
    leads: ['create', 'read', 'update', 'delete', 'export', 'import'],
    deals: ['create', 'read', 'update', 'delete', 'export', 'import'],
    companies: ['create', 'read', 'update', 'delete', 'export', 'import'],
    activities: ['create', 'read', 'update', 'delete'],
    dashboard: ['read'],
    reports: ['create', 'read', 'export'],
    tasks: ['create', 'read', 'update', 'delete'],
    documents: ['create', 'read', 'delete'],
    quotes: ['create', 'read', 'update', 'delete'],
    invoices: ['create', 'read', 'update', 'delete'],
    payments: ['create', 'read', 'update', 'delete'],
    calendar: ['create', 'read', 'update', 'delete'],
    email_templates: ['create', 'read', 'update', 'delete'],
    email_logs: ['read'],
    data_exports: ['create', 'read'],
    imports: ['create', 'read'],
    email_campaigns: ['create', 'read', 'update', 'delete'],
    api_keys: ['create', 'read', 'delete'],
    webhooks: ['create', 'read', 'update', 'delete'],
    knowledge_base: ['create', 'read', 'update', 'delete'],
    workflows: ['create', 'read', 'update', 'delete'],
  },
  'Manager': {
    users: ['read'],
    roles: ['read'],
    settings: ['read'],
    contacts: ['create', 'read', 'update', 'delete', 'export'],
    leads: ['create', 'read', 'update', 'delete', 'export'],
    deals: ['create', 'read', 'update', 'delete', 'export'],
    companies: ['create', 'read', 'update', 'delete', 'export'],
    activities: ['create', 'read', 'update', 'delete'],
    dashboard: ['read'],
    reports: ['create', 'read', 'export'],
    tasks: ['create', 'read', 'update', 'delete'],
    documents: ['create', 'read', 'delete'],
    quotes: ['create', 'read', 'update', 'delete'],
    invoices: ['create', 'read', 'update', 'delete'],
    payments: ['create', 'read', 'update', 'delete'],
    calendar: ['create', 'read', 'update', 'delete'],
    email_templates: ['read'],
    email_logs: ['read'],
    data_exports: ['create', 'read'],
    imports: ['create', 'read'],
    email_campaigns: ['create', 'read', 'update'],
    knowledge_base: ['create', 'read', 'update', 'delete'],
    workflows: ['create', 'read'],
  },
  'Sales Rep': {
    contacts: ['create', 'read', 'update'],
    leads: ['create', 'read', 'update'],
    deals: ['create', 'read', 'update'],
    companies: ['read'],
    activities: ['create', 'read', 'update'],
    dashboard: ['read'],
    reports: ['read'],
    tasks: ['create', 'read', 'update'],
    documents: ['create', 'read'],
    quotes: ['create', 'read', 'update'],
    invoices: ['read'],
    payments: ['read'],
    calendar: ['create', 'read', 'update'],
    email_templates: ['read'],
    imports: ['create', 'read'],
    knowledge_base: ['read'],
  },
  'Support Agent': {
    contacts: ['read', 'update'],
    companies: ['read'],
    activities: ['create', 'read'],
    dashboard: ['read'],
    tasks: ['create', 'read'],
    calendar: ['read'],
    knowledge_base: ['read'],
  },
  'Viewer': {
    contacts: ['read'],
    leads: ['read'],
    deals: ['read'],
    companies: ['read'],
    activities: ['read'],
    dashboard: ['read'],
    reports: ['read'],
    tasks: ['read'],
    quotes: ['read'],
    invoices: ['read'],
    calendar: ['read'],
    knowledge_base: ['read'],
  },
};

const seed = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    await sequelize.sync({ force: true });
    console.log('Tables created.');

    // Create permissions
    const permissionRecords = [];
    for (const module of MODULES) {
      for (const action of ACTIONS) {
        permissionRecords.push({
          module,
          action,
          description: `${action.charAt(0).toUpperCase() + action.slice(1)} ${module}`,
        });
      }
    }

    const permissions = await Permission.bulkCreate(permissionRecords);
    console.log(`Created ${permissions.length} permissions.`);

    // Create roles
    for (const roleData of ROLES) {
      const role = await Role.create(roleData);

      const rolePerm = ROLE_PERMISSIONS[roleData.name];
      if (rolePerm === '*') {
        // Super Admin gets all permissions
        await role.setPermissions(permissions);
      } else if (rolePerm) {
        const permIds = [];
        for (const [module, actions] of Object.entries(rolePerm)) {
          for (const action of actions) {
            const perm = permissions.find(p => p.module === module && p.action === action);
            if (perm) permIds.push(perm.id);
          }
        }
        await role.setPermissions(permIds);
      }

      console.log(`Created role: ${roleData.name}`);
    }

    // Create default Super Admin user
    const bcrypt = require('bcryptjs');
    const { User } = require('../models');
    const password_hash = await bcrypt.hash('Admin@123', 12);

    const admin = await User.create({
      email: 'admin@facilis.com',
      password_hash,
      first_name: 'Super',
      last_name: 'Admin',
      status: 'active',
      email_verified: true,
    });

    const superAdminRole = await Role.findOne({ where: { name: 'Super Admin' } });
    await admin.addRole(superAdminRole);
    console.log('Created default admin: admin@facilis.com / Admin@123');

    // Create default pipeline with stages
    const { Pipeline, PipelineStage } = require('../models');
    const pipeline = await Pipeline.create({
      name: 'Default Sales Pipeline',
      is_default: true
    });

    const stages = [
      { pipeline_id: pipeline.id, name: 'Qualification', position: 1, color: '#3B82F6', probability: 10 },
      { pipeline_id: pipeline.id, name: 'Needs Analysis', position: 2, color: '#8B5CF6', probability: 25 },
      { pipeline_id: pipeline.id, name: 'Proposal', position: 3, color: '#F59E0B', probability: 50 },
      { pipeline_id: pipeline.id, name: 'Negotiation', position: 4, color: '#F97316', probability: 75 },
      { pipeline_id: pipeline.id, name: 'Closed Won', position: 5, color: '#22C55E', probability: 100 },
      { pipeline_id: pipeline.id, name: 'Closed Lost', position: 6, color: '#EF4444', probability: 0 },
    ];

    await PipelineStage.bulkCreate(stages);
    console.log('Created default pipeline with 6 stages.');

    console.log('\nSeeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
};

seed();
