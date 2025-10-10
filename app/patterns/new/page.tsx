"use client";

import { useState } from "react";

export default function NewPatternPage() {
  const [format, setFormat] = useState("json");

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Pattern Studio</h1>

        <div className="grid grid-cols-2 gap-8">
          {/* Left Column - Configuration */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                Pattern Name
              </label>
              <input
                type="text"
                placeholder="e.g., Retail Shelf Audit"
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="json">JSON</option>
                <option value="yaml">YAML</option>
                <option value="xml">XML</option>
                <option value="csv">CSV</option>
                <option value="text">Plain Text</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Instructions
              </label>
              <textarea
                placeholder="Describe what you want to extract from images..."
                rows={10}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                JSON Schema (Optional)
              </label>
              <textarea
                placeholder='{"type": "object", "properties": {...}}'
                rows={8}
                className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none font-mono text-sm"
              />
            </div>

            <button className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition">
              Create Pattern
            </button>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Template Preview</h2>
                <button className="px-3 py-1 text-sm border border-border rounded hover:bg-accent transition">
                  Generate Template
                </button>
              </div>
              <div className="border border-border rounded-lg p-4 bg-muted/30 min-h-[400px]">
                <pre className="text-sm font-mono">
                  <code>
                    {format === "json" &&
                      `{
  "example": "template",
  "will": "appear here"
}`}
                    {format === "yaml" &&
                      `example: template
will: appear here`}
                    {format === "xml" && `<root>
  <example>template</example>
  <will>appear here</will>
</root>`}
                    {format === "csv" && `example,will
template,appear here`}
                    {format === "text" && `Example: template
Will: appear here`}
                  </code>
                </pre>
              </div>
            </div>

            <div className="border border-border rounded-lg p-4 bg-muted/10">
              <h3 className="text-sm font-medium mb-2">After Publishing</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Your pattern will be accessible via:
              </p>
              <code className="text-xs bg-muted p-2 rounded block">
                POST /api/patterns/[id]/ingest
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
