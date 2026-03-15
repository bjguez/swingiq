import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Development from "@/pages/Development";
import Biometrics from "@/pages/Biometrics";
import Library from "@/pages/Library";
import MySwings from "@/pages/MySwings";
import Admin from "@/pages/Admin";
import AuthPage from "@/pages/AuthPage";
import { useAuth } from "@/hooks/use-auth";

function AdminRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/auth" />;
  if (!user.isAdmin) return <Redirect to="/" />;
  return <Admin />;
}

function Router() {
  const { user, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/auth">
        {!isLoading && user ? <Redirect to="/" /> : <AuthPage />}
      </Route>
      <Route path="/" component={Home} />
      <Route path="/biometrics" component={Biometrics} />
      <Route path="/development" component={Development} />
      <Route path="/library" component={Library} />
      <Route path="/my-swings" component={MySwings} />
      <Route path="/admin" component={AdminRoute} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
