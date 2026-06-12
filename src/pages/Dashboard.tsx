import { Link, useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Banknote, Bell, Boxes, Package, PieChart as PieChartIcon, Plus } from 'lucide-react';
import { useCurrentWorkspace } from '@/contexts/WorkspaceContext';
import { useDashboardStats, useMovementSeries, useStockByCategory } from '@/hooks/useAnalytics';
import { useAlerts, useUpdateAlertStatus } from '@/hooks/useAlerts';
import { useRecentActivity } from '@/hooks/useActivity';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { ChartCard } from '@/components/shared/ChartCard';
import { AlertPanel } from '@/components/shared/AlertPanel';
import { ActivityFeed } from '@/components/shared/ActivityFeed';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function Dashboard() {
  const navigate = useNavigate();
  const { workspace, canEdit } = useCurrentWorkspace();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: series = [], isLoading: seriesLoading } = useMovementSeries(30);
  const { data: byCategory = [], isLoading: categoryLoading } = useStockByCategory();
  const { data: alerts, isLoading: alertsLoading } = useAlerts({ status: 'active', limit: 6 });
  const { data: activity, isLoading: activityLoading } = useRecentActivity(8);
  const { data: settings } = useSettings();
  const updateAlert = useUpdateAlertStatus();

  const currency = settings?.currency ?? 'USD';
  const activeAlerts = (stats?.low_stock_count ?? 0) + (stats?.out_of_stock_count ?? 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Inventory health for ${workspace.name}`}
        actions={
          canEdit && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/products/new')}>
              Add product
            </Button>
          )
        }
      />

      {/* stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total products"
          value={formatNumber(stats?.total_products ?? 0)}
          icon={Package}
          loading={statsLoading}
        />
        <StatCard
          label="Units in stock"
          value={formatNumber(stats?.total_units ?? 0)}
          icon={Boxes}
          tone="bg-sky-50 text-sky-600"
          loading={statsLoading}
        />
        <StatCard
          label="Stock value"
          value={formatCurrency(stats?.stock_value ?? 0, currency)}
          icon={Banknote}
          tone="bg-emerald-50 text-emerald-600"
          sub={`Retail ${formatCurrency(stats?.retail_value ?? 0, currency)}`}
          loading={statsLoading}
        />
        <StatCard
          label="Active alerts"
          value={formatNumber(activeAlerts)}
          icon={Bell}
          tone={activeAlerts > 0 ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}
          sub={
            stats
              ? `${stats.low_stock_count} low · ${stats.out_of_stock_count} out of stock`
              : undefined
          }
          loading={statsLoading}
        />
      </div>

      {/* charts */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <ChartCard
          title="Stock movement"
          description="Units in vs. out over the last 30 days (transfers excluded)"
          loading={seriesLoading}
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height={272}>
            <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="day"
                tickFormatter={shortDate}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                minTickGap={28}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                allowDecimals={false}
              />
              <Tooltip
                labelFormatter={(label) => shortDate(String(label))}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  fontSize: 12,
                  boxShadow: '0 4px 12px rgb(16 24 40 / 0.08)',
                }}
              />
              <Area
                type="monotone"
                dataKey="stock_in"
                name="Stock in"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#gradIn)"
              />
              <Area
                type="monotone"
                dataKey="stock_out"
                name="Stock out"
                stroke="#f43f5e"
                strokeWidth={2}
                fill="url(#gradOut)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Stock by category"
          description="Units on hand"
          loading={categoryLoading}
        >
          {byCategory.length === 0 ? (
            <EmptyState
              icon={PieChartIcon}
              title="No stock yet"
              description="Add products with stock to see the breakdown."
              className="py-8"
            />
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="units"
                    nameKey="category"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {byCategory.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${formatNumber(Number(value))} units`]}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-3 space-y-1.5">
                {byCategory.slice(0, 5).map((entry) => (
                  <li key={entry.category} className="flex items-center gap-2 text-[13px]">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="flex-1 truncate text-gray-600">{entry.category}</span>
                    <span className="font-medium text-gray-900">{formatNumber(entry.units)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>

      {/* alerts + activity */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Stock alerts</CardTitle>
            <Link
              to="/alerts"
              className="text-[13px] font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          </CardHeader>
          <div className="p-3">
            <AlertPanel
              alerts={alerts}
              loading={alertsLoading}
              onResolve={
                canEdit
                  ? (alert) => updateAlert.mutate({ id: alert.id, status: 'resolved' })
                  : undefined
              }
              onDismiss={
                canEdit
                  ? (alert) => updateAlert.mutate({ id: alert.id, status: 'dismissed' })
                  : undefined
              }
            />
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <Link
              to="/activity"
              className="text-[13px] font-medium text-brand-600 hover:text-brand-700"
            >
              View all
            </Link>
          </CardHeader>
          <div className="p-3">
            <ActivityFeed logs={activity} loading={activityLoading} />
          </div>
        </Card>
      </div>
    </>
  );
}
