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
import OnboardingPage from "@/pages/OnboardingPage";
import CheckEmailPage from "@/pages/CheckEmailPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import PricingPage from "@/pages/PricingPage";
import CoachDashboard from "@/pages/CoachDashboard";
import CoachSessionPage from "@/pages/CoachSessionPage";
import CoachMessagesPage from "@/pages/CoachMessagesPage";
import AcceptInvitePage from "@/pages/AcceptInvitePage";
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
      <Route path="/onboarding">
        {!isLoading && !user ? <Redirect to="/auth" /> : <OnboardingPage />}
      </Route>
      <Route path="/check-email" component={CheckEmailPage} />
      <Route path="/verify" component={VerifyEmailPage} />
      <Route path="/" component={Home} />
      <Route path="/biometrics" component={Biometrics} />
      <Route path="/development" component={Development} />
      <Route path="/library" component={Library} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/my-swings" component={MySwings} />
      <Route path="/coach" component={CoachDashboard} />
      <Route path="/coach/session" component={CoachSessionPage} />
      <Route path="/coach/messages" component={CoachMessagesPage} />
      <Route path="/invite/accept" component={AcceptInvitePage} />
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
