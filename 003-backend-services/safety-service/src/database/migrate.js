const { query, connectDB, closeDB } = require('./connection');
const logger = require('../utils/logger');

const migrations = [
  {
    version: 1,
    name: 'create_safety_alerts_table',
    sql: `
      CREATE TABLE IF NOT EXISTS safety_alerts (
        id VARCHAR(36) PRIMARY KEY,
        drone_id VARCHAR(50),
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'general',
        alert_data JSONB DEFAULT '{}',
        resolved BOOLEAN DEFAULT FALSE,
        acknowledged BOOLEAN DEFAULT FALSE,
        source VARCHAR(20) DEFAULT 'system',
        acknowledged_by VARCHAR(100),
        acknowledged_at TIMESTAMP,
        resolved_by VARCHAR(100),
        resolved_at TIMESTAMP,
        resolution TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_safety_alerts_drone_id ON safety_alerts(drone_id);
      CREATE INDEX IF NOT EXISTS idx_safety_alerts_severity ON safety_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_safety_alerts_resolved ON safety_alerts(resolved);
      CREATE INDEX IF NOT EXISTS idx_safety_alerts_created_at ON safety_alerts(created_at);
      CREATE INDEX IF NOT EXISTS idx_safety_alerts_type ON safety_alerts(type);
    `
  },
  {
    version: 2,
    name: 'create_emergency_protocols_table',
    sql: `
      CREATE TABLE IF NOT EXISTS emergency_protocols (
        id VARCHAR(36) PRIMARY KEY,
        drone_id VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('warning', 'critical')),
        status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'resolved', 'timeout')),
        initiated_at TIMESTAMP NOT NULL,
        alert_data JSONB DEFAULT '{}',
        actions JSONB DEFAULT '[]',
        resolution JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_emergency_protocols_drone_id ON emergency_protocols(drone_id);
      CREATE INDEX IF NOT EXISTS idx_emergency_protocols_status ON emergency_protocols(status);
      CREATE INDEX IF NOT EXISTS idx_emergency_protocols_initiated_at ON emergency_protocols(initiated_at);
      CREATE INDEX IF NOT EXISTS idx_emergency_protocols_type ON emergency_protocols(type);
    `
  },
  {
    version: 3,
    name: 'create_battery_monitoring_history_table',
    sql: `
      CREATE TABLE IF NOT EXISTS battery_monitoring_history (
        id SERIAL PRIMARY KEY,
        drone_id VARCHAR(50) NOT NULL,
        battery_level INTEGER NOT NULL,
        battery_voltage DECIMAL(5,2),
        drone_status VARCHAR(20),
        position_lat DECIMAL(10, 8),
        position_lng DECIMAL(11, 8),
        position_alt DECIMAL(8, 2),
        in_flight BOOLEAN DEFAULT FALSE,
        safety_level VARCHAR(20) CHECK (safety_level IN ('safe', 'caution', 'warning', 'critical')),
        alert_generated BOOLEAN DEFAULT FALSE,
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_battery_history_drone_id ON battery_monitoring_history(drone_id);
      CREATE INDEX IF NOT EXISTS idx_battery_history_recorded_at ON battery_monitoring_history(recorded_at);
      CREATE INDEX IF NOT EXISTS idx_battery_history_safety_level ON battery_monitoring_history(safety_level);
      CREATE INDEX IF NOT EXISTS idx_battery_history_battery_level ON battery_monitoring_history(battery_level);
    `
  },
  {
    version: 4,
    name: 'create_safety_thresholds_table',
    sql: `
      CREATE TABLE IF NOT EXISTS safety_thresholds (
        id SERIAL PRIMARY KEY,
        parameter_name VARCHAR(50) NOT NULL UNIQUE,
        parameter_value DECIMAL(10,2) NOT NULL,
        unit VARCHAR(20),
        description TEXT,
        category VARCHAR(30) DEFAULT 'general',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO safety_thresholds (parameter_name, parameter_value, unit, description, category)
      VALUES 
        ('battery_emergency_threshold', 10, '%', 'Battery level requiring immediate emergency landing', 'battery'),
        ('battery_critical_threshold', 15, '%', 'Battery level requiring immediate return to base', 'battery'),
        ('battery_warning_threshold', 25, '%', 'Battery level triggering low battery warning', 'battery'),
        ('battery_low_threshold', 35, '%', 'Battery level requiring monitoring', 'battery'),
        ('max_flight_time', 1800, 'seconds', 'Maximum continuous flight time before warning', 'flight'),
        ('min_signal_strength', 50, '%', 'Minimum acceptable signal strength', 'communication'),
        ('emergency_response_timeout', 180, 'seconds', 'Time limit for emergency response', 'emergency')
      ON CONFLICT (parameter_name) DO NOTHING;
    `
  },
  {
    version: 5,
    name: 'create_safety_system_logs_table',
    sql: `
      CREATE TABLE IF NOT EXISTS safety_system_logs (
        id SERIAL PRIMARY KEY,
        log_level VARCHAR(10) NOT NULL CHECK (log_level IN ('info', 'warn', 'error', 'debug')),
        category VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        drone_id VARCHAR(50),
        service_name VARCHAR(50) DEFAULT 'safety-service',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_safety_logs_level ON safety_system_logs(log_level);
      CREATE INDEX IF NOT EXISTS idx_safety_logs_category ON safety_system_logs(category);
      CREATE INDEX IF NOT EXISTS idx_safety_logs_created_at ON safety_system_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_safety_logs_drone_id ON safety_system_logs(drone_id);
    `
  }
];

async function getCurrentVersion() {
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'safety_migration_version'
    `);
    
    if (result.rows.length === 0) {
      // Create migration version table
      await query(`
        CREATE TABLE safety_migration_version (
          version INTEGER NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      return 0;
    }
    
    const versionResult = await query('SELECT MAX(version) as version FROM safety_migration_version');
    return versionResult.rows[0].version || 0;
  } catch (error) {
    logger.error('Failed to get current migration version:', error);
    throw error;
  }
}

async function applyMigration(migration) {
  try {
    logger.info(`Applying migration ${migration.version}: ${migration.name}`);
    
    // Execute migration SQL
    await query(migration.sql);
    
    // Record migration
    await query(
      'INSERT INTO safety_migration_version (version) VALUES ($1)',
      [migration.version]
    );
    
    logger.info(`Migration ${migration.version} applied successfully`);
  } catch (error) {
    logger.error(`Failed to apply migration ${migration.version}:`, error);
    throw error;
  }
}

async function runMigrations() {
  try {
    logger.info('Starting safety service database migrations...');
    
    // Connect to database
    await connectDB();
    
    // Get current version
    const currentVersion = await getCurrentVersion();
    logger.info(`Current migration version: ${currentVersion}`);
    
    // Find migrations to apply
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    
    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return;
    }
    
    logger.info(`Found ${pendingMigrations.length} pending migrations`);
    
    // Apply migrations in order
    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }
    
    logger.info('All migrations applied successfully');
    
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDB();
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('Migration process completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration process failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runMigrations,
  migrations
};