import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center">
      <p className="text-8xl font-black text-indigo-500 opacity-40 select-none">404</p>
      <h1 className="text-2xl font-bold text-white">Page not found</h1>
      <p className="text-slate-400">The page you're looking for doesn't exist.</p>
      <Link to="/" className="btn-primary mt-2">Go home</Link>
    </div>
  );
}
