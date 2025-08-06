import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  BoltIcon,
  PlayIcon,
  WrenchScrewdriverIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface Activity {
  id: string;
  type: string;
  drone: string;
  message: string;
  timestamp: Date;
}

interface ActivityFeedProps {
  activities: Activity[];
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  const getActivityConfig = (type: string) => {
    switch (type) {
      case 'mission_complete':
        return {
          icon: CheckCircleIcon,
          color: '#238636',
          bgColor: '#238636',
        };
      case 'mission_start':
        return {
          icon: PlayIcon,
          color: '#1f6feb',
          bgColor: '#1f6feb',
        };
      case 'battery_low':
        return {
          icon: ExclamationTriangleIcon,
          color: '#d29922',
          bgColor: '#d29922',
        };
      case 'charging_start':
        return {
          icon: BoltIcon,
          color: '#d29922',
          bgColor: '#d29922',
        };
      case 'maintenance':
        return {
          icon: WrenchScrewdriverIcon,
          color: '#8b949e',
          bgColor: '#8b949e',
        };
      default:
        return {
          icon: ClockIcon,
          color: '#8b949e',
          bgColor: '#8b949e',
        };
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return timestamp.toLocaleDateString();
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-text-primary">Recent Activity</h3>
        <button className="text-xs text-text-secondary hover:text-text-primary transition-colors">
          View All
        </button>
      </div>

      <div className="space-y-3 max-h-48 overflow-y-auto">
        {activities.map((activity, index) => {
          const config = getActivityConfig(activity.type);
          const ActivityIcon = config.icon;

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-dark-tertiary transition-colors"
            >
              <div 
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
                style={{ backgroundColor: config.bgColor + '20' }}
              >
                <ActivityIcon className="w-3 h-3" style={{ color: config.color }} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-text-primary text-sm font-medium">
                    {activity.drone}
                  </span>
                  <span className="text-text-muted text-xs">
                    {formatTimeAgo(activity.timestamp)}
                  </span>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {activity.message}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {activities.length === 0 && (
        <div className="text-center py-6 text-text-secondary">
          <ClockIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent activity</p>
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;