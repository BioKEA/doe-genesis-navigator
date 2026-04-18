import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Not found</h1>
      <Link className="text-sky-700 underline" to="/">Back to browse</Link>
    </div>
  );
}
