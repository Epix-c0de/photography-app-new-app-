'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type RevenueMetrics = {
  total_revenue: number;
  subscription_revenue: number;
  commission_revenue: number;
  transaction_count: number;
  avg_transaction_value: number;
  month_over_month_growth: number;
};

type MonthlyRevenue = {
  month: string;
  subscription: number;
  commission: number;
  total: number;
};

export default function RevenuePage() {
  const [metrics, setMetrics] = useState<RevenueMetrics | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePhotographers, setActivePhotographers] = useState(0);
  const [expiringSubscriptions, setExpiringSubscriptions] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load revenue metrics
      const { data: metricsData } = await supabase.rpc('get_revenue_metrics');
      if (metricsData && metricsData.length > 0) {
        setMetrics(metricsData[0]);
      }

      // Load monthly revenue data
      const { data: pipelineData } = await supabase
        .from('revenue_pipeline')
        .select('*')
        .gte('month', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
        .order('month', { ascending: true });

      if (pipelineData) {
        // Aggregate by month
        const monthMap = new Map<string, { subscription: number; commission: number }>();
        pipelineData.forEach((row: any) => {
          const monthKey = new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { subscription: 0, commission: 0 });
          }
          const current = monthMap.get(monthKey)!;
          if (row.revenue_type === 'subscription') {
            current.subscription += parseFloat(row.net_revenue) || 0;
          } else {
            current.commission += parseFloat(row.net_revenue) || 0;
          }
        });

        const monthly = Array.from(monthMap.entries()).map(([month, data]) => ({
          month,
          subscription: data.subscription,
          commission: data.commission,
          total: data.subscription + data.commission,
        }));
        setMonthlyData(monthly);
      }

      // Load active photographers count
      const { count: activeCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'only', head: true })
        .eq('role', 'admin')
        .eq('subscription_status', 'active');
      setActivePhotographers(activeCount || 0);

      // Load expiring subscriptions (next 30 days)
      const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: expiringCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'only', head: true })
        .eq('role', 'admin')
        .eq('subscription_status', 'active')
        .lte('subscription_end_date', thirtyDaysFromNow);
      setExpiringSubscriptions(expiringCount || 0);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  // Chart configurations
  const revenueBreakdownData = {
    labels: ['Subscriptions', 'Commissions'],
    datasets: [{
      data: [
        metrics?.subscription_revenue || 0,
        metrics?.commission_revenue || 0
      ],
      backgroundColor: ['#D4AF37', '#F0D060'],
      borderColor: ['#D4AF37', '#F0D060'],
      borderWidth: 2,
    }]
  };

  const monthlyRevenueData = {
    labels: monthlyData.map(m => m.month),
    datasets: [
      {
        label: 'Subscriptions',
        data: monthlyData.map(m => m.subscription),
        backgroundColor: 'rgba(212,175,55,0.2)',
        borderColor: '#D4AF37',
        borderWidth: 2,
        fill: true,
      },
      {
        label: 'Commissions',
        data: monthlyData.map(m => m.commission),
        backgroundColor: 'rgba(240,208,96,0.2)',
        borderColor: '#F0D060',
        borderWidth: 2,
        fill: true,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgba(255,255,255,0.7)',
          font: { size: 12, weight: 'bold' as const }
        }
      },
      tooltip: {
        backgroundColor: '#111118',
        titleColor: '#fff',
        bodyColor: 'rgba(255,255,255,0.7)',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
      }
    },
    scales: {
      y: {
        ticks: { color: 'rgba(255,255,255,0.5)' },
        grid: { color: 'rgba(255,255,255,0.05)' }
      },
      x: {
        ticks: { color: 'rgba(255,255,255,0.5)' },
        grid: { color: 'rgba(255,255,255,0.05)' }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-black">Revenue Pipeline</h1>
          <p className="text-gray-400 mt-1">Track all revenue streams and trends</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F0D060)', color: '#080810' }}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Revenue Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <p className="text-sm font-semibold text-gray-400 mb-2">Total Revenue</p>
          <p className="text-3xl font-black" style={{ color: '#D4AF37' }}>
            {formatCurrency(metrics?.total_revenue || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-2">All time</p>
        </div>

        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <p className="text-sm font-semibold text-gray-400 mb-2">MoM Growth</p>
          <p className="text-3xl font-black" style={{ color: metrics && metrics.month_over_month_growth >= 0 ? '#34C759' : '#FF3B30' }}>
            {metrics?.month_over_month_growth.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-2">vs last month</p>
        </div>

        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <p className="text-sm font-semibold text-gray-400 mb-2">Avg Transaction</p>
          <p className="text-3xl font-black text-white">
            {formatCurrency(metrics?.avg_transaction_value || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-2">{metrics?.transaction_count || 0} transactions</p>
        </div>

        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <p className="text-sm font-semibold text-gray-400 mb-2">Active Photographers</p>
          <p className="text-3xl font-black text-white">{activePhotographers}</p>
          <p className="text-xs text-gray-500 mt-2">{expiringSubscriptions} expiring soon</p>
        </div>
      </div>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-[#111118] border border-white/5 rounded-2xl p-6">
          <h2 className="font-bold mb-4">Revenue Breakdown</h2>
          <div style={{ height: '250px' }}>
            <Doughnut data={revenueBreakdownData} options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
                legend: { ...chartOptions.plugins.legend, position: 'bottom' }
              }
            }} />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Subscriptions</span>
              <span className="font-bold" style={{ color: '#D4AF37' }}>
                {formatCurrency(metrics?.subscription_revenue || 0)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Commissions</span>
              <span className="font-bold" style={{ color: '#F0D060' }}>
                {formatCurrency(metrics?.commission_revenue || 0)}
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-[#111118] border border-white/5 rounded-2xl p-6">
          <h2 className="font-bold mb-4">Monthly Revenue Trend</h2>
          <div style={{ height: '280px' }}>
            <Line data={monthlyRevenueData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Pipeline Health */}
      <div className="bg-[#111118] border border-white/5 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="font-bold">Pipeline Health</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/5">
          <div className="p-6">
            <p className="text-sm font-semibold text-gray-400 mb-2">Active Paying Photographers</p>
            <p className="text-4xl font-black" style={{ color: '#34C759' }}>{activePhotographers}</p>
            <p className="text-xs text-gray-500 mt-2">With active subscriptions</p>
          </div>
          <div className="p-6">
            <p className="text-sm font-semibold text-gray-400 mb-2">Expiring Subscriptions</p>
            <p className="text-4xl font-black" style={{ color: '#FF9F0A' }}>{expiringSubscriptions}</p>
            <p className="text-xs text-gray-500 mt-2">Next 30 days</p>
          </div>
          <div className="p-6">
            <p className="text-sm font-semibold text-gray-400 mb-2">Expected MRR</p>
            <p className="text-4xl font-black text-white">
              {formatCurrency((activePhotographers * 500))}
            </p>
            <p className="text-xs text-gray-500 mt-2">Estimated monthly recurring</p>
          </div>
        </div>
      </div>
    </div>
  );
}
