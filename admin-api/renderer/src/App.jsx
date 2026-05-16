import { useState } from "react";
import "./App.css";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import EventTypeDashboard from "./pages/EventTypeDashboard";
import GeminiQueryDashboard from "./pages/GeminiQueryDashboard";
import RealtimeDashboard from "./pages/RealtimeDashboard";
import { getPageTitle } from "./constants/navigation";

export default function App() {
  const [activeView, setActiveView] = useState("REALTIME");
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        onChangeView={setActiveView}
        onLogout={() => setIsAuthenticated(false)}
      />

      <main className="content">
        <Topbar title={getPageTitle(activeView)} />

        {activeView === "REALTIME" && <RealtimeDashboard />}
        {activeView === "GEMINI" && <GeminiQueryDashboard />}
        {activeView !== "REALTIME" && activeView !== "GEMINI" && (
          <EventTypeDashboard eventType={activeView} />
        )}
      </main>
    </div>
  );
}
