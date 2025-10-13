"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import {
  Sparkles,
  Lightbulb,
  LogIn,
  MoreVertical,
  Edit3,
  CheckCircle,
  ArrowRight,
  AlertCircle,
  RotateCcw,
  PlusCircle,
  RefreshCw
} from "lucide-react";
import { Navbar } from "@/ui/components/navbar";
import Link from "next/link";

import { PATTERN_LIMITS, validateMarkdownHeadings } from "@/schemas/pattern";

type ManifestFormat = "json" | "yaml" | "xml" | "csv" | "text";

interface ValidationError {
  line: number;
  message: string;
}

interface Pattern {
  id: string;
  name: string;
  format: ManifestFormat;
  instructions: string;
  json_schema: Record<string, unknown> | null;
  version: number;
}

export default function NewPatternPage() {
  const router = useRouter();
  const { session } = useAuth();

  // Pattern selection
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [activePatterns, setActivePatterns] = useState<Pattern[]>([]);
  const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [format, setFormat] = useState<ManifestFormat>("json");
  const [instructions, setInstructions] = useState("");
  const [originalInstructions, setOriginalInstructions] = useState("");
  const [jsonSchema, setJsonSchema] = useState("");
  const [template, setTemplate] = useState("");

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isTemplateEditable, setIsTemplateEditable] = useState(false);
  const [isValidated, setIsValidated] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [markdownError, setMarkdownError] = useState<string>("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return undefined;
  }, [showMenu]);

  // Load active patterns on mount
  useEffect(() => {
    if (!session?.access_token) return;

    const loadActivePatterns = async () => {
      setIsLoadingPatterns(true);
      try {
        const response = await fetch("/api/patterns?is_active=true&per_page=100", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setActivePatterns(result.data?.data || []);
        }
      } catch (err) {
        console.error("Failed to load patterns:", err);
      } finally {
        setIsLoadingPatterns(false);
      }
    };

    loadActivePatterns();
  }, [session]);

  // Load pattern from URL query param (for "Create New Version")
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const patternId = params.get("pattern_id");

    if (patternId && activePatterns.length > 0) {
      handlePatternSelect(patternId);
    }
  }, [activePatterns]); // Run after patterns are loaded

  // Load draft from sessionStorage on mount
  useEffect(() => {
    const loadDraftData = sessionStorage.getItem("loadDraft");
    if (loadDraftData) {
      try {
        const draft = JSON.parse(loadDraftData);
        setName(draft.name || "");
        setFormat(draft.format || "json");
        setInstructions(draft.instructions || "");
        setOriginalInstructions(draft.original_instructions || "");
        setJsonSchema(draft.json_schema || "");
        setTemplate(draft.template || "");
        sessionStorage.removeItem("loadDraft"); // Clear after loading
      } catch (err) {
        console.error("Failed to load draft:", err);
      }
    }
  }, []);

  // Handle pattern selection
  const handlePatternSelect = (patternId: string) => {
    if (patternId === "new") {
      // Reset form for new pattern
      setSelectedPatternId(null);
      setName("");
      setFormat("json");
      setInstructions("");
      setOriginalInstructions("");
      setJsonSchema("");
      setTemplate("");
      setNameAvailable(null);
      setIsValidated(false);
      setValidationErrors([]);
      return;
    }

    const pattern = activePatterns.find(p => p.id === patternId);
    if (!pattern) return;

    // Fill form with pattern data (follow-up mode for instructions)
    setSelectedPatternId(pattern.id);
    setName(pattern.name);
    setFormat(pattern.format);
    setOriginalInstructions(pattern.instructions); // Store original
    setInstructions(""); // Empty for follow-up request

    const schemaStr = pattern.json_schema ? JSON.stringify(pattern.json_schema, null, 2) : "";
    setJsonSchema(schemaStr);

    // Generate format-specific template from json_schema
    let templatePreview = "";
    if (pattern.json_schema) {
      switch (pattern.format) {
        case "json":
          templatePreview = JSON.stringify(pattern.json_schema, null, 2);
          break;
        case "yaml":
          // Convert JSON to YAML-like format
          templatePreview = jsonToYaml(pattern.json_schema);
          break;
        case "xml":
          templatePreview = jsonToXml(pattern.json_schema);
          break;
        case "csv":
          templatePreview = jsonToCsv(pattern.json_schema);
          break;
        case "text":
          templatePreview = jsonToText(pattern.json_schema);
          break;
        default:
          templatePreview = schemaStr;
      }
    }
    setTemplate(templatePreview);
    setIsTemplateEditable(false); // Don't mark as editable initially - only when user clicks "Edit Template"

    setNameAvailable(true); // Pattern name is already valid (skip validation)
    setIsValidated(true); // Published template is already valid
    setValidationErrors([]);
  };

  // Check pattern name availability
  const checkNameAvailability = async () => {
    if (!session?.access_token || !name.trim()) {
      setNameAvailable(null);
      return;
    }

    setIsCheckingName(true);
    try {
      const response = await fetch(
        `/api/patterns/check-name?name=${encodeURIComponent(name.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log("Name check response:", result);
        // API returns { success: true, data: { available: boolean } }
        const available = result.data?.available;
        console.log("Setting nameAvailable to:", available);
        setNameAvailable(available);
      } else {
        console.error("Name check failed:", response.status);
        setNameAvailable(null);
      }
    } catch (err) {
      console.error("Failed to check name availability:", err);
      setNameAvailable(null);
    } finally {
      setIsCheckingName(false);
    }
  };

  // Check if validation is needed
  const needsValidation = template && isTemplateEditable && !isValidated;

  // Check if publish is enabled
  const canPublish =
    session &&
    name.trim() &&
    nameAvailable !== false && // Only block if explicitly unavailable
    (originalInstructions || instructions.trim().length >= 30) && // Either has original or current is valid
    template &&
    (!isTemplateEditable || isValidated);

  const handleGenerateTemplate = async () => {
    const isFollowUp = template && originalInstructions;

    // Validation: ilk generate için 30 karakter, follow-up için en az 10 karakter
    if (!instructions.trim()) {
      setError("Please enter instructions");
      return;
    }

    if (!isFollowUp && instructions.trim().length < 30) {
      setError("Instructions must be at least 30 characters");
      return;
    }

    if (isFollowUp && instructions.trim().length < 10) {
      setError("Follow-up request must be at least 10 characters");
      return;
    }

    if (!session?.access_token) {
      setError("Please sign in to generate templates");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const requestBody = isFollowUp
        ? {
            // Follow-up request
            name: name || undefined,
            original_instructions: originalInstructions,
            current_template: template,
            follow_up_prompt: instructions,
            format,
            jsonSchema: jsonSchema ? JSON.parse(jsonSchema) : undefined,
          }
        : {
            // Initial request
            name: name || undefined,
            instructions,
            format,
            jsonSchema: jsonSchema ? JSON.parse(jsonSchema) : undefined,
          };

      const response = await fetch("/api/patterns/generate-template", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to generate template");
      }

      const data = await response.json();

      // Clean markdown code blocks from AI response
      const cleanedTemplate = data.template
        .replace(/```json\s*/g, '')
        .replace(/```yaml\s*/g, '')
        .replace(/```xml\s*/g, '')
        .replace(/```csv\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      setTemplate(cleanedTemplate);
      setIsTemplateEditable(false);
      setIsValidated(false);
      setValidationErrors([]);

      // İlk generate ise: originalInstructions'a kaydet ve instructions'ı temizle
      if (!isFollowUp) {
        setOriginalInstructions(instructions);
        setInstructions("");
      } else {
        // Follow-up ise: sadece instructions'ı temizle (original'ı koru)
        setInstructions("");
      }
    } catch (err) {
      console.error("Generate error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate template");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditTemplate = () => {
    setIsTemplateEditable(true);
    setIsValidated(false);
    setShowMenu(false);
  };

  const handleReset = () => {
    if (selectedPatternId) {
      // Update mode: Reset to published pattern's data
      const pattern = activePatterns.find(p => p.id === selectedPatternId);
      if (pattern) {
        setInstructions(""); // Clear follow-up request

        // Restore published template
        let templatePreview = "";
        if (pattern.json_schema) {
          switch (pattern.format) {
            case "json":
              templatePreview = JSON.stringify(pattern.json_schema, null, 2);
              break;
            case "yaml":
              templatePreview = jsonToYaml(pattern.json_schema);
              break;
            case "xml":
              templatePreview = jsonToXml(pattern.json_schema);
              break;
            case "csv":
              templatePreview = jsonToCsv(pattern.json_schema);
              break;
            case "text":
              templatePreview = jsonToText(pattern.json_schema);
              break;
          }
        }
        setTemplate(templatePreview);
        setIsTemplateEditable(false); // Lock template to published version
        setIsValidated(false);
        setValidationErrors([]);
        setError("");
        setSuccess("");
      }
    } else {
      // New pattern mode: Clear everything
      setName("");
      setInstructions("");
      setOriginalInstructions("");
      setTemplate("");
      setIsTemplateEditable(false);
      setIsValidated(false);
      setValidationErrors([]);
      setError("");
      setSuccess("");
    }
  };

  const handleValidate = () => {
    // Always reset state at the beginning
    setValidationErrors([]);
    setMarkdownError("");
    setError("");
    setIsValidated(false);

    try {
      if (format === "json") {
        JSON.parse(template);
      } else if (format === "yaml") {
        // Basic YAML validation
        if (!template.trim()) throw new Error("Empty YAML");
      } else if (format === "xml") {
        // Basic XML validation
        const parser = new DOMParser();
        const doc = parser.parseFromString(template, "text/xml");
        const errors = doc.querySelectorAll("parsererror");
        if (errors.length > 0) throw new Error("Invalid XML");
      } else if (format === "csv") {
        // Basic CSV validation
        if (!template.trim()) throw new Error("Empty CSV");
      } else if (format === "text") {
        // Plain Text markdown heading validation
        const validation = validateMarkdownHeadings(template);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }

      // If we get here, validation succeeded
      setIsValidated(true);
      setShowMenu(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Validation failed";
      setError(errorMessage);
      setMarkdownError(errorMessage);

      // Try to extract line number from error
      const lineMatch = errorMessage.match(/line (\d+)/i) || errorMessage.match(/position (\d+)/i);
      if (lineMatch && lineMatch[1]) {
        setValidationErrors([{
          line: parseInt(lineMatch[1], 10),
          message: errorMessage,
        }]);
      }

      setIsValidated(false);
      setShowMenu(false);
    }
  };

  const handleCopySchemaToTemplate = () => {
    if (!jsonSchema.trim()) {
      setError("JSON Schema is empty");
      return;
    }

    try {
      // Validate JSON Schema first
      JSON.parse(jsonSchema);
      setTemplate(jsonSchema);
      setIsTemplateEditable(true);
      setIsValidated(false);
      setError("");
    } catch (err) {
      setError("Invalid JSON Schema - cannot copy");
    }
  };

  const handlePublishPattern = async () => {
    if (!session?.access_token) {
      router.push(`/auth/signin?redirectTo=/patterns/new`);
      return;
    }

    // If name hasn't been checked yet, check it now before publishing
    if (nameAvailable === null && name.trim()) {
      setIsCheckingName(true);
      try {
        const response = await fetch(
          `/api/patterns/check-name?name=${encodeURIComponent(name.trim())}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (response.ok) {
          const result = await response.json();
          const available = result.data?.available;

          if (available === false) {
            setNameAvailable(false);
            setIsCheckingName(false);
            return;
          }

          setNameAvailable(available);
        }
      } catch (err) {
        console.error("Failed to check name availability:", err);
        setError("Could not verify pattern name availability. Please try again.");
        setIsCheckingName(false);
        return;
      } finally {
        setIsCheckingName(false);
      }
    }

    // Block if name is explicitly unavailable
    if (nameAvailable === false) {
      // Don't set error - the inline warning under the input is enough
      return;
    }

    setIsPublishing(true);
    setError("");

    try {
      // Prepare schema based on format
      const schemaData: Record<string, unknown> = {};

      // Clean markdown code blocks from template (AI sometimes returns ```json ... ```)
      const cleanTemplate = (text: string): string => {
        return text
          .replace(/```json\s*/g, '')
          .replace(/```yaml\s*/g, '')
          .replace(/```xml\s*/g, '')
          .replace(/```csv\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
      };

      // Use template (what user sees in Template Preview) as the schema
      if (template) {
        const cleaned = cleanTemplate(template);

        if (format === "json") {
          schemaData.json_schema = JSON.parse(cleaned);
        } else if (format === "yaml") {
          schemaData.yaml_schema = cleaned;
        } else if (format === "xml") {
          schemaData.xml_schema = cleaned;
        } else if (format === "csv") {
          schemaData.csv_schema = cleaned;
        } else if (format === "text") {
          schemaData.plain_text_schema = cleaned;
        }
      }

      if (selectedPatternId) {
        // Update existing pattern (increment version)
        const updatePayload = {
          format,
          instructions: originalInstructions + (instructions ? `\n\n${instructions}` : ""), // Append follow-up
          ...schemaData, // Spread format-specific schema
          publish_new_version: true, // Increment version on update
        };

        console.log("Update payload:", JSON.stringify(updatePayload, null, 2));

        const response = await fetch(`/api/patterns/${selectedPatternId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Update failed:", errorData);
          throw new Error(errorData.error?.message || errorData.message || "Failed to update pattern");
        }

        setSuccess(`Pattern "${name}" updated successfully! New version created.`);
      } else {
        // Create new pattern (version 1)
        // Prepare schema for new pattern
        const newPatternSchema: Record<string, unknown> = {
          name,
          format,
          instructions: originalInstructions || instructions,
        };

        // Add format-specific schema if template exists
        // CRITICAL: Send the EXACT template user approved in Pattern Studio
        if (template) {
          const cleaned = cleanTemplate(template);

          if (format === "json") {
            newPatternSchema.json_schema = JSON.parse(cleaned);
          } else if (format === "yaml") {
            newPatternSchema.yaml_schema = cleaned;
          } else if (format === "xml") {
            newPatternSchema.xml_schema = cleaned;
          } else if (format === "csv") {
            newPatternSchema.csv_schema = cleaned;
          } else if (format === "text") {
            newPatternSchema.plain_text_schema = cleaned;
          }
        }

        console.log("Create payload:", JSON.stringify(newPatternSchema, null, 2));

        const response = await fetch("/api/patterns", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(newPatternSchema),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "Failed to publish pattern");
        }

        setSuccess(`Pattern "${name}" published successfully!`);
      }

      setTimeout(() => {
        window.location.href = "/patterns";
      }, 1500);
    } catch (err) {
      console.error("Publish error:", err);
      setError(err instanceof Error ? err.message : "Failed to publish pattern");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!session?.access_token) {
      router.push(`/auth/signin?redirectTo=/patterns/new`);
      return;
    }

    setIsSavingDraft(true);
    setError("");
    setSuccess("");

    try {
      // If updating existing pattern, warn user about draft behavior
      if (selectedPatternId) {
        setSuccess(
          `Draft saved locally. Note: The published version ${(activePatterns.find(p => p.id === selectedPatternId)?.version || 0)} remains active until you publish.`
        );
        setTimeout(() => setSuccess(""), 5000);
      } else {
        setSuccess("Draft saved successfully!");
        setTimeout(() => setSuccess(""), 3000);
      }

      const draftData = {
        name: name || "Untitled Draft",
        format,
        instructions,
        original_instructions: originalInstructions || null,
        json_schema: jsonSchema || null,
        template: template || null,
        pattern_id: selectedPatternId || null, // Store which pattern this is a draft for
      };

      // Save to localStorage
      const drafts = JSON.parse(localStorage.getItem("pattern_drafts") || "[]");
      const draftId = Date.now().toString();
      drafts.push({
        id: draftId,
        ...draftData,
        created_at: new Date().toISOString(),
        user_id: session.user?.id,
      });
      localStorage.setItem("pattern_drafts", JSON.stringify(drafts));
    } catch (err) {
      console.error("Save draft error:", err);
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Format conversion helpers
  const jsonToYaml = (obj: Record<string, unknown>): string => {
    const toYamlString = (data: unknown, indent = 0): string => {
      const spaces = "  ".repeat(indent);
      if (typeof data === "object" && data !== null && !Array.isArray(data)) {
        return Object.entries(data)
          .map(([key, value]) => {
            if (typeof value === "object" && value !== null) {
              return `${spaces}${key}:\n${toYamlString(value, indent + 1)}`;
            }
            return `${spaces}${key}: ${JSON.stringify(value)}`;
          })
          .join("\n");
      }
      if (Array.isArray(data)) {
        return data.map(item => `${spaces}- ${JSON.stringify(item)}`).join("\n");
      }
      return `${spaces}${JSON.stringify(data)}`;
    };
    return toYamlString(obj);
  };

  const jsonToXml = (obj: Record<string, unknown>): string => {
    const toXmlString = (data: unknown, key = "root"): string => {
      if (typeof data === "object" && data !== null && !Array.isArray(data)) {
        const children = Object.entries(data)
          .map(([k, v]) => toXmlString(v, k))
          .join("\n  ");
        return `<${key}>\n  ${children}\n</${key}>`;
      }
      if (Array.isArray(data)) {
        return data.map(item => toXmlString(item, "item")).join("\n");
      }
      return `<${key}>${data}</${key}>`;
    };
    return toXmlString(obj);
  };

  const jsonToCsv = (obj: Record<string, unknown>): string => {
    const keys = Object.keys(obj);
    const values = Object.values(obj).map(v => JSON.stringify(v));
    return `${keys.join(",")}\n${values.join(",")}`;
  };

  const jsonToText = (obj: Record<string, unknown>): string => {
    return Object.entries(obj)
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
      .join("\n");
  };

  const getFormatPlaceholder = (): string => {
    switch (format) {
      case "json":
        return '{\n  "key": "value"\n}';
      case "yaml":
        return 'key: value\nlist:\n  - item1\n  - item2';
      case "xml":
        return '<root>\n  <item>value</item>\n</root>';
      case "csv":
        return 'header1,header2,header3\nvalue1,value2,value3';
      case "text":
        return 'Plain text output...';
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Pattern Studio</h1>
            <p className="text-muted-foreground mt-2">
              Create a new pattern to analyze images with AI
            </p>
          </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive flex items-start gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 dark:text-green-400 flex items-start gap-2">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-8">
          {/* Left Column: Configuration */}
          <div className="space-y-6">
            {/* Pattern Selection */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center gap-2">
                {selectedPatternId ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Update Pattern
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    Pattern Mode
                  </>
                )}
              </label>
              <select
                value={selectedPatternId || "new"}
                onChange={(e) => handlePatternSelect(e.target.value)}
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                disabled={isLoadingPatterns}
              >
                <option value="new">Create New Pattern</option>
                {activePatterns.length > 0 && (
                  <>
                    <option disabled>──────────</option>
                    {activePatterns.map((pattern) => (
                      <option key={pattern.id} value={pattern.id}>
                        {pattern.name} (v{pattern.version})
                      </option>
                    ))}
                  </>
                )}
              </select>
              {selectedPatternId && (
                <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Publishing will create version{" "}
                  {(activePatterns.find(p => p.id === selectedPatternId)?.version || 0) + 1}
                </p>
              )}
            </div>

            {/* Pattern Name */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Pattern Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameAvailable(null); // Reset validation on change
                  }}
                  onBlur={checkNameAvailability}
                  placeholder="My Pattern"
                  disabled={selectedPatternId !== null}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-background ${
                    selectedPatternId
                      ? "opacity-60 cursor-not-allowed"
                      : nameAvailable === false
                      ? "border-destructive focus:ring-destructive"
                      : nameAvailable === true
                      ? "border-green-500 focus:ring-green-500"
                      : "border-border focus:ring-primary"
                  }`}
                />
                {isCheckingName && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              {!selectedPatternId && nameAvailable === false && name.trim() && (
                <p className="mt-2 text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>A pattern with this name already exists. Please choose a different name.</span>
                </p>
              )}
              {!selectedPatternId && nameAvailable === true && name.trim() && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>This name is available</span>
                </p>
              )}
            </div>

            {/* Format Selection - only show in create mode */}
            {!selectedPatternId && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Output Format
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as ManifestFormat)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                >
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="xml">XML</option>
                  <option value="csv">CSV</option>
                  <option value="text">Plain Text</option>
                </select>
              </div>
            )}

            {/* Show current format in update mode (read-only) */}
            {selectedPatternId && (
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-muted-foreground">Output Format</span>
                </div>
                <p className="text-sm uppercase font-semibold">
                  {format}
                </p>
              </div>
            )}

            {/* Original Instructions (shown in update mode) */}
            {originalInstructions && (
              <div className="bg-muted/50 border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Current Instructions (v{(activePatterns.find(p => p.id === selectedPatternId)?.version || 0)})
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {originalInstructions}
                </p>
              </div>
            )}

            {/* Instructions */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  <span>{originalInstructions ? "Follow-up Request" : "Instructions"}</span>
                </div>
                {template && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition"
                    title="Reset pattern"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder={
                  originalInstructions
                    ? "Optional: Add refinements or changes (e.g., 'Also extract brand names', 'Add price field'). Leave empty to keep same instructions."
                    : "Describe what you want to extract from images..."
                }
                rows={originalInstructions ? 4 : 6}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background resize-none ${
                  instructions.length > 0 &&
                  ((originalInstructions && instructions.length < 10) ||
                    (!originalInstructions && instructions.length < 30))
                    ? "border-destructive"
                    : instructions.length > PATTERN_LIMITS.INSTRUCTIONS_MAX
                    ? "border-destructive"
                    : "border-border"
                }`}
              />
              <div className="flex items-center justify-between mt-1">
                <span className={`text-xs ${
                  instructions.length > PATTERN_LIMITS.INSTRUCTIONS_MAX
                    ? "text-destructive font-medium"
                    : instructions.length > PATTERN_LIMITS.INSTRUCTIONS_MAX * 0.9
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-muted-foreground"
                }`}>
                  {originalInstructions
                    ? instructions.length === 0 ? "Optional" : `${instructions.length} characters`
                    : instructions.length < 30
                    ? `Min. 30 characters (${instructions.length}/30)`
                    : `${instructions.length} characters`}
                </span>
                <span className={`text-xs ${
                  instructions.length > PATTERN_LIMITS.INSTRUCTIONS_MAX
                    ? "text-destructive font-medium"
                    : "text-muted-foreground"
                }`}>
                  Max: {PATTERN_LIMITS.INSTRUCTIONS_MAX}
                </span>
              </div>
            </div>

            {/* JSON Schema */}
            <div>
              <label className="text-sm font-medium mb-2 flex items-center justify-between">
                <span>{format.toUpperCase()} Schema (Optional)</span>
                {jsonSchema && (
                  <button
                    onClick={handleCopySchemaToTemplate}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition"
                  >
                    <span>Copy to Template</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </label>
              <textarea
                value={jsonSchema}
                onChange={(e) => setJsonSchema(e.target.value)}
                placeholder={
                  format === "json" ? '{"type": "object", "properties": {...}}' :
                  format === "yaml" ? 'key: value\nlist:\n  - item1\n  - item2' :
                  format === "xml" ? '<?xml version="1.0"?>\n<root>\n  <item>value</item>\n</root>' :
                  format === "csv" ? 'header1,header2,header3\nvalue1,value2,value3' :
                  format === "text" ? '# Main Heading\n[Placeholder]\n\n## Sub Heading\n[Placeholder]' :
                  '{"type": "object", "properties": {...}}'
                }
                rows={8}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background resize-none font-mono text-sm ${
                  jsonSchema.length > PATTERN_LIMITS.SCHEMA_MAX
                    ? "border-destructive"
                    : "border-border"
                }`}
              />
              <div className="flex items-center justify-end mt-1">
                <span className={`text-xs ${
                  jsonSchema.length > PATTERN_LIMITS.SCHEMA_MAX
                    ? "text-destructive font-medium"
                    : jsonSchema.length > PATTERN_LIMITS.SCHEMA_MAX * 0.9
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-muted-foreground"
                }`}>
                  {jsonSchema.length} / {PATTERN_LIMITS.SCHEMA_MAX} characters
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Template Preview */}
          <div className="space-y-6">
            {/* Template Preview Header with Menu */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  Template Preview
                </label>
                <div className="flex items-center gap-2">
                  {needsValidation && (
                    <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span>Validation needed</span>
                    </div>
                  )}

                  {/* Generate Template Button */}
                  <button
                    onClick={handleGenerateTemplate}
                    disabled={
                      isGenerating ||
                      (originalInstructions
                        ? instructions.length < 10
                        : instructions.length < 30)
                    }
                    className="relative group px-3 py-1.5 text-sm border border-primary text-primary rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <span className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-md blur opacity-15 group-hover:opacity-50 transition-all duration-500 [animation:pulse_8s_ease-in-out_infinite] group-hover:[animation:pulse_1s_ease-in-out_infinite]"></span>
                    <span className="relative flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {isGenerating ? "Generating..." : "Generate"}
                    </span>
                  </button>

                  {/* Three-dot Menu */}
                  {template && (
                    <div className="relative" ref={menuRef}>
                      <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 hover:bg-accent rounded-lg transition"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {showMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-lg shadow-lg py-1 z-50">
                          <button
                            onClick={handleEditTemplate}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-accent transition"
                          >
                            <Edit3 className="w-4 h-4" />
                            Edit Template
                          </button>
                          <button
                            onClick={handleValidate}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-accent transition"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Validate
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Template Textarea */}
              <div className="relative">
                <textarea
                  value={template}
                  onChange={(e) => {
                    setTemplate(e.target.value);
                    setIsValidated(false);
                  }}
                  placeholder={getFormatPlaceholder()}
                  readOnly={!isTemplateEditable}
                  rows={20}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 bg-background resize-none font-mono text-sm ${
                    !isTemplateEditable
                      ? "cursor-not-allowed bg-muted/30"
                      : validationErrors.length > 0
                      ? "border-destructive focus:ring-destructive"
                      : isValidated
                      ? "border-green-500 focus:ring-green-500"
                      : "border-border focus:ring-primary"
                  }`}
                />

                {/* Validation Status */}
                {isValidated && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-1 rounded">
                    <CheckCircle className="w-3 h-3" />
                    <span>Valid</span>
                  </div>
                )}

                {/* Validation Errors */}
                {validationErrors.length > 0 && (
                  <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                    <strong>Validation Errors:</strong>
                    <ul className="mt-1 space-y-1">
                      {validationErrors.map((error, idx) => (
                        <li key={idx}>
                          Line {error.line}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Markdown Error for Plain Text */}
                {format === "text" && markdownError && !validationErrors.length && (
                  <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                    <strong>Markdown Heading Error:</strong>
                    <p className="mt-1">{markdownError}</p>
                  </div>
                )}

                {/* Character Counter */}
                {template && (
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs ${
                      template.length > PATTERN_LIMITS.SCHEMA_MAX
                        ? "text-destructive font-medium"
                        : template.length > PATTERN_LIMITS.SCHEMA_MAX * 0.9
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-muted-foreground"
                    }`}>
                      {template.length} / {PATTERN_LIMITS.SCHEMA_MAX} characters
                    </span>
                    {format === "text" && isTemplateEditable && (
                      <button
                        onClick={handleValidate}
                        className="text-xs text-primary hover:text-primary/80 transition flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Validate Headings</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              {!session ? (
                <Link
                  href={`/auth/signin?redirectTo=/patterns/new`}
                  className="flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-lg hover:bg-accent transition"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in to Publish
                </Link>
              ) : (
                <>
                  <button
                    onClick={handlePublishPattern}
                    disabled={!canPublish || isPublishing}
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {isPublishing ? "Publishing..." : "Publish Pattern"}
                  </button>

                  <button
                    onClick={handleSaveDraft}
                    disabled={isSavingDraft || !name.trim()}
                    className="px-6 py-3 border border-border text-muted-foreground rounded-lg hover:bg-accent hover:text-foreground transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isSavingDraft ? "Saving..." : "Save Draft"}
                  </button>
                </>
              )}

              {/* Helper Text */}
              {!canPublish && session && (
                <p className="text-xs text-muted-foreground text-center">
                  {!name.trim()
                    ? "• Enter a pattern name"
                    : !originalInstructions && instructions.length < 30
                    ? `• Instructions too short (${instructions.length}/30)`
                    : !template
                    ? "• Generate a template first"
                    : needsValidation && !isValidated
                    ? "• Validate your template"
                    : ""}
                </p>
              )}
            </div>

            {/* Info Card */}
            <div className="p-4 border border-border rounded-lg bg-muted/30">
              <h3 className="text-sm font-medium mb-2">After Publishing</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Your pattern will be accessible via API:
              </p>
              <code className="text-xs bg-muted p-2 rounded block break-all">
                POST /api/patterns/[id]/ingest
              </code>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
