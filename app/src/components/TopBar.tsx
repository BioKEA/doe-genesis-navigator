import { NavLink } from "react-router-dom";

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
  }`;

export default function TopBar() {
  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
      <div className="text-sm font-semibold">Genesis Partners</div>
      <nav className="flex gap-1">
        <NavLink to="/" end className={tabClass}>Browse</NavLink>
        <NavLink to="/network" className={tabClass}>Matchmaker</NavLink>
        <NavLink to="/compare" className={tabClass}>Compare</NavLink>
      </nav>
    </header>
  );
}
