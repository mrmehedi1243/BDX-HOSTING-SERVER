import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Servers from "@/pages/servers";
import ConsoleView from "@/pages/console";
import AdminPlans from "@/pages/admin/plans";
import AdminUsers from "@/pages/admin/users";
import AdminServers from "@/pages/admin/servers";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/servers" component={Servers} />
        <Route path="/console/:serverId" component={ConsoleView} />
        <Route path="/admin/plans" component={AdminPlans} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/servers" component={AdminServers} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
