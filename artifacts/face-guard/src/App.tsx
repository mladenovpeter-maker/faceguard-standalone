import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import EmployeeList from "@/pages/employees/index";
import EmployeeNew from "@/pages/employees/new";
import EmployeeDetail from "@/pages/employees/detail";
import CameraList from "@/pages/cameras/index";
import CameraNew from "@/pages/cameras/new";
import ZoneList from "@/pages/zones/index";
import AccessRulesList from "@/pages/access-rules/index";
import RecognitionList from "@/pages/recognitions/index";
import AttendanceList from "@/pages/attendance/index";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/employees" component={EmployeeList} />
        <Route path="/employees/new" component={EmployeeNew} />
        <Route path="/employees/:id" component={EmployeeDetail} />
        <Route path="/cameras" component={CameraList} />
        <Route path="/cameras/new" component={CameraNew} />
        <Route path="/zones" component={ZoneList} />
        <Route path="/access-rules" component={AccessRulesList} />
        <Route path="/recognitions" component={RecognitionList} />
        <Route path="/attendance" component={AttendanceList} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="faceguard-theme">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
