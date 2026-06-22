import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useEffect, useState } from "react";
import { applyThemeColors, applyGuiColors } from "./lib/theme-colors";
import Home from "./pages/home";
import ListPage from "./pages/list";
import ListingsPage from "./pages/listings";
import MessagesPage from "./pages/messages";
import AdminPage from "./pages/admin";
import TosPage from "./pages/tos";
import ProfilePage from "./pages/profile";
import CommunityPage from "./pages/community";
import { PackagePlus, ShoppingBag, LogOut, LayoutList, Inbox, Shield, UserCircle2, Heart } from "lucide-react";
import { cn } from "./lib/utils";
import { AuthProvider, useAuth } from "./contexts/auth-context";
import { useConversations } from "./hooks/use-messages";
import { useOwnProfile } from "./hooks/use-profile";

type SiteTheme = {
  primaryColor: string;
  secondaryColor: string;
  bgUrl: string | null;
  bgOverlay: number;
  bgBlur: boolean;
};

type UserTheme = { primary: string; secondary: string; bgUrl: string | null; bgOverlay: number; bgBlur: boolean; uiBg?: string; uiCard?: string; uiBorder?: string };

const UNIVERSAL_THEME_KEY = "baddies-user-site-theme";

function readUserTheme(userId: string | undefined): UserTheme | null {
  try {
    if (userId) {
      const s = localStorage.getItem(`user-theme-${userId}`);
      if (s) return JSON.parse(s) as UserTheme;
    }
    const fallback = localStorage.getItem(UNIVERSAL_THEME_KEY);
    return fallback ? (JSON.parse(fallback) as UserTheme) : null;
  } catch { return null; }
}

function SiteTheme() {
  const { user } = useAuth();
  const { data: serverTheme } = useQuery<SiteTheme>({
    queryKey: ["site-theme"],
    queryFn: () => fetch("/api/theme").then((r) => r.json()),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const [userTheme, setUserTheme] = useState<UserTheme | null>(() => readUserTheme(user?.id));

  useEffect(() => {
    function reload() { setUserTheme(readUserTheme(user?.id)); }
    reload();
    window.addEventListener("user-theme-changed", reload);
    return () => window.removeEventListener("user-theme-changed", reload);
  }, [user?.id]);

  useEffect(() => {
    const t = userTheme ?? serverTheme;
    if (!t) return;
    applyThemeColors(
      userTheme ? userTheme.primary : serverTheme!.primaryColor,
      userTheme ? userTheme.secondary : serverTheme!.secondaryColor,
    );
    if (userTheme) applyGuiColors(userTheme.uiBg, userTheme.uiCard, userTheme.uiBorder);
  }, [userTheme, serverTheme?.primaryColor, serverTheme?.secondaryColor]);

  const bg = userTheme ?? serverTheme;
  if (!bg?.bgUrl) return null;

  return (
    <>
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${bg.bgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          filter: bg.bgBlur ? "blur(4px) scale(1.04)" : "none",
        }}
      />
      <div
        className="fixed inset-0 -z-10"
        style={{ background: `rgba(0,0,0,${bg.bgOverlay})` }}
      />
    </>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const SPRING_NAV = { type: "spring" as const, bounce: 0.18, duration: 0.4 };

const NAV_ITEMS = [
  { href: "/", icon: ShoppingBag, label: "Catalog" },
  { href: "/listings", icon: LayoutList, label: "Listings" },
  { href: "/list", icon: PackagePlus, label: "List Items" },
  { href: "/community", icon: Heart, label: "Community" },
] as const;

function NavBar() {
  const [location] = useLocation();
  const { user, loading, logout } = useAuth();
  const { data: conversations = [] } = useConversations();
  const unreadCount = conversations.filter((c) => c.unread).length;

  const { data: adminMe } = useQuery<{ role: string }>({
    queryKey: ["admin-me"],
    queryFn: () => fetch("/api/admin/me", { credentials: "include" }).then((r) => r.json()),
    enabled: !!user,
    staleTime: 5_000,
    refetchInterval: 8_000,
  });
  const isStaff = !!adminMe && adminMe.role !== "none";

  const { data: ownProfile } = useOwnProfile();
  const discordAvatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : null;
  const avatarUrl = ownProfile?.customAvatarUrl ?? discordAvatarUrl;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-2 px-3 sm:px-6 py-3 border-b border-white/10 bg-background/80 backdrop-blur-md">
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <motion.img
          src="/logo.png"
          alt="Baddies Store"
          className="h-9 w-9 object-contain"
          style={{ filter: "drop-shadow(0 0 8px rgba(var(--accent-r, 255), var(--accent-g, 0), var(--accent-b, 128), 0.6))" }}
          whileHover={{ scale: 1.08, rotate: -4 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        />
        <span className="font-display font-extrabold text-lg sm:text-xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-glow">
          Baddies Store
        </span>
      </Link>

      {/* Desktop nav — animated pill */}
      <LayoutGroup id="desktop-nav">
        <nav className="hidden md:flex items-center gap-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150",
                  active ? "text-white" : "text-muted-foreground hover:text-white",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="desk-nav-pill"
                    className="absolute inset-0 rounded-xl bg-white/10"
                    transition={SPRING_NAV}
                  />
                )}
                <Icon className="w-4 h-4 relative z-10" />
                <span className="relative z-10">{label}</span>
              </Link>
            );
          })}

          {user && (
            <Link
              href="/messages"
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150",
                location === "/messages" ? "text-white" : "text-muted-foreground hover:text-white",
              )}
            >
              {location === "/messages" && (
                <motion.span layoutId="desk-nav-pill" className="absolute inset-0 rounded-xl bg-white/10" transition={SPRING_NAV} />
              )}
              <span className="relative z-10 relative">
                <Inbox className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-[9px] text-white font-bold flex items-center justify-center leading-none">
                    {unreadCount}
                  </span>
                )}
              </span>
              <span className="relative z-10">Messages</span>
            </Link>
          )}

          {isStaff && (
            <Link
              href="/admin"
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150",
                location === "/admin" ? "text-primary" : "text-muted-foreground hover:text-primary",
              )}
            >
              {location === "/admin" && (
                <motion.span layoutId="desk-nav-pill" className="absolute inset-0 rounded-xl bg-primary/15 border border-primary/25" transition={SPRING_NAV} />
              )}
              <Shield className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Admin</span>
            </Link>
          )}
        </nav>
      </LayoutGroup>

      {/* Auth area */}
      {!loading && (
        user ? (
          <div className="flex items-center gap-2 md:ml-2 md:pl-2 md:border-l md:border-white/10 shrink-0">
            <Link href={`/profile/${user.id}`}
              className="flex items-center gap-2 rounded-xl hover:bg-white/5 p-1 transition-colors group"
              title="My Profile">
              {avatarUrl ? (
                <motion.img
                  src={avatarUrl}
                  alt={user.username}
                  className="w-7 h-7 rounded-full ring-2 ring-primary/40"
                  whileHover={{ scale: 1.1, ringColor: "rgba(255,0,128,0.7)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold group-hover:bg-primary/50 transition-colors">
                  {user.username[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium text-white hidden lg:block max-w-[120px] truncate group-hover:text-primary/80 transition-colors">
                {user.username}
              </span>
            </Link>
            <motion.button
              onClick={logout}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-white/5 transition-colors"
              whileTap={{ scale: 0.88 }}
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </motion.button>
          </div>
        ) : (
          <motion.a
            href="/api/auth/discord"
            className="md:ml-2 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#5865F2] hover:bg-[#4752C4] text-white transition-colors shrink-0"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            <span className="hidden xs:inline">Login with</span> Discord
          </motion.a>
        )
      )}
    </header>
  );
}

function MobileBottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: conversations = [] } = useConversations();
  const unreadCount = conversations.filter((c) => c.unread).length;

  const { data: adminMe } = useQuery<{ role: string }>({
    queryKey: ["admin-me"],
    queryFn: () => fetch("/api/admin/me", { credentials: "include" }).then((r) => r.json()),
    enabled: !!user,
    staleTime: 5_000,
    refetchInterval: 8_000,
  });
  const isStaff = !!adminMe && adminMe.role !== "none";

  const { data: ownProfile } = useOwnProfile();
  const discordAvatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : null;
  const avatarUrl = ownProfile?.customAvatarUrl ?? discordAvatarUrl;

  const items = [
    { href: "/", label: "Catalog", icon: ShoppingBag },
    { href: "/listings", label: "Listings", icon: LayoutList },
    { href: "/list", label: "List", icon: PackagePlus },
    { href: "/community", label: "Community", icon: Heart },
    ...(user ? [{ href: "/messages", label: "Inbox", icon: Inbox, badge: unreadCount }] : []),
    ...(isStaff ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
  ];

  return (
    <LayoutGroup id="mobile-nav">
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around bg-background/90 backdrop-blur-xl border-t border-white/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const active = location === item.href;
          const badge = (item as { badge?: number }).badge;
          return (
            <Link key={item.href} href={item.href}
              className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors relative",
                active ? "text-primary" : "text-muted-foreground hover:text-white")}>
              {active && (
                <motion.span
                  layoutId="mobile-nav-indicator"
                  className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary"
                  transition={SPRING_NAV}
                />
              )}
              <motion.span
                className="relative"
                animate={active ? { scale: 1.1 } : { scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
              >
                <Icon className="w-5 h-5" />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 rounded-full bg-primary text-[9px] text-white font-bold flex items-center justify-center leading-none">
                    {badge}
                  </span>
                )}
              </motion.span>
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}

        {/* Profile tab */}
        {user && (
          <Link href={`/profile/${user.id}`}
            className={cn("flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors relative",
              location.startsWith("/profile") ? "text-primary" : "text-muted-foreground hover:text-white")}>
            {location.startsWith("/profile") && (
              <motion.span
                layoutId="mobile-nav-indicator"
                className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary"
                transition={SPRING_NAV}
              />
            )}
            <motion.span
              className="relative"
              animate={location.startsWith("/profile") ? { scale: 1.1 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={user.username} className="w-5 h-5 rounded-full ring-1 ring-white/20" />
              ) : (
                <UserCircle2 className="w-5 h-5" />
              )}
            </motion.span>
            <span className="leading-none">Profile</span>
          </Link>
        )}
      </nav>
    </LayoutGroup>
  );
}

function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen w-full flex items-center justify-center bg-background text-foreground pt-16 px-4"
    >
      <div className="text-center space-y-4">
        <h1 className="text-7xl sm:text-8xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">404</h1>
        <p className="text-lg sm:text-xl text-muted-foreground">The page you're looking for doesn't exist.</p>
        <a href="/" className="inline-block mt-4 text-primary hover:text-primary/80 transition-colors underline underline-offset-4">
          Return to Catalog
        </a>
      </div>
    </motion.div>
  );
}

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

function AppRouter() {
  const [location] = useLocation();
  const pageKey = location.split("/")[1] || "home";

  return (
    <>
      <SiteTheme />
      <NavBar />
      <div className="pt-14 pb-20 md:pb-0">
        <motion.div
          key={pageKey}
          initial={PAGE_TRANSITION.initial}
          animate={PAGE_TRANSITION.animate}
          transition={PAGE_TRANSITION.transition}
        >
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/listings" component={ListingsPage} />
            <Route path="/list" component={ListPage} />
            <Route path="/messages" component={MessagesPage} />
            <Route path="/admin" component={AdminPage} />
            <Route path="/profile/:userId" component={ProfilePage} />
            <Route path="/community" component={CommunityPage} />
            <Route path="/tos" component={TosPage} />
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </div>
      <MobileBottomNav />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRouter />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
