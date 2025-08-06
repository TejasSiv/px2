const Joi = require('joi');
const logger = require('../utils/logger');

// Define waypoint schema
const waypointSchema = Joi.object({
    id: Joi.string().uuid().optional(),
    position: Joi.object({
        lat: Joi.number().min(-90).max(90).required(),
        lng: Joi.number().min(-180).max(180).required(),
        alt: Joi.number().min(0).max(1000).required()
    }).required(),
    action: Joi.string().valid('pickup', 'delivery', 'hover', 'survey', 'navigation', 'landing', 'takeoff').required(),
    hoverTime: Joi.number().min(0).optional(),
    notes: Joi.string().max(500).optional(),
    parameters: Joi.object().optional(),
    estimatedTime: Joi.number().min(0).optional()
});

// Define mission schema for creation
const missionCreationSchema = Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(1000).optional(),
    priority: Joi.number().integer().min(1).max(10).default(5),
    waypoints: Joi.array().items(waypointSchema).min(1).required(),
    assignedDrone: Joi.string().uuid().optional(),
    estimatedDuration: Joi.number().min(0).optional(),
    metadata: Joi.object().optional()
});

// Define mission schema for updates
const missionUpdateSchema = Joi.object({
    name: Joi.string().min(1).max(100).optional(),
    description: Joi.string().max(1000).optional(),
    status: Joi.string().valid('pending', 'active', 'paused', 'completed', 'failed', 'cancelled').optional(),
    priority: Joi.number().integer().min(1).max(10).optional(),
    waypoints: Joi.array().items(waypointSchema).optional(),
    assignedDrone: Joi.string().uuid().allow(null).optional(),
    progress: Joi.number().min(0).max(100).optional(),
    currentWaypoint: Joi.number().integer().min(0).optional(),
    estimatedDuration: Joi.number().min(0).optional(),
    actualDuration: Joi.number().min(0).optional(),
    metadata: Joi.object().optional()
});

// Define progress update schema
const progressUpdateSchema = Joi.object({
    progress: Joi.number().min(0).max(100).required(),
    currentWaypoint: Joi.number().integer().min(0).optional()
});

// Define assignment schema
const assignmentSchema = Joi.object({
    droneId: Joi.string().uuid().required()
});

// Define query filters schema
const queryFiltersSchema = Joi.object({
    status: Joi.string().valid('pending', 'active', 'paused', 'completed', 'failed', 'cancelled').optional(),
    assignedDrone: Joi.string().uuid().optional(),
    priority: Joi.number().integer().min(1).max(10).optional(),
    sortBy: Joi.string().valid('created_at', 'name', 'priority', 'status', 'updated_at').default('created_at'),
    sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
    limit: Joi.number().integer().min(1).max(100).default(50),
    offset: Joi.number().integer().min(0).default(0)
});

/**
 * Validate mission data for creation
 */
const validateMissionData = (data) => {
    try {
        const { error, value } = missionCreationSchema.validate(data, { 
            abortEarly: false,
            stripUnknown: true 
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            logger.logValidationError('mission_creation', data, errors);

            return {
                isValid: false,
                errors,
                data: null
            };
        }

        // Additional business logic validations
        const businessErrors = [];

        // Validate waypoint sequences
        if (value.waypoints && value.waypoints.length > 1) {
            for (let i = 1; i < value.waypoints.length; i++) {
                const prev = value.waypoints[i - 1];
                const curr = value.waypoints[i];
                
                // Check for reasonable distance between waypoints (max 50km)
                const distance = calculateDistance(prev.position, curr.position);
                if (distance > 50000) {
                    businessErrors.push({
                        field: `waypoints.${i}.position`,
                        message: `Waypoint ${i + 1} is too far from previous waypoint (max 50km allowed)`,
                        value: curr.position
                    });
                }
            }
        }

        // Validate hover action has hover time
        if (value.waypoints) {
            value.waypoints.forEach((waypoint, index) => {
                if (waypoint.action === 'hover' && (!waypoint.hoverTime || waypoint.hoverTime <= 0)) {
                    businessErrors.push({
                        field: `waypoints.${index}.hoverTime`,
                        message: 'Hover action requires a positive hover time',
                        value: waypoint.hoverTime
                    });
                }
            });
        }

        if (businessErrors.length > 0) {
            logger.logValidationError('mission_business_rules', data, businessErrors);
            return {
                isValid: false,
                errors: businessErrors,
                data: null
            };
        }

        return {
            isValid: true,
            errors: [],
            data: value
        };

    } catch (error) {
        logger.error('Error in mission validation:', error);
        return {
            isValid: false,
            errors: [{ field: 'general', message: 'Validation error occurred', value: null }],
            data: null
        };
    }
};

/**
 * Validate mission data for updates
 */
const validateUpdateData = (data) => {
    try {
        const { error, value } = missionUpdateSchema.validate(data, { 
            abortEarly: false,
            stripUnknown: true 
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            logger.logValidationError('mission_update', data, errors);

            return {
                isValid: false,
                errors,
                data: null
            };
        }

        return {
            isValid: true,
            errors: [],
            data: value
        };

    } catch (error) {
        logger.error('Error in mission update validation:', error);
        return {
            isValid: false,
            errors: [{ field: 'general', message: 'Validation error occurred', value: null }],
            data: null
        };
    }
};

/**
 * Validate progress update data
 */
const validateProgressUpdate = (data) => {
    try {
        const { error, value } = progressUpdateSchema.validate(data, { 
            abortEarly: false,
            stripUnknown: true 
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            return {
                isValid: false,
                errors,
                data: null
            };
        }

        return {
            isValid: true,
            errors: [],
            data: value
        };

    } catch (error) {
        logger.error('Error in progress update validation:', error);
        return {
            isValid: false,
            errors: [{ field: 'general', message: 'Validation error occurred', value: null }],
            data: null
        };
    }
};

/**
 * Validate assignment data
 */
const validateAssignment = (data) => {
    try {
        const { error, value } = assignmentSchema.validate(data, { 
            abortEarly: false,
            stripUnknown: true 
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            return {
                isValid: false,
                errors,
                data: null
            };
        }

        return {
            isValid: true,
            errors: [],
            data: value
        };

    } catch (error) {
        logger.error('Error in assignment validation:', error);
        return {
            isValid: false,
            errors: [{ field: 'general', message: 'Validation error occurred', value: null }],
            data: null
        };
    }
};

/**
 * Validate query filters
 */
const validateQueryFilters = (data) => {
    try {
        const { error, value } = queryFiltersSchema.validate(data, { 
            abortEarly: false,
            stripUnknown: true 
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            return {
                isValid: false,
                errors,
                data: null
            };
        }

        return {
            isValid: true,
            errors: [],
            data: value
        };

    } catch (error) {
        logger.error('Error in query filters validation:', error);
        return {
            isValid: false,
            errors: [{ field: 'general', message: 'Validation error occurred', value: null }],
            data: null
        };
    }
};

/**
 * Calculate distance between two positions in meters
 */
const calculateDistance = (pos1, pos2) => {
    const R = 6371000; // Earth's radius in meters
    const lat1Rad = pos1.lat * Math.PI / 180;
    const lat2Rad = pos2.lat * Math.PI / 180;
    const deltaLat = (pos2.lat - pos1.lat) * Math.PI / 180;
    const deltaLng = (pos2.lng - pos1.lng) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c;
    const altitudeDiff = Math.abs(pos2.alt - pos1.alt);
    
    return Math.sqrt(distance * distance + altitudeDiff * altitudeDiff);
};

/**
 * Middleware for validating mission creation requests
 */
const validateMissionCreation = (req, res, next) => {
    const result = validateMissionData(req.body);
    if (!result.isValid) {
        return res.status(400).json({
            error: 'Validation failed',
            details: result.errors,
            timestamp: new Date().toISOString()
        });
    }
    req.validatedData = result.data;
    next();
};

/**
 * Middleware for validating mission update requests
 */
const validateMissionUpdate = (req, res, next) => {
    const result = validateUpdateData(req.body);
    if (!result.isValid) {
        return res.status(400).json({
            error: 'Validation failed',
            details: result.errors,
            timestamp: new Date().toISOString()
        });
    }
    req.validatedData = result.data;
    next();
};

module.exports = {
    validateMissionData,
    validateUpdateData,
    validateProgressUpdate,
    validateAssignment,
    validateQueryFilters,
    calculateDistance,
    validateMissionCreation,
    validateMissionUpdate,
    // Schemas for external use
    schemas: {
        missionCreationSchema,
        missionUpdateSchema,
        progressUpdateSchema,
        assignmentSchema,
        queryFiltersSchema,
        waypointSchema
    }
};