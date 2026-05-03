import { Link, NavLink } from "react-router-dom";

export default function TopBar() {
  return (
    <header className="flex items-center gap-4 border-b border-neutral-800 bg-neutral-950 px-4 py-2.5">
      <a
        href="https://biokea.ai"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center transition-opacity hover:opacity-80"
        title="Built by BioKEA — biology, decoded in the public interest"
      >
        <img
          src="/brand/biokea-logo-white.png"
          alt="BioKEA"
          className="h-7 w-auto"
        />
      </a>
      <div className="h-6 w-px bg-neutral-700" />
      <Link to="/" className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-neutral-100">
          Genesis Mission · Partner Navigator
        </span>
        <span className="text-[11px] text-neutral-500">
          486 partners · 125 concepts · ~7,900 matches
        </span>
      </Link>
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
