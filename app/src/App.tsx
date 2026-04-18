import { HashRouter, Route, Routes } from "react-router-dom";
import TopBar from "./components/TopBar";
import Browse from "./routes/Browse";
import ProfileDetail from "./routes/ProfileDetail";
import Compare from "./routes/Compare";
import Network from "./routes/Network";
import NotFound from "./routes/NotFound";
import { useGlobalShortcuts } from "./lib/keyboard";

export default function App() {
  useGlobalShortcuts();
  return (
    <HashRouter>
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Browse />} />
            <Route path="/profile/:slug" element={<ProfileDetail />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/network" element={<Network />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
