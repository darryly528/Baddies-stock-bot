import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Home from "./pages/home";
import ListPage from "./pages/list";
import { PackagePlus, ShoppingBag } from "lucide-react";
import { cn } from "./lib/utils";

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
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 border-b border-white/10 bg-background/80 backdrop-blur-md">
      <Link href="/" className="font-display font-extrabold text-xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary text-glow">
        Baddies Store
      </Link>
      <nav className="flex gap-1">
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
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AppRouter />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
