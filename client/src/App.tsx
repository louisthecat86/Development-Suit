import { Switch, Route, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/layout";
import NotFound from "@/pages/not-found";
import IngredientDatabase from "@/pages/ingredients-db";
import RecipeDatabase from "@/pages/recipes-db";
import RecipeReverser from "@/pages/reverser";
import ProductDashboard from "@/pages/product-dashboard";
import QuidCalculator from "@/pages/quid-calculator";
import LabelDesigner from "@/pages/label-designer";
import StatisticsPage from "@/pages/statistics";

function AppRouter() {
  return (
    <WouterRouter hook={useHashLocation}>
      <Layout>
        <Switch>
          <Route path="/" component={ProductDashboard} />
          <Route path="/recipes" component={RecipeDatabase} />
          <Route path="/ingredients" component={IngredientDatabase} />
          <Route path="/statistics" component={StatisticsPage} />
          <Route path="/reverser" component={RecipeReverser} />
          <Route path="/quid-calculator" component={QuidCalculator} />
          <Route path="/label-designer" component={LabelDesigner} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
