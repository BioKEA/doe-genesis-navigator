import { NavLink } from "react-router-dom";

export default function TopBar() {
  return (
    <header className="flex items-center gap-4 border-b border-neutral-800 bg-neutral-950 px-4 py-3">
      <div className="text-sm font-semibold text-neutral-100">
        Genesis · Partners
      </div>
      <div className="flex-1" />
      <NavLink
        to="/composer"
        className={({ isActive }) =>
          `px-3 py-1.5 rounded-md text-sm ${
            isActive
              ? "bg-neutral-700 text-white"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          }`
        }
      >
        Composer
      </NavLink>
    </header>
  );
}
