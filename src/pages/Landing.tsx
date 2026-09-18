import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ClipboardList,
  Database,
  GraduationCap,
  LayoutDashboard,
  Lock,
  PackageX,
  Sparkles,
  TriangleAlert,
  Users,
  Warehouse,
  Webhook,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';

const FEATURES = [
  {
    icon: Warehouse,
    title: 'Multi-entrepôts',
    description:
      'Suivez chaque unité par emplacement, avec des transferts atomiques entre entrepôts et un historique complet des mouvements.',
  },
  {
    icon: Bell,
    title: 'Alertes intelligentes',
    description:
      'Stock bas et ruptures détectés automatiquement par la base de données — impossible de rater un réapprovisionnement.',
  },
  {
    icon: ClipboardList,
    title: 'Commandes fournisseurs',
    description:
      'Créez des bons de commande numérotés automatiquement et réceptionnez le stock en un clic.',
  },
  {
    icon: Webhook,
    title: 'Intégrations e-commerce',
    description:
      'Shopify, WooCommerce ou votre propre système : chaque commande déduit le stock en temps réel via webhooks.',
  },
  {
    icon: BarChart3,
    title: 'Analytique',
    description:
      'Valeur du stock, flux entrants / sortants, répartition par catégorie et top produits — en un coup d’œil.',
  },
  {
    icon: Users,
    title: 'Équipe & rôles',
    description:
      'Espaces de travail multi-marques avec permissions fines (propriétaire, admin, membre, lecteur) appliquées au niveau de la base.',
  },
];

const STEPS = [
  {
    number: '01',
    title: 'Créez votre espace',
    description: 'Inscrivez-vous et configurez votre marque avec son premier entrepôt en moins d’une minute.',
  },
  {
    number: '02',
    title: 'Ajoutez vos produits',
    description: 'SKU, codes-barres, prix, seuils de réapprovisionnement et stock initial par entrepôt.',
  },
  {
    number: '03',
    title: 'Connectez votre boutique',
    description: 'Branchez Shopify ou WooCommerce — les ventes déduisent le stock automatiquement.',
  },
];

const STACK = [
  'React 19',
  'TypeScript',
  'Supabase · PostgreSQL',
  'Row Level Security',
  'Tailwind CSS v4',
  'React Query',
  'Recharts',
  'Edge Functions',
];

/** CSS-only product mockup for the hero — no screenshots needed. */
function HeroMockup() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl bg-gradient-to-tr from-brand-600/20 via-sky-400/10 to-emerald-400/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gray-950/90 shadow-modal backdrop-blur">
        {/* fake window chrome */}
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 flex items-center gap-1.5 text-[11px] text-white/40">
            <LayoutDashboard className="h-3 w-3" /> app.dynamico — Tableau de bord
          </span>
        </div>
        <div className="grid grid-cols-[64px_1fr]">
          {/* fake sidebar */}
          <div className="space-y-3 border-r border-white/10 p-3">
            <div className="h-7 w-7 rounded-lg bg-brand-600" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`h-2 rounded-full ${i === 0 ? 'bg-brand-400/70' : 'bg-white/15'}`} />
            ))}
          </div>
          {/* fake content */}
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Produits', value: '248' },
                { label: 'Valeur du stock', value: '84 200 €' },
                { label: 'Alertes', value: '3', alert: true },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] text-white/40">{stat.label}</p>
                  <p className={`mt-1 text-base font-bold ${stat.alert ? 'text-amber-300' : 'text-white'}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
            {/* fake chart */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] text-white/40">Mouvements de stock — 30 jours</p>
              <div className="mt-3 flex h-20 items-end gap-1.5">
                {[35, 55, 40, 70, 50, 85, 60, 95, 75, 55, 80, 65, 90, 70, 100].map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-gradient-to-t from-brand-600 to-brand-400"
                    style={{ height: `${height}%`, opacity: 0.5 + (i / 30) }}
                  />
                ))}
              </div>
            </div>
            {/* fake alerts */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                <span className="truncate text-[11px] text-white/60">
                  « T-shirt Bio Noir M » est bas : 4 restants (min. 10)
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <PackageX className="h-3.5 w-3.5 shrink-0 text-red-400" />
                <span className="truncate text-[11px] text-white/60">
                  « Tote Bag Canvas » est en rupture — Entrepôt Casablanca
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen scroll-smooth bg-gray-950 text-white">
      {/* ---------- navbar ---------- */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gray-950/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <img src="/logo-full.svg" alt="Dynamico logo" className="h-[13px] w-auto" />
          </a>
          <div className="hidden items-center gap-7 text-[13px] font-medium text-white/60 md:flex">
            <a href="#fonctionnalites" className="transition-colors hover:text-white">Fonctionnalités</a>
            <a href="#comment" className="transition-colors hover:text-white">Comment ça marche</a>
            <a href="#a-propos" className="transition-colors hover:text-white">À propos du projet</a>
          </div>
          <div className="flex items-center gap-2.5">
            {user ? (
              <Link to="/dashboard">
                <Button size="md">
                  Ouvrir le tableau de bord
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-2 text-[13px] font-medium text-white/70 transition-colors hover:text-white"
                >
                  Se connecter
                </Link>
                <Link to="/register">
                  <Button size="md">Créer un compte</Button>
                </Link>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ---------- hero ---------- */}
      <section id="top" className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-[-20%] left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-brand-600/25 blur-[120px]" />
        </div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-20 pb-24 sm:px-6 lg:grid-cols-2 lg:pt-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/70">
              <GraduationCap className="h-3.5 w-3.5 text-brand-300" />
              Projet de Fin d’Études — Mega Campus
            </span>
            <h1 className="mt-6 text-4xl leading-[1.1] font-bold tracking-tight sm:text-5xl">
              Gérez votre stock comme les{' '}
              <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-sky-300 bg-clip-text text-transparent">
                grandes marques
              </span>
              .
            </h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/60">
              Dynamico centralise produits, entrepôts, commandes fournisseurs et alertes dans un
              tableau de bord pensé pour les marques e-commerce. Connectez votre boutique — le
              stock se met à jour tout seul.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to={user ? '/dashboard' : '/register'}>
                <Button size="lg">
                  Commencer gratuitement
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="ghost"
                  className="border border-white/15 text-white hover:bg-white/10 hover:text-white"
                >
                  Voir la démo
                </Button>
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/50">
              {['Multi-entrepôts', 'Alertes automatiques', 'Webhooks Shopify & Woo'].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <HeroMockup />
        </div>
      </section>

      {/* ---------- features ---------- */}
      <section id="fonctionnalites" className="border-t border-white/10 bg-gray-950 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[13px] font-semibold tracking-wider text-brand-300 uppercase">
              <Sparkles className="h-4 w-4" /> Fonctionnalités
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Tout ce qu’il faut pour piloter votre inventaire.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/55">
              Un produit complet, pas une démo : chaque règle métier (stock dérivé du registre des
              mouvements, alertes, réceptions) est appliquée directement dans PostgreSQL.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:border-brand-500/40 hover:bg-white/[0.06]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/15 text-brand-300 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold">{feature.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/50">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="comment" className="border-t border-white/10 py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[13px] font-semibold tracking-wider text-brand-300 uppercase">
              Comment ça marche
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              En production en trois étapes.
            </h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.number} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <span className="bg-gradient-to-br from-brand-300 to-brand-500 bg-clip-text font-mono text-3xl font-bold text-transparent">
                  {step.number}
                </span>
                <h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-white/50">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- PFE presentation ---------- */}
      <section id="a-propos" className="border-t border-white/10 bg-white/[0.02] py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-start gap-12 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="flex items-center gap-2 text-[13px] font-semibold tracking-wider text-brand-300 uppercase">
                <GraduationCap className="h-4 w-4" /> À propos du projet
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Un Projet de Fin d’Études, pensé comme un vrai SaaS.
              </h2>
              <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-white/60">
                <p>
                  <strong className="text-white">Dynamico</strong> est un Projet de Fin d’Études
                  (PFE) réalisé par <strong className="text-white">Nidaa Cherqui</strong> au sein
                  de <strong className="text-white">Mega Campus</strong>. L’objectif : concevoir et
                  développer une plateforme SaaS de gestion de stock destinée aux marques
                  e-commerce, avec le niveau d’exigence d’un produit professionnel.
                </p>
                <p>
                  Le projet couvre l’ensemble du cycle : architecture multi-tenant (espaces de
                  travail isolés par Row Level Security), modélisation de la base de données,
                  logique métier transactionnelle côté PostgreSQL (registre de mouvements
                  immuable, alertes automatiques, réception de commandes), intégrations webhooks
                  temps réel, et une interface soignée inspirée des meilleurs outils du marché.
                </p>
                <p>
                  Chaque écran est connecté à de vraies données : authentification, rôles
                  d’équipe, analytique et journal d’activité — rien n’est simulé.
                </p>
              </div>
              <div className="mt-7 flex flex-wrap gap-2">
                {STACK.map((tech) => (
                  <span
                    key={tech}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {/* author card */}
              <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
                    NC
                  </div>
                  <div>
                    <p className="text-[17px] font-semibold">Nidaa Cherqui</p>
                    <p className="text-[13px] text-white/50">Étudiante · Mega Campus</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2.5 border-t border-white/10 pt-5 text-[13px]">
                  <div className="flex items-center justify-between">
                    <span className="text-white/45">Projet</span>
                    <span className="font-medium">PFE — Dynamico</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/45">Établissement</span>
                    <span className="font-medium">Mega Campus</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/45">Année</span>
                    <span className="font-medium">2025 – 2026</span>
                  </div>
                </div>
              </div>

              {/* highlights */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <p className="text-[13px] font-semibold tracking-wider text-white/40 uppercase">
                  Points clés techniques
                </p>
                <ul className="mt-4 space-y-3 text-[13px] text-white/60">
                  <li className="flex items-start gap-2.5">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                    Sécurité multi-tenant : chaque requête est filtrée par la base (RLS), pas par le client.
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Database className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                    Stock dérivé d’un registre immuable — aucune quantité modifiée à la main.
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
                    Ingestion de commandes idempotente depuis Shopify / WooCommerce.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section className="border-t border-white/10 py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Prêt à maîtriser votre stock ?
          </h2>
          <p className="mt-4 text-[15px] text-white/55">
            Créez votre espace de travail gratuitement et explorez la plateforme.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to={user ? '/dashboard' : '/register'}>
              <Button size="lg">
                Commencer maintenant
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="border-t border-white/10 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo-text.svg" alt="Dynamico logo" className="h-[13px] w-auto" />
          </div>
          <p className="text-center text-xs text-white/40">
            © 2026 Dynamico — Projet de Fin d’Études par Nidaa Cherqui · Mega Campus
          </p>
          <div className="flex gap-5 text-xs text-white/50">
            <Link to="/login" className="transition-colors hover:text-white">Connexion</Link>
            <Link to="/register" className="transition-colors hover:text-white">Inscription</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
