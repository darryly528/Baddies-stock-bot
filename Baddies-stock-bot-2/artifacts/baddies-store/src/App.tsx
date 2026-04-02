import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./pages/home";
import ListPage from "./pages/list";
import ListingsPage from "./pages/listings";
import { PackagePlus, ShoppingBag, LogOut, LayoutList } from "lucide-react";
import { cn } from "./lib/utils";
import { AuthProvider, useAuth } from "./contexts/auth-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function NavBar() {
  const [location] = useLocation();
  const { user, loading, logout } = useAuth();

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`
    : null;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b border-white/10 bg-background/80 backdrop-blur-md">
      <Link href="/" className="font-display font-extrabold text-xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-glow">
        Baddies Store
      </Link>
      <nav className="flex items-center gap-1">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
            location === "/"
              ? "bg-white/10 text-white"
              : "text-muted-foreground hover:text-white hover:bg-white/5"
          )}
        >
          <ShoppingBag className="w-4 h-4" />
          Catalog
        </Link>
        <Link
          href="/listings"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
            location === "/listings"
              ? "bg-white/10 text-white"
              : "text-muted-foreground hover:text-white hover:bg-white/5"
          )}
        >
          <LayoutList className="w-4 h-4" />
          Listings
        </Link>
        <Link
          href="/list"
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
            location === "/list"
              ? "bg-white/10 text-white"
              : "text-muted-foreground hover:text-white hover:bg-white/5"
          )}
        >
          <PackagePlus className="w-4 h-4" />
          List Items
        </Link>

        {!loading && (
          user ? (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
              {avatarUrl ? (
                <img src={avatarUrl} alt={user.username} className="w-7 h-7 rounded-full ring-2 ring-primary/40" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-xs font-bold">
                  {user.username[0]?.toUpperCase()}
                </div>
              )}
              <span className="text-sm font-medium text-white hidden sm:block">{user.username}</span>
              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-white/5 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/discord"
              className="ml-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#5865F2] hover:bg-[#4752C4] text-white transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.042.031.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Login with Discord
            </a>
          )
        )}
      </nav>
    </header>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground pt-16">
      <div className="text-center space-y-4">
        <h1 className="text-8xl font-display font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">404</h1>
        <p className="text-xl text-muted-foreground">The page you're looking for doesn't exist.</p>
        <a href="/" className="inline-block mt-4 text-primary hover:text-primary/80 transition-colors underline underline-offset-4">
          Return to Catalog
        </a>
      </div>
    </div>
  );
}

function AppRouter() {
  return (
    <>
      <NavBar />
      <div className="pt-14">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/listings" component={ListingsPage} />
          <Route path="/list" component={ListPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
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
