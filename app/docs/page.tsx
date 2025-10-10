import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background">
        <div className="container flex h-16 items-center justify-between px-8">
          <Link href="/" className="text-2xl font-bold">
            ImgGo
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 container px-8 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-6">Documentation</h1>
        <p className="text-muted-foreground mb-8">
          Comprehensive documentation for ImgGo will be available here soon.
        </p>

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
            <p className="text-muted-foreground">
              Learn how to create your first pattern and process images.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">API Reference</h2>
            <p className="text-muted-foreground">
              Detailed API documentation for integrating ImgGo into your applications.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Examples</h2>
            <p className="text-muted-foreground">
              Code examples and use cases for common scenarios.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
