import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';
import { DroneData } from '@/types/fleet';

interface TelemetryChartProps {
  data: any[];
  drone: DroneData;
}

const TelemetryChart: React.FC<TelemetryChartProps> = ({ data }) => {
  const [selectedMetric, setSelectedMetric] = useState<'battery' | 'altitude' | 'speed' | 'signal'>('battery');

  const metrics = [
    { 
      id: 'battery', 
      label: 'Battery Level', 
      color: '#238636', 
      unit: '%',
      min: 0,
      max: 100,
      criticalLevel: 20
    },
    { 
      id: 'altitude', 
      label: 'Altitude', 
      color: '#1f6feb', 
      unit: 'm',
      min: 0,
      max: Math.max(150, Math.max(...data.map(d => d.altitude || 0)) + 20)
    },
    { 
      id: 'speed', 
      label: 'Ground Speed', 
      color: '#d29922', 
      unit: 'm/s',
      min: 0,
      max: Math.max(20, Math.max(...data.map(d => d.speed || 0)) + 5)
    },
    { 
      id: 'signal', 
      label: 'Signal Strength', 
      color: '#8957e5', 
      unit: 'dBm',
      min: -100,
      max: -30,
      criticalLevel: -90
    }
  ];

  const currentMetric = metrics.find(m => m.id === selectedMetric)!;

  const formatData = (data: any[]) => {
    return data.map(point => ({
      ...point,
      time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
        hour12: false, 
        minute: '2-digit', 
        second: '2-digit' 
      })
    }));
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-dark-secondary border border-dark-border rounded-lg p-3 shadow-lg">
          <p className="text-text-secondary text-sm">{`Time: ${label}`}</p>
          <p className="text-text-primary font-semibold">
            {`${currentMetric.label}: ${payload[0].value.toFixed(1)}${currentMetric.unit}`}
          </p>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="text-center text-text-secondary py-8">
        <div className="text-4xl mb-2">📈</div>
        <p>No telemetry data available</p>
        <p className="text-sm">Charts will appear once data starts flowing</p>
      </div>
    );
  }

  const chartData = formatData(data);

  return (
    <div className="space-y-4">
      {/* Metric Selector */}
      <div className="flex flex-wrap gap-2">
        {metrics.map((metric) => (
          <button
            key={metric.id}
            onClick={() => setSelectedMetric(metric.id as any)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              selectedMetric === metric.id
                ? 'bg-dark-tertiary text-text-primary border border-dark-border'
                : 'text-text-secondary hover:text-text-primary hover:bg-dark-hover'
            }`}
          >
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: metric.color }}
              />
              {metric.label}
            </div>
          </button>
        ))}
      </div>

      {/* Chart */}
      <motion.div
        key={selectedMetric}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-dark-tertiary rounded-lg p-4"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-text-primary font-semibold">
            {currentMetric.label} Over Time
          </h3>
          <div className="text-text-secondary text-sm">
            Last {chartData.length} data points
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="#30363d" 
              />
              <XAxis 
                dataKey="time" 
                stroke="#8b949e"
                fontSize={12}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="#8b949e"
                fontSize={12}
                domain={[currentMetric.min, currentMetric.max]}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Critical level reference line */}
              {currentMetric.criticalLevel !== undefined && (
                <ReferenceLine 
                  y={currentMetric.criticalLevel} 
                  stroke="#da3633" 
                  strokeDasharray="5 5"
                  label={{ 
                    value: "Critical", 
                    position: "top",
                    fill: "#da3633",
                    fontSize: 10
                  }}
                />
              )}
              
              <Line
                type="monotone"
                dataKey={selectedMetric}
                stroke={currentMetric.color}
                strokeWidth={2}
                dot={{ fill: currentMetric.color, strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: currentMetric.color, strokeWidth: 2 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Current Value Display */}
        <div className="mt-4 pt-4 border-t border-dark-border">
          <div className="flex items-center justify-between">
            <span className="text-text-secondary">Current Value:</span>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-text-primary">
                {chartData.length > 0 
                  ? chartData[chartData.length - 1][selectedMetric]?.toFixed(1) || 'N/A'
                  : 'N/A'
                }
              </span>
              <span className="text-text-secondary">{currentMetric.unit}</span>
            </div>
          </div>
          
          {/* Trend Indicator */}
          {chartData.length > 1 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-text-secondary">Trend:</span>
              {(() => {
                const current = chartData[chartData.length - 1][selectedMetric];
                const previous = chartData[chartData.length - 2][selectedMetric];
                const diff = current - previous;
                const isIncreasing = diff > 0;
                const isDecreasing = diff < 0;
                
                return (
                  <div className={`flex items-center gap-1 text-sm ${
                    isIncreasing ? 'text-green-400' : isDecreasing ? 'text-red-400' : 'text-text-secondary'
                  }`}>
                    <span>
                      {isIncreasing ? '↗' : isDecreasing ? '↘' : '→'}
                    </span>
                    <span>
                      {Math.abs(diff).toFixed(2)} {currentMetric.unit}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </motion.div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {['min', 'max', 'avg', 'current'].map((stat) => {
          let value, label;
          const values = chartData.map(d => d[selectedMetric]).filter(v => v !== undefined && v !== null);
          
          switch (stat) {
            case 'min':
              value = values.length > 0 ? Math.min(...values) : 0;
              label = 'Minimum';
              break;
            case 'max':
              value = values.length > 0 ? Math.max(...values) : 0;
              label = 'Maximum';
              break;
            case 'avg':
              value = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
              label = 'Average';
              break;
            case 'current':
              value = values.length > 0 ? values[values.length - 1] : 0;
              label = 'Current';
              break;
            default:
              value = 0;
              label = '';
          }
          
          return (
            <div key={stat} className="bg-dark-tertiary rounded-lg p-3">
              <div className="text-text-secondary text-sm">{label}</div>
              <div className="text-xl font-bold text-text-primary">
                {value.toFixed(1)}
              </div>
              <div className="text-xs text-text-secondary">{currentMetric.unit}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TelemetryChart;