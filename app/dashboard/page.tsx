import Link from "next/link";
import { Navbar } from "@/ui/components/navbar";

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Link
            href="/patterns/new"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            Create Pattern
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="p-6 border border-border rounded-lg">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Active Patterns
            </h3>
            <p className="text-3xl font-bold">0</p>
          </div>
          <div className="p-6 border border-border rounded-lg">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Jobs Today
            </h3>
            <p className="text-3xl font-bold">0</p>
          </div>
          <div className="p-6 border border-border rounded-lg">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Success Rate
            </h3>
            <p className="text-3xl font-bold">0%</p>
          </div>
        </div>

        <div className="border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Your Patterns</h2>
          <p className="text-muted-foreground">
            No patterns yet. Create your first pattern to get started.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
