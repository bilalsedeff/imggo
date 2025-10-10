import Link from "next/link";

export default function PatternsPage() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Patterns</h1>
            <p className="text-muted-foreground">
              Manage your image analysis patterns and schemas
            </p>
          </div>
          <Link
            href="/patterns/new"
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            New Pattern
          </Link>
        </div>

        <div className="border border-border rounded-lg p-6">
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              No patterns created yet
            </p>
            <Link
              href="/patterns/new"
              className="text-primary hover:underline"
            >
              Create your first pattern →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
