import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-neutral-100">Not found</h1>
      <Link className="text-cyan-400 underline hover:text-cyan-300" to="/">Back to canvas</Link>
    </div>
  );
}
