import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RocketLaunchIcon,
  UserIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import MissionList from '../MissionList';
import AssignmentManager from '../AssignmentManager';
import MissionPanel from '../MissionPanel';

interface MissionControlsProps {
  className?: string;
  onClose?: () => void;
}

type ViewMode = 'panel' | 'list' | 'assignments';

const MissionControls: React.FC<MissionControlsProps> = ({ className = '', onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('panel');

  const viewOptions = [
    { mode: 'panel' as ViewMode, label: 'Panel', icon: ChartBarIcon, description: 'Compact mission overview' },
    { mode: 'list' as ViewMode, label: 'List', icon: RocketLaunchIcon, description: 'All missions list' },
    { mode: 'assignments' as ViewMode, label: 'Assignments', icon: UserIcon, description: 'Mission assignments' }
  ];

  if (!isExpanded) {
    return (
      <div className={`${className}`}>
        {/* Collapsed View - Mission Panel */}
        <MissionPanel compact={true} />
        
        {/* Expand Button */}
        <div className="mt-4 flex justify-center">
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 px-4 py-2 bg-dark-tertiary hover:bg-dark-hover 
                     text-text-primary rounded-lg border border-dark-border transition-colors"
          >
            <Cog6ToothIcon className="w-4 h-4" />
            Mission Controls
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-dark-secondary rounded-lg border border-dark-border shadow-xl
                   w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border">
          <div>
            <h2 className="text-2xl font-bold text-text-primary flex items-center gap-3">
              <RocketLaunchIcon className="w-7 h-7 text-status-active" />
              Mission Control Center
            </h2>
            <p className="text-text-secondary mt-1">
              Manage missions, assignments, and drone operations
            </p>
          </div>

          {/* View Mode Selector */}
          <div className="flex items-center gap-4">
            <div className="flex bg-dark-tertiary rounded-lg p-1">
              {viewOptions.map((option) => (
                <button
                  key={option.mode}
                  onClick={() => setViewMode(option.mode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === option.mode
                      ? 'bg-status-active text-white'
                      : 'text-text-secondary hover:text-text-primary hover:bg-dark-hover'
                  }`}
                  title={option.description}
                >
                  <option.icon className="w-4 h-4" />
                  {option.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (onClose) {
                  onClose();
                } else {
                  setIsExpanded(false);
                }
              }}
              className="p-2 hover:bg-dark-hover rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          <AnimatePresence mode="wait">
            {viewMode === 'panel' && (
              <motion.div
                key="panel"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <MissionPanel className="h-full" />
              </motion.div>
            )}

            {viewMode === 'list' && (
              <motion.div
                key="list"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full overflow-y-auto"
              >
                <MissionList />
              </motion.div>
            )}

            {viewMode === 'assignments' && (
              <motion.div
                key="assignments"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full overflow-y-auto"
              >
                <AssignmentManager />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-dark-border bg-dark-tertiary">
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-status-operational rounded-full"></div>
                <span>Mission Service Connected</span>
              </div>
              <div className="text-text-secondary">
                Last update: {new Date().toLocaleTimeString()}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span>
                Current View: <span className="text-text-primary font-medium">{
                  viewOptions.find(opt => opt.mode === viewMode)?.label
                }</span>
              </span>
              <button
                onClick={() => {
                  if (onClose) {
                    onClose();
                  } else {
                    setIsExpanded(false);
                  }
                }}
                className="px-3 py-1 text-text-secondary hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default MissionControls;