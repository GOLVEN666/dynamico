import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Banknote, Boxes, PieChart as PieChartIcon, Tags, TrendingUp } from 'lucide-react';
import {
  useDashboardStats,
  useMovementSeries,
  useStockByCategory,
  useTopProducts,
} from '@/hooks/useAnalytics';
import { useSettings } from '@/hooks/useSettings';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { ChartCard } from '@/components/shared/ChartCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

const RANGES = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
];

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export function Analytics() {
  const [days, setDays] = useState(30);
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: series = [], isLoading: seriesLoading } = useMovementSeries(days);
  const { data: byCategory = [], isLoading: categoryLoading } = useStockByCategory();
  const { data: topProducts = [], isLoading: topLoading } = useTopProducts(8);
  const { data: settings } = useSettings();
  const currency = settings?.currency ?? 'USD';

  const totalIn = series.reduce((sum, point) => sum + point.stock_in, 0);
  const totalOut = series.reduce((sum, point) => sum + point.stock_out, 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Inventory value, flow and composition across your workspace"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Stock value (cost)"
          value={formatCurrency(stats?.stock_value ?? 0, currency)}
          icon={Banknote}
          tone="bg-emerald-50 text-emerald-600"
          loading={statsLoading}
        />
        <StatCard
          label="Retail value"
          value={formatCurrency(stats?.retail_value ?? 0, currency)}
          icon={TrendingUp}
          tone="bg-brand-50 text-brand-600"
          sub={
            stats && stats.stock_value > 0
              ? `${Math.round(((stats.retail_value - stats.stock_value) / stats.retail_value) * 100)}% potential margin`
              : undefined
          }
          loading={statsLoading}
        />
        <StatCard
          label={`Units in (${days}d)`}
          value={formatNumber(totalIn)}
          icon={Boxes}
          tone="bg-sky-50 text-sky-600"
          loading={seriesLoading}
        />
        <StatCard
          label={`Units out (${days}d)`}
          value={formatNumber(totalOut)}
          icon={Boxes}
          tone="bg-amber-50 text-amber-600"
          loading={seriesLoading}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <ChartCard
          title="Inventory flow"
          description="Daily units in vs. out (transfers excluded)"
          loading={seriesLoading}
          className="xl:col-span-2"
          action={
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {RANGES.map((range) => (
                <button
                  key={range.days}
                  type="button"
                  onClick={() => setDays(range.days)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    days === range.days
                      ? 'bg-white text-gray-900 shadow-card'
                      : 'text-gray-500 hover:text-gray-700',
                  )}
                >
                  {range.label}
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: -12 }} barGap={2}>
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
                cursor={{ fill: 'rgb(243 244 246 / 0.7)' }}
                contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
              <Bar dataKey="stock_in" name="Stock in" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar dataKey="stock_out" name="Stock out" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Category mix" description="Units by category" loading={categoryLoading}>
          {byCategory.length === 0 ? (
            <EmptyState
              icon={PieChartIcon}
              title="No stock yet"
              description="Stocked products appear here grouped by category."
              className="py-8"
            />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="units"
                  nameKey="category"
                  innerRadius={62}
                  outerRadius={92}
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
          )}
        </ChartCard>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard
          title="Top products by stock"
          description="Units on hand"
          loading={topLoading}
        >
          {topProducts.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No products yet"
              description="Your most stocked products will rank here."
              className="py-8"
            />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(220, topProducts.length * 40)}>
              <BarChart
                data={topProducts}
                layout="vertical"
                margin={{ top: 0, right: 12, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <Tooltip
                  formatter={(value) => [`${formatNumber(Number(value))} units`]}
                  cursor={{ fill: 'rgb(243 244 246 / 0.7)' }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                />
                <Bar dataKey="units" name="Units" fill="#6366f1" radius={[0, 3, 3, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <Card>
          <CardHeader>
            <CardTitle>Value by category</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {byCategory.length === 0 ? (
              <EmptyState
                icon={Tags}
                title="Nothing to show"
                description="Category values appear once products hold stock."
                className="py-8"
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {byCategory.map((entry) => {
                  const totalValue = byCategory.reduce((sum, c) => sum + Number(c.value), 0);
                  const share = totalValue > 0 ? (Number(entry.value) / totalValue) * 100 : 0;
                  return (
                    <div key={entry.category} className="py-2.5">
                      <div className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="flex items-center gap-2 font-medium text-gray-900">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          {entry.category}
                        </span>
                        <span className="font-semibold text-gray-900 tabular-nums">
                          {formatCurrency(Number(entry.value), currency)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${share}%`, backgroundColor: entry.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
