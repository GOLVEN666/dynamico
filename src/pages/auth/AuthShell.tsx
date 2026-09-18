import type { ReactNode } from 'react';
import { BarChart3, Bell, Warehouse } from 'lucide-react';

const FEATURES = [
  { icon: Warehouse, text: 'Track stock across unlimited warehouses' },
  { icon: Bell, text: 'Automatic low-stock and out-of-stock alerts' },
  { icon: BarChart3, text: 'Real-time inventory value and analytics' },
];

interface AuthShellProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}

/** Split-screen auth layout: form on the left, brand panel on the right. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-[480px] lg:shrink-0 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex items-center gap-2.5">
            <img src="/logo-full.svg" alt="Dynamico logo" className="h-[13px] w-auto" />
          </div>
          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          <p className="mt-1.5 text-sm text-gray-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>

      <div className="hidden flex-1 flex-col justify-center bg-gray-950 px-16 lg:flex">
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-white">
            Inventory your whole team can trust.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-gray-400">
            Dynamico keeps stock levels, purchase orders and alerts in one place — built for
            ecommerce brands that ship fast.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature.text} className="flex items-center gap-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <feature.icon className="h-4.5 w-4.5 text-brand-300" />
                </div>
                <span className="text-sm text-gray-300">{feature.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
