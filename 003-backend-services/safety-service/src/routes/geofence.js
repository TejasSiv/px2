const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Middleware to get geofence monitor instance
const getGeofenceMonitor = (req, res, next) => {
  req.geofenceMonitor = req.app.get('safetyMonitor')?.getGeofenceMonitor();
  if (!req.geofenceMonitor) {
    return res.status(503).json({
      status: 'error',
      message: 'Geofence monitor not available'
    });
  }
  next();
};

// Get all geofences
router.get('/', getGeofenceMonitor, async (req, res) => {
  try {
    const geofences = await req.geofenceMonitor.getAllGeofences();
    
    res.json({
      status: 'success',
      data: {
        geofences,
        count: geofences.length
      },
      meta: {
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('Failed to get geofences:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve geofences',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get specific geofence by ID
router.get('/:id', getGeofenceMonitor, async (req, res) => {
  try {
    const geofences = await req.geofenceMonitor.getAllGeofences();
    const geofence = geofences.find(g => g.id === req.params.id);
    
    if (!geofence) {
      return res.status(404).json({
        status: 'error',
        message: 'Geofence not found'
      });
    }
    
    res.json({
      status: 'success',
      data: {
        geofence
      },
      meta: {
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('Failed to get geofence:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve geofence',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create new geofence
router.post('/', getGeofenceMonitor, async (req, res) => {
  try {
    const { name, type, coordinates, altitudeMin, altitudeMax, restrictionType, severity, description } = req.body;
    
    // Validation
    if (!name || !type || !coordinates || !restrictionType) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: name, type, coordinates, restrictionType'
      });
    }
    
    if (!['inclusion', 'exclusion', 'emergency'].includes(type)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid type. Must be: inclusion, exclusion, or emergency'
      });
    }
    
    if (!['no_fly', 'restricted', 'emergency_only', 'warning_only'].includes(restrictionType)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid restrictionType. Must be: no_fly, restricted, emergency_only, or warning_only'
      });
    }
    
    if (severity && !['critical', 'warning', 'info'].includes(severity)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid severity. Must be: critical, warning, or info'
      });
    }
    
    if (!Array.isArray(coordinates) || coordinates.length < 3) {
      return res.status(400).json({
        status: 'error',
        message: 'Coordinates must be an array of at least 3 points with lat/lng properties'
      });
    }
    
    // Validate coordinate points
    for (const coord of coordinates) {
      if (typeof coord.lat !== 'number' || typeof coord.lng !== 'number') {
        return res.status(400).json({
          status: 'error',
          message: 'Each coordinate must have numeric lat and lng properties'
        });
      }
      if (coord.lat < -90 || coord.lat > 90 || coord.lng < -180 || coord.lng > 180) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid coordinate values. Latitude must be -90 to 90, longitude -180 to 180'
        });
      }
    }
    
    const geofenceData = {
      name,
      type,
      coordinates,
      altitudeMin: altitudeMin ? parseFloat(altitudeMin) : null,
      altitudeMax: altitudeMax ? parseFloat(altitudeMax) : null,
      restrictionType,
      severity: severity || 'warning',
      description,
      createdBy: req.headers['x-user-id'] || 'api-user' // Future authentication
    };
    
    const geofence = await req.geofenceMonitor.createGeofence(geofenceData);
    
    logger.info('Geofence created via API', { 
      id: geofence.id, 
      name: geofence.name, 
      createdBy: geofenceData.createdBy 
    });
    
    res.status(201).json({
      status: 'success',
      data: {
        geofence
      },
      meta: {
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('Failed to create geofence:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create geofence',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Update geofence
router.put('/:id', getGeofenceMonitor, async (req, res) => {
  try {
    const geofenceId = req.params.id;
    const updates = req.body;
    
    // Validate update fields if provided
    if (updates.type && !['inclusion', 'exclusion', 'emergency'].includes(updates.type)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid type. Must be: inclusion, exclusion, or emergency'
      });
    }
    
    if (updates.restrictionType && !['no_fly', 'restricted', 'emergency_only', 'warning_only'].includes(updates.restrictionType)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid restrictionType. Must be: no_fly, restricted, emergency_only, or warning_only'
      });
    }
    
    if (updates.severity && !['critical', 'warning', 'info'].includes(updates.severity)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid severity. Must be: critical, warning, or info'
      });
    }
    
    if (updates.coordinates) {
      if (!Array.isArray(updates.coordinates) || updates.coordinates.length < 3) {
        return res.status(400).json({
          status: 'error',
          message: 'Coordinates must be an array of at least 3 points with lat/lng properties'
        });
      }
      
      for (const coord of updates.coordinates) {
        if (typeof coord.lat !== 'number' || typeof coord.lng !== 'number') {
          return res.status(400).json({
            status: 'error',
            message: 'Each coordinate must have numeric lat and lng properties'
          });
        }
      }
    }
    
    const geofence = await req.geofenceMonitor.updateGeofence(geofenceId, updates);
    
    logger.info('Geofence updated via API', { 
      id: geofenceId, 
      updatedBy: req.headers['x-user-id'] || 'api-user' 
    });
    
    res.json({
      status: 'success',
      data: {
        geofence
      },
      meta: {
        timestamp: Date.now()
      }
    });
  } catch (error) {
    if (error.message === 'Geofence not found') {
      return res.status(404).json({
        status: 'error',
        message: 'Geofence not found'
      });
    }
    
    logger.error('Failed to update geofence:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update geofence',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Delete geofence
router.delete('/:id', getGeofenceMonitor, async (req, res) => {
  try {
    const geofenceId = req.params.id;
    
    const geofence = await req.geofenceMonitor.deleteGeofence(geofenceId);
    
    logger.info('Geofence deleted via API', { 
      id: geofenceId, 
      deletedBy: req.headers['x-user-id'] || 'api-user' 
    });
    
    res.json({
      status: 'success',
      data: {
        geofence,
        message: 'Geofence deleted successfully'
      },
      meta: {
        timestamp: Date.now()
      }
    });
  } catch (error) {
    if (error.message === 'Geofence not found') {
      return res.status(404).json({
        status: 'error',
        message: 'Geofence not found'
      });
    }
    
    logger.error('Failed to delete geofence:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete geofence',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get geofence violations
router.get('/:id/violations', getGeofenceMonitor, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const violations = await req.geofenceMonitor.getGeofenceViolations(null, limit);
    
    // Filter violations for this geofence
    const geofenceViolations = violations.filter(v => v.geofence_id === req.params.id);
    
    res.json({
      status: 'success',
      data: {
        violations: geofenceViolations,
        count: geofenceViolations.length
      },
      meta: {
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('Failed to get geofence violations:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve geofence violations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all geofence violations
router.get('/violations/all', getGeofenceMonitor, async (req, res) => {
  try {
    const droneId = req.query.drone_id || null;
    const limit = parseInt(req.query.limit) || 100;
    
    const violations = await req.geofenceMonitor.getGeofenceViolations(droneId, limit);
    
    res.json({
      status: 'success',
      data: {
        violations,
        count: violations.length,
        filters: {
          droneId,
          limit
        }
      },
      meta: {
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('Failed to get geofence violations:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve geofence violations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get geofence monitoring statistics
router.get('/monitor/stats', getGeofenceMonitor, async (req, res) => {
  try {
    const stats = req.geofenceMonitor.getMonitoringStats();
    
    res.json({
      status: 'success',
      data: {
        stats
      },
      meta: {
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('Failed to get geofence monitoring stats:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve monitoring statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Reload geofences (useful after direct database changes)
router.post('/reload', getGeofenceMonitor, async (req, res) => {
  try {
    await req.geofenceMonitor.loadActiveGeofences();
    const stats = req.geofenceMonitor.getMonitoringStats();
    
    logger.info('Geofences reloaded via API', { 
      activeGeofences: stats.activeGeofences,
      reloadedBy: req.headers['x-user-id'] || 'api-user' 
    });
    
    res.json({
      status: 'success',
      data: {
        message: 'Geofences reloaded successfully',
        activeGeofences: stats.activeGeofences
      },
      meta: {
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('Failed to reload geofences:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reload geofences',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;