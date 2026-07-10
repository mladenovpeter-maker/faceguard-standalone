import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";

import Dashboard from "@/pages/dashboard";
import EmployeeList from "@/pages/employees/index";
import EmployeeNew from "@/pages/employees/new";
import EmployeeDetail from "@/pages/employees/detail";
import DepartmentList from "@/pages/departments/index";
import DepartmentSchedulesPage from "@/pages/department-schedules/index";
import CameraList from "@/pages/cameras/index";
import CameraNew from "@/pages/cameras/new";
import ZoneList from "@/pages/zones/index";
import AccessRulesList from "@/pages/access-rules/index";
import RecognitionList from "@/pages/recognitions/index";
import AttendanceList from "@/pages/attendance/index";
import LeavesPage from "@/pages/leaves/index";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground font-mono text-sm animate-pulse">Зареждане...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/employees" component={EmployeeList} />
        <Route path="/employees/new" component={EmployeeNew} />
        <Route path="/employees/:id" component={EmployeeDetail} />
        <Route path="/departments" component={DepartmentList} />
        <Route path="/department-schedules" component={DepartmentSchedulesPage} />
        <Route path="/cameras" component={CameraList} />
        <Route path="/cameras/new" component={CameraNew} />
        <Route path="/zones" component={ZoneList} />
        <Route path="/access-rules" component={AccessRulesList} />
        <Route path="/recognitions" component={RecognitionList} />
        <Route path="/attendance" component={AttendanceList} />
        <Route path="/leaves" component={LeavesPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="faceguard-theme">
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
