'use client';

import { motion } from 'framer-motion';

interface ScoreDistributionChartProps {
  distribution: {
    '0-20': number;
    '21-40': number;
    '41-60': number;
    '61-80': number;
    '81-100': number;
  };
}

export default function ScoreDistributionChart({ distribution }: ScoreDistributionChartProps) {
  const ranges = Object.entries(distribution).map(([range, count]) => ({
    range,
    count,
    label: `${range}%`
  }));

  const maxCount = Math.max(...ranges.map(r => r.count), 1);
  const total = ranges.reduce((sum, r) => sum + r.count, 0);

  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500'
  ];

  const hoverColors = [
    'hover:bg-red-600',
    'hover:bg-orange-600',
    'hover:bg-yellow-600',
    'hover:bg-lime-600',
    'hover:bg-green-600'
  ];

  return (
    <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Score Distribution</h3>
      
      <div className="space-y-4">
        {ranges.map((item, index) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0;
          const barWidth = (item.count / maxCount) * 100;
          
          return (
            <div key={item.range}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{item.count} interviews</span>
                  <span className="text-xs font-semibold text-gray-500">
                    ({percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              
              <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${colors[index]} ${hoverColors[index]} transition-colors duration-200 rounded-full flex items-center justify-end pr-3`}
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1, ease: "easeOut" }}
                >
                  {item.count > 0 && (
                    <span className="text-xs font-bold text-white">
                      {item.count}
                    </span>
                  )}
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-600">Total</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">
            {distribution['81-100'] + distribution['61-80']}
          </p>
          <p className="text-xs text-gray-600">Above 60%</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600">
            {distribution['0-20'] + distribution['21-40']}
          </p>
          <p className="text-xs text-gray-600">Below 40%</p>
        </div>
      </div>
    </div>
  );
}
