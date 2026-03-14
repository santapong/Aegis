import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 font-sans">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Aegis Autonomous Wealth OS
        </h1>
        <p className="text-zinc-400 max-w-md">
          AI-driven financial operating system for automated wealth management.
        </p>
        <div className="flex gap-4">
          <Link
            href="/gantt"
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Gantt Chart
          </Link>
        </div>
      </main>
    </div>
  );
}
