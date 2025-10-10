import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-8">
          <Link href="/" className="text-2xl font-bold">
            ImgGo
          </Link>
          <Link
            href="/auth/signin"
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-accent transition"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 pt-16">
        <main className="text-center w-full max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold mb-6">ImgGo</h1>
          <p className="text-xl text-muted-foreground mb-8 mx-auto max-w-2xl">
            Turn images into strictly schema-conformant manifests.
            <br />
            JSON, YAML, XML, CSV, or plain text - always consistent.
          </p>

          <div className="flex gap-4 justify-center mb-16">
            <Link
              href="/auth/signin"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
            >
              Get Started
            </Link>
            <Link
              href="/docs"
              className="px-6 py-3 border border-border rounded-lg hover:bg-accent transition"
            >
              Documentation
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-8 w-full">
            <div className="p-6 border border-border rounded-lg">
              <h3 className="font-semibold mb-2">Predictable</h3>
              <p className="text-sm text-muted-foreground">
                Define your schema once, get consistent output every time
              </p>
            </div>
            <div className="p-6 border border-border rounded-lg">
              <h3 className="font-semibold mb-2">Scalable</h3>
              <p className="text-sm text-muted-foreground">
                Process thousands of images per minute with queue-based workers
              </p>
            </div>
            <div className="p-6 border border-border rounded-lg">
              <h3 className="font-semibold mb-2">Flexible</h3>
              <p className="text-sm text-muted-foreground">
                Output in JSON, YAML, XML, CSV, or plain text format
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
