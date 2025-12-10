import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface DataPoint {
  time: string;
  errors: number;
  fixed: number;
}

interface ActivityChartProps {
  data: DataPoint[];
}

const ActivityChart: React.FC<ActivityChartProps> = ({ data }) => {
  return (
    <div className="bg-surface border border-border rounded-lg p-4 shadow-sm h-64 w-full flex flex-col">
      <h3 className="text-text font-semibold mb-4 text-sm shrink-0">System Activity (24h)</h3>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{
              top: 5,
              right: 0,
              left: 0,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f85149" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f85149" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorFixed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#238636" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#238636" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#30363d" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="#8b949e" 
              tick={{fontSize: 12}} 
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#8b949e" 
              tick={{fontSize: 12}} 
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9' }}
              itemStyle={{ fontSize: 12 }}
            />
            <Area 
              type="monotone" 
              dataKey="errors" 
              stroke="#f85149" 
              fillOpacity={1} 
              fill="url(#colorErrors)" 
              strokeWidth={2}
            />
            <Area 
              type="monotone" 
              dataKey="fixed" 
              stroke="#238636" 
              fillOpacity={1} 
              fill="url(#colorFixed)" 
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ActivityChart;