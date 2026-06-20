// Application Configuration
module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3001,
    host: process.env.HOST || 'localhost',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }
  },

  // Database Configuration
  database: {
    file: process.env.DB_FILE || './src/server/data/pcbuilder.db',
    schema: './src/server/data/schema.sql',
    compatibility: './src/server/data/compatibility.json'
  },

  // Admin Configuration
  admin: {
    token: process.env.ADMIN_TOKEN || 'dev-admin',
    sessionTimeout: 24 * 60 * 60 * 1000 // 24 hours
  },

  // Application Settings
  app: {
    name: 'PC Builder',
    version: '1.0.0',
    description: 'Custom PC Builder with compatibility checking',
    author: 'Ujair Inamdar',
    email: 'inamdarujair.com'
  },

  // Feature Flags
  features: {
    suggestions: true,
    compatibility: true,
    adminPanel: true,
    upgradeSuggestions: true,
    budgetValidation: true
  },

  // UI Configuration
  ui: {
    theme: 'cyberpunk',
    animations: true,
    responsive: true,
    maxComponentsPerCategory: 100
  },

  // Budget Configuration
  budget: {
    min: 20000, // Minimum budget in INR
    max: 1000000, // Maximum budget in INR
    default: 50000, // Default budget in INR
    currency: 'INR',
    symbol: '₹'
  },

  // Component Categories
  categories: {
    primary: ['CPU', 'Motherboard', 'GPU', 'PSU', 'RAM'],
    secondary: ['Storage', 'Case', 'Cooling', 'Peripherals'],
    all: ['CPU', 'Motherboard', 'GPU', 'PSU', 'RAM', 'Storage', 'Case', 'Cooling', 'Peripherals']
  },

  // Validation Rules
  validation: {
    requiredComponents: ['CPU', 'Motherboard', 'PSU'],
    compatibilityCheck: true,
    budgetCheck: true,
    socketMatching: true
  }
};
