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
import CoachSessionReviewPage from "@/pages/CoachSessionReviewPage";
import CoachMessagesPage from "@/pages/CoachMessagesPage";
import AcceptInvitePage from "@/pages/AcceptInvitePage";
import AboutPage from "@/pages/AboutPage";
import StudioStatdle from "@/pages/StudioStatdle";
import { useAuth } from "@/hooks/use-auth";
import { AthleteProvider } from "@/hooks/use-athletes";

function AdminRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/auth" />;
  if (!user.isAdmin) return <Redirect to="/" />;
  return <Admin />;
}

// Requires login + completed onboarding
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/auth" />;
  if (!user.profileComplete) return <Redirect to="/onboarding" />;
  return <Component />;
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
      <Route path="/about" component={AboutPage} />
      <Route path="/statdle" component={StudioStatdle} />
      <Route path="/invite/accept" component={AcceptInvitePage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/biometrics">
        <ProtectedRoute component={Biometrics} />
      </Route>
      <Route path="/development">
        <ProtectedRoute component={Development} />
      </Route>
      <Route path="/library">
        <ProtectedRoute component={Library} />
      </Route>
      <Route path="/my-swings">
        <ProtectedRoute component={MySwings} />
      </Route>
      <Route path="/coach">
        <ProtectedRoute component={CoachDashboard} />
      </Route>
      <Route path="/coach/session">
        <ProtectedRoute component={CoachSessionPage} />
      </Route>
      <Route path="/coach/session/review">
        <ProtectedRoute component={CoachSessionReviewPage} />
      </Route>
      <Route path="/coach/messages">
        <ProtectedRoute component={CoachMessagesPage} />
      </Route>
      <Route path="/admin" component={AdminRoute} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AthleteProvider>
          <Toaster />
          <Router />
        </AthleteProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
