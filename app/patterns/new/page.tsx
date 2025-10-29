"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  RefreshCw,
  ArrowLeft,
  Save,
  X
} from "lucide-react";
import { Navbar } from "@/ui/components/navbar";
import Link from "next/link";
import {
  PATTERN_LIMITS,
  findWhitespaceViolations,
  validateCsvFormat,
  validateMarkdownHeadings,
  validateXmlSyntax,
  validateYamlSyntax,
} from "@/schemas/pattern";

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
  parent_pattern_id?: string | null;
  csv_delimiter?: string | null;
  yaml_schema?: string | null;
  xml_schema?: string | null;
  csv_schema?: string | null;
  plain_text_schema?: string | null;
}

export default function NewPatternPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();

  // User plan limits
  const [userPlanLimit, setUserPlanLimit] = useState<number>(PATTERN_LIMITS.SCHEMA_MAX); // Default to hardcoded limit
  const [isLoadingPlanLimit, setIsLoadingPlanLimit] = useState(false);

  // Pattern selection
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
  const [parentPatternId, setParentPatternId] = useState<string | null>(null); // Track parent for draft versioning
  const [draftId, setDraftId] = useState<string | null>(null); // Track draft ID for deletion after publish
const [isDraftMode, setIsDraftMode] = useState(false); // Track if editing a draft
const [activePatterns, setActivePatterns] = useState<Pattern[]>([]);
const [isLoadingPatterns, setIsLoadingPatterns] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [format, setFormat] = useState<ManifestFormat>("json");
  const [csvDelimiter, setCsvDelimiter] = useState<"comma" | "semicolon">("comma");
  const [originalCsvDelimiter, setOriginalCsvDelimiter] = useState<"comma" | "semicolon">("comma");
  const [instructions, setInstructions] = useState("");
  const [originalInstructions, setOriginalInstructions] = useState("");
  const [initialInstructions, setInitialInstructions] = useState(""); // Preserve initial instructions for reset
  const [jsonSchema, setJsonSchema] = useState("");
  const [template, setTemplate] = useState("");
  const [originalTemplate, setOriginalTemplate] = useState(""); // Track original template for delta detection
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

  // Navigation confirmation dialog
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Flag to bypass beforeunload after successful publish
  const isNavigatingAway = useRef(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Helper: Check if user has meaningful content
  const hasUnsavedContent = (): boolean => {
    // Update Pattern mode: Only check if template changed (user generated at least once)
    if (selectedPatternId) {
      return template !== originalTemplate;
    }

    // New Pattern mode: Check if any field has content
    return !!(
      name.trim() ||
      instructions.trim() ||
      template.trim()
    );
  };

  // Auto-save draft on page close/navigation (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      // Don't show warning if navigating away after successful publish/save
      if (isNavigatingAway.current) {
        return;
      }

      // Only auto-save if there's meaningful content and not already saved
      const hasContent = name.trim() || instructions.trim() || template.trim();
      const isNotEmpty = hasContent && (name.trim() || instructions.trim().length >= 10);

      if (isNotEmpty && session?.access_token) {
        // Prevent default unload to show confirmation
        e.preventDefault();
        e.returnValue = '';

        // Auto-save draft in background
        const cleanTemplate = (text: string): string => {
          return text
            .replace(/```json\s*/g, '')
            .replace(/```yaml\s*/g, '')
            .replace(/```xml\s*/g, '')
            .replace(/```csv\s*/g, '')
            .replace(/```\s*/g, '')
            .trim();
        };

        const schemaData: Record<string, unknown> = {};
        if (template) {
          const cleaned = cleanTemplate(template);
          if (format === "json") {
            try { schemaData.json_schema = JSON.parse(cleaned); } catch { schemaData.json_schema = cleaned; }
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

        // CRITICAL: If updating a pattern, append " (Draft)" to name to avoid unique constraint
        const draftName = selectedPatternId
          ? `${name.trim()} (Draft)` // Update mode: add suffix to avoid conflict
          : name.trim() || `Auto-saved Draft ${new Date().toLocaleString()}`; // New mode: use as-is or default

        const draftPayload = {
          name: draftName,
          format,
          csv_delimiter: format === "csv" ? csvDelimiter : undefined,
          instructions: originalInstructions || instructions,
          ...schemaData,
          version: 0,
          is_active: false,
          parent_pattern_id: selectedPatternId || null, // Link to parent for versioning
        };

        // Send beacon to save draft (non-blocking)
        navigator.sendBeacon(
          "/api/patterns",
          new Blob([JSON.stringify(draftPayload)], { type: "application/json" })
        );
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [name, instructions, template, format, originalInstructions, session, csvDelimiter]);

  // Intercept browser back/forward button navigation
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (hasUnsavedContent()) {
        e.preventDefault();
        // Show confirmation dialog
        // Push current state back so we don't leave the page yet
        window.history.pushState(null, '', window.location.pathname);
        setPendingNavigation(document.referrer || "/patterns");
        setShowExitDialog(true);
      }
    };

    // Push initial state to enable popstate detection
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [name, instructions, template]);

  // Intercept all link clicks (including Navbar links)
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent) => {
      // Check if clicked element is a link or inside a link
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]') as HTMLAnchorElement | null;

      if (link && hasUnsavedContent()) {
        const href = link.getAttribute('href');

        // Only intercept internal links (not external or hash links)
        if (href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('mailto:')) {
          // Exclude the "Back to Patterns" button we already handle
          if (link.closest('button')) return;

          e.preventDefault();
          e.stopPropagation();
          setPendingNavigation(href);
          setShowExitDialog(true);
        }
      }
    };

    document.addEventListener('click', handleLinkClick, true);
    return () => document.removeEventListener('click', handleLinkClick, true);
  }, [name, instructions, template]);

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

  // Fetch user plan limit on mount
  useEffect(() => {
    if (!session?.access_token) {
      setUserPlanLimit(PATTERN_LIMITS.SCHEMA_MAX); // Default for non-authenticated users
      return;
    }

    const fetchUserPlanLimit = async () => {
      setIsLoadingPlanLimit(true);
      try {
        const response = await fetch("/api/user/usage", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const data = await response.json();
          const maxChars = parseInt(data.limits.maxTemplateCharacters.replace(/,/g, "")) || PATTERN_LIMITS.SCHEMA_MAX;
          setUserPlanLimit(maxChars);
        } else {
          setUserPlanLimit(PATTERN_LIMITS.SCHEMA_MAX); // Fallback on error
        }
      } catch (error) {
        console.error("Failed to fetch user plan limit:", error);
        setUserPlanLimit(PATTERN_LIMITS.SCHEMA_MAX); // Fallback on error
      } finally {
        setIsLoadingPlanLimit(false);
      }
    };

    fetchUserPlanLimit();
  }, [session]);

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
    const patternId = searchParams.get("pattern_id");

    console.log("[Pattern Studio] URL pattern_id:", patternId);
    console.log("[Pattern Studio] session:", !!session);

    // Load pattern data directly from URL parameter, no need to wait for activePatterns
    if (patternId && session?.access_token) {
      console.log("[Pattern Studio] Loading pattern for Create New Version...");

      // Fetch and load the pattern
      const loadPattern = async () => {
        try {
          const response = await fetch(`/api/patterns/${patternId}`, {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });

          if (!response.ok) {
            console.error("Failed to fetch pattern details");
            return;
          }

          const result = await response.json();
          const patternData = result.data;
          console.log("[Pattern Studio] Pattern loaded:", patternData.name, patternData.format);
          console.log("[Pattern Studio] CSV Delimiter from API:", patternData.csv_delimiter);
          console.log("[Pattern Studio] Full pattern data:", patternData);

          // CRITICAL: Check if this is a draft (version=0) or published pattern (version>=1)
          const isDraft = patternData.version === 0;
          const hasParent = patternData.parent_pattern_id;

          setIsDraftMode(isDraft); // Track draft mode for UI display
          setParentPatternId(hasParent || null); // Track parent for draft versioning

          // CRITICAL: For drafts with parent, show parent in dropdown (not draft itself)
          if (isDraft && hasParent) {
            // Draft from versioning: Fetch parent to get original instructions
            // This ensures UI looks identical to "Update Pattern" mode
            const parentResponse = await fetch(`/api/patterns/${hasParent}`, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });

            if (!parentResponse.ok) {
              console.error("Failed to fetch parent pattern");
              setError("Failed to load parent pattern details");
              return;
            }

            const parentResult = await parentResponse.json();
            const parentData = parentResult.data;

            // CRITICAL: Store draft ID and show parent in dropdown
            setDraftId(patternData.id); // Draft's real ID for deletion
            setSelectedPatternId(hasParent); // Show parent in dropdown
            setName(patternData.name);
            setFormat(patternData.format);

            // CRITICAL: Parse draft's instructions to extract follow-up
            // Draft instructions format: "original\n\nfollow-up"
            const draftInstructions = patternData.instructions;
            const parentInstructions = parentData.instructions;

            // Check if draft has follow-up by comparing with parent
            if (draftInstructions.startsWith(parentInstructions)) {
              // Extract follow-up (everything after "\n\n")
              const followUp = draftInstructions
                .substring(parentInstructions.length)
                .replace(/^\n\n/, ""); // Remove leading "\n\n"

              setOriginalInstructions(parentInstructions); // Parent's original (read-only)
              setInstructions(followUp); // Draft's follow-up (editable)
            } else {
              // Fallback: no clear follow-up, treat whole draft as new instructions
              setOriginalInstructions(parentInstructions);
              setInstructions(draftInstructions);
            }
            } else if (isDraft) {
            // Draft from scratch: No parent, show "Create New Pattern"
            setDraftId(patternData.id); // Store draft ID
            setSelectedPatternId(null);
            setName(patternData.name);
            setFormat(patternData.format);
            setInstructions(patternData.instructions);
            setOriginalInstructions("");

            // Set CSV delimiter for draft
            if (patternData.format === "csv") {
              const delimiterValue =
                (patternData.csv_delimiter as "comma" | "semicolon" | undefined) ?? "comma";
              console.log("[Pattern Studio] Setting draft CSV delimiter to:", delimiterValue);
              setCsvDelimiter(delimiterValue);
              setOriginalCsvDelimiter(delimiterValue);
            }
          } else {
            // Published pattern: Follow-up mode for versioning
            setDraftId(null); // Not a draft
            setSelectedPatternId(patternData.id);
            setName(patternData.name);
            setFormat(patternData.format);
            setOriginalInstructions(patternData.instructions); // Store original
            setInitialInstructions(patternData.instructions); // Preserve initial for reset
            setInstructions(""); // Empty for follow-up request

            // CRITICAL: Set CSV delimiter for published pattern
            if (patternData.format === "csv") {
              console.log("[Pattern Studio] Setting CSV delimiter for published pattern");
              console.log("[Pattern Studio] Raw csv_delimiter:", patternData.csv_delimiter);
              const delimiterValue =
                (patternData.csv_delimiter as "comma" | "semicolon" | undefined) ?? "comma";
              console.log("[Pattern Studio] Final delimiter value to set:", delimiterValue);
              setCsvDelimiter(delimiterValue);
              setOriginalCsvDelimiter(delimiterValue);
              console.log("[Pattern Studio] Delimiter state updated to:", delimiterValue);
            }
          }

          // Default delimiter for non-CSV formats
          if (patternData.format !== "csv") {
            setCsvDelimiter("comma");
            setOriginalCsvDelimiter("comma");
          }

          // Load the appropriate format-specific schema
          let templatePreview = "";

          switch (patternData.format) {
            case "json":
              if (patternData.json_schema) {
                templatePreview = JSON.stringify(patternData.json_schema, null, 2);
              }
              break;
            case "yaml":
              if (patternData.yaml_schema) {
                templatePreview = patternData.yaml_schema;
              } else if (patternData.json_schema) {
                templatePreview = jsonToYaml(patternData.json_schema);
              }
              break;
            case "xml":
              if (patternData.xml_schema) {
                templatePreview = patternData.xml_schema;
              } else if (patternData.json_schema) {
                templatePreview = jsonToXml(patternData.json_schema);
              }
              break;
            case "csv":
              if (patternData.csv_schema) {
                templatePreview = patternData.csv_schema;
              } else if (patternData.json_schema) {
                templatePreview = jsonToCsv(patternData.json_schema);
              }
              break;
            case "text":
              if (patternData.plain_text_schema) {
                templatePreview = patternData.plain_text_schema;
              } else if (patternData.json_schema) {
                templatePreview = jsonToText(patternData.json_schema);
              }
              break;
          }

          // For versioning, JSON Schema field should be empty (user can optionally provide their own)
          setJsonSchema("");
          setTemplate(templatePreview);
          setOriginalTemplate(templatePreview); // Save original for delta detection
          setIsTemplateEditable(false);

          setNameAvailable(true);
          setIsValidated(true);
          setValidationErrors([]);
        } catch (err) {
          console.error("Failed to load pattern from URL:", err);
          setError("Failed to load pattern details");
        }
      };

      loadPattern();
    }
  }, [session, searchParams]); // Removed activePatterns dependency - load directly from URL

  // NOTE: Draft loading removed - now handled via URL parameter (?pattern_id=...)

  // Track previous format to detect actual format changes (not template changes)
  const prevFormatRef = useRef<ManifestFormat>(format);

  // Reset form when format changes in "Create New Pattern" mode
  useEffect(() => {
    if (selectedPatternId) return; // Do not reset when editing existing pattern

    // Check if format actually changed (not just template or other deps)
    const formatChanged = prevFormatRef.current !== format;

    // Update ref to current format
    prevFormatRef.current = format;

    // Only proceed if format actually changed
    if (!formatChanged) return;

    // Only reset everything if a template has been generated
    // If no template yet, keep name and instructions (user might just be exploring formats)
    const hasGeneratedTemplate = template.length > 0 || originalTemplate.length > 0;

    if (hasGeneratedTemplate) {
      // Template exists - changing format requires full reset
      setName("");
      setInstructions("");
      setOriginalInstructions("");
      setInitialInstructions(""); // Clear initial instructions too
      setNameAvailable(null);
    }

    // Always reset template-related fields when format changes
    setTemplate("");
    setOriginalTemplate("");
    setJsonSchema("");
    setIsValidated(false);
    setValidationErrors([]);
    setIsTemplateEditable(false);
    setError("");
    setSuccess("");
    setMarkdownError("");

    // CRITICAL: Only reset CSV delimiter when creating NEW pattern AND format changes to CSV
    // Do NOT reset when loading existing pattern (selectedPatternId check above handles that)
    // Do NOT reset if delimiter was already set (e.g., from draft loading)
    if (format === "csv" && csvDelimiter === "comma" && originalCsvDelimiter === "comma") {
      // Delimiter is still at default - this is a NEW csv pattern creation
      // No need to explicitly set since already at "comma"
    } else if (format !== "csv") {
      // For other formats, reset delimiter baseline to avoid stale comparisons
      // Only if not already at baseline
      if (originalCsvDelimiter !== "comma") {
        setOriginalCsvDelimiter("comma");
      }
      if (csvDelimiter !== "comma") {
        setCsvDelimiter("comma");
      }
    }
  }, [format, selectedPatternId, template, originalTemplate, csvDelimiter, originalCsvDelimiter]);

  useEffect(() => {
    if (format !== "csv") {
      return;
    }

    setTemplate((currentTemplate) => {
      if (!currentTemplate || currentTemplate.trim().length === 0) {
        return currentTemplate;
      }

      const updatedTemplate = applyDelimiterToCsvTemplate(currentTemplate, csvDelimiter);
      if (updatedTemplate === currentTemplate) {
        return currentTemplate;
      }

      setIsTemplateEditable(false);
      setIsValidated(true);
      setValidationErrors([]);
      return updatedTemplate;
    });
  }, [csvDelimiter, format]);

  // Handle pattern selection
  const handlePatternSelect = async (patternId: string) => {
    if (patternId === "new") {
      // Reset form for new pattern
      setSelectedPatternId(null);
      setParentPatternId(null);
      setDraftId(null); // Reset draft ID
      setIsDraftMode(false); // Not in draft mode
      setName("");
      setFormat("json");
      setCsvDelimiter("comma");
      setOriginalCsvDelimiter("comma");
      setInstructions("");
      setOriginalInstructions("");
      setInitialInstructions(""); // Clear initial instructions too
      setJsonSchema("");
      setTemplate("");
      setOriginalTemplate(""); // Clear original template
      setNameAvailable(null);
      setIsValidated(false);
      setValidationErrors([]);
      return;
    }

    const pattern = activePatterns.find(p => p.id === patternId);
    if (!pattern || !session?.access_token) return;

    // Fetch the latest version of the pattern from the backend
    try {
      const response = await fetch(`/api/patterns/${patternId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch pattern details");
        return;
      }

      const result = await response.json();
      const patternData = result.data;

      // Fill form with pattern data (follow-up mode for instructions)
      setSelectedPatternId(patternData.id);
      setParentPatternId(null); // Published pattern has no parent
      setDraftId(null); // Not a draft
      setIsDraftMode(false); // Not a draft (published pattern with version >= 1)
      setName(patternData.name);
      setFormat(patternData.format);
      setOriginalInstructions(patternData.instructions); // Store original
      setInitialInstructions(patternData.instructions); // Preserve initial for reset
      setInstructions(""); // Empty for follow-up request

      if (patternData.format === "csv") {
        const delimiterValue =
          (patternData.csv_delimiter as "comma" | "semicolon" | undefined) ?? "comma";
        setCsvDelimiter(delimiterValue);
        setOriginalCsvDelimiter(delimiterValue);
      } else {
        setCsvDelimiter("comma");
        setOriginalCsvDelimiter("comma");
      }

      // Load the appropriate format-specific schema
      let templatePreview = "";

      switch (patternData.format) {
        case "json":
          if (patternData.json_schema) {
            templatePreview = JSON.stringify(patternData.json_schema, null, 2);
          }
          break;
        case "yaml":
          if (patternData.yaml_schema) {
            templatePreview = patternData.yaml_schema;
          } else if (patternData.json_schema) {
            templatePreview = jsonToYaml(patternData.json_schema);
          }
          break;
        case "xml":
          if (patternData.xml_schema) {
            templatePreview = patternData.xml_schema;
          } else if (patternData.json_schema) {
            templatePreview = jsonToXml(patternData.json_schema);
          }
          break;
        case "csv":
          if (patternData.csv_schema) {
            templatePreview = patternData.csv_schema;
          } else if (patternData.json_schema) {
            templatePreview = jsonToCsv(patternData.json_schema);
          }
          break;
        case "text":
          if (patternData.plain_text_schema) {
            templatePreview = patternData.plain_text_schema;
          } else if (patternData.json_schema) {
            templatePreview = jsonToText(patternData.json_schema);
          }
          break;
      }

      // For versioning, JSON Schema field should be empty (user can optionally provide their own)
      setJsonSchema("");
      setTemplate(templatePreview);
      setOriginalTemplate(templatePreview); // Save original for delta detection
      setIsTemplateEditable(false); // Don't mark as editable initially - only when user clicks "Edit Template"

      setNameAvailable(true); // Pattern name is already valid (skip validation)
      setIsValidated(true); // Published template is already valid
      setValidationErrors([]);
    } catch (err) {
      console.error("Failed to load pattern for versioning:", err);
      setError("Failed to load pattern details");
    }
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
  const hasTemplateChange = template !== originalTemplate;
  const hasInstructionChange = instructions.trim().length > 0;
  const hasCsvDelimiterChange = format === "csv" && csvDelimiter !== originalCsvDelimiter;
  const hasChanges = selectedPatternId ? (hasTemplateChange || hasInstructionChange || hasCsvDelimiterChange) : true;

  // Check if publish is enabled
  const canPublish =
    session &&
    name.trim() &&
    nameAvailable !== false &&
    template &&
    template.length <= userPlanLimit && // Check template doesn't exceed plan limit
    (!isTemplateEditable || isValidated) &&
    hasChanges &&
    (
      format === "csv" || // allow delimiter-only changes
      originalInstructions ||
      instructions.trim().length >= 30
    );

  // Post-process CSV template to remove opposite delimiter from cell values
  const postProcessCsvTemplate = (csv: string, delimiter: "comma" | "semicolon"): string => {
    const delimChar = delimiter === "semicolon" ? ";" : ",";
    const removeChar = delimiter === "semicolon" ? "," : ";";
    
    const lines = csv.split('\n');
    if (lines.length < 2) return csv;
    
    return lines.map((line, idx) => {
      // Skip empty lines
      if (!line.trim()) return line;
      
      const cells = line.split(delimChar);
      
      return cells.map((cell) => {
        const trimmed = cell.trim();
        
        // Skip headers (first row) - keep them as is
        if (idx === 0) return trimmed;
        
        // Check if numeric: contains only digits, dots, commas/semicolons as thousands separator, spaces
        const isNumeric = /^[\d,;.\s]+$/.test(trimmed);
        
        // Remove opposite delimiter from non-numeric cells
        if (!isNumeric && trimmed.includes(removeChar)) {
          // Replace with space to maintain readability
          return trimmed.replace(new RegExp(removeChar.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ');
        }
        
        return trimmed;
      }).join(delimChar);
    }).join('\n');
  };

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
            csvDelimiter: format === "csv" ? csvDelimiter : undefined,
            jsonSchema: jsonSchema ? JSON.parse(jsonSchema) : undefined,
          }
        : {
            // Initial request
            name: name || undefined,
            instructions,
            format,
            csvDelimiter: format === "csv" ? csvDelimiter : undefined,
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
      let cleanedTemplate = data.template
        .replace(/```json\s*/g, '')
        .replace(/```yaml\s*/g, '')
        .replace(/```xml\s*/g, '')
        .replace(/```csv\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      // For CSV format, replace spaces in headers with underscores and post-process cell values
      if (format === "csv") {
        const lines = cleanedTemplate.split('\n');
        if (lines.length > 0) {
          // Get the delimiter character
          const delimChar = getDelimiterChar(csvDelimiter);

          // Process the header line (first non-empty line)
          const headerIndex = lines.findIndex((line: string) => line.trim().length > 0);
          if (headerIndex !== -1) {
            const headerLine = lines[headerIndex];

            // Split by delimiter, replace spaces in each field, rejoin
            const headers = headerLine.split(delimChar).map((field: string) => {
              // Replace spaces with underscores in field names
              return field.trim().replace(/\s+/g, '_');
            });

            lines[headerIndex] = headers.join(delimChar);
            cleanedTemplate = lines.join('\n');

            console.log('[Pattern Studio] Auto-sanitized CSV headers, replaced spaces with underscores');
          }
        }

        // Post-process CSV to remove opposite delimiter from cell values
        cleanedTemplate = postProcessCsvTemplate(cleanedTemplate, csvDelimiter);
        console.log('[Pattern Studio] Post-processed CSV cell values to remove opposite delimiter');
      }

      setTemplate(cleanedTemplate);
      setIsTemplateEditable(false);
      setIsValidated(false);
      setValidationErrors([]);

      // İlk generate ise: originalInstructions'a kaydet ve instructions'ı temizle
      if (!isFollowUp) {
        setOriginalInstructions(instructions);
        setInstructions("");
      } else {
        // Follow-up ise: originalInstructions'a follow-up'ı ekle ve instructions'ı temizle
        setOriginalInstructions(originalInstructions + ", " + instructions);
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
        setOriginalInstructions(initialInstructions); // Restore initial instructions, removing any appended follow-ups

        // Restore published template - check format-specific schema fields first
        let templatePreview = "";

        switch (pattern.format) {
          case "json":
            if (pattern.json_schema) {
              templatePreview = JSON.stringify(pattern.json_schema, null, 2);
            }
            break;
          case "yaml":
            if (pattern.yaml_schema) {
              templatePreview = pattern.yaml_schema;
            } else if (pattern.json_schema) {
              templatePreview = jsonToYaml(pattern.json_schema);
            }
            break;
          case "xml":
            if (pattern.xml_schema) {
              templatePreview = pattern.xml_schema;
            } else if (pattern.json_schema) {
              templatePreview = jsonToXml(pattern.json_schema);
            }
            break;
          case "csv":
            if (pattern.csv_schema) {
              templatePreview = pattern.csv_schema;
            } else if (pattern.json_schema) {
              templatePreview = jsonToCsv(pattern.json_schema);
            }
            break;
          case "text":
            if (pattern.plain_text_schema) {
              templatePreview = pattern.plain_text_schema;
            } else if (pattern.json_schema) {
              templatePreview = jsonToText(pattern.json_schema);
            }
            break;
        }

        setTemplate(templatePreview);
        setOriginalTemplate(templatePreview); // Reset to published template
        setIsTemplateEditable(false); // Lock template to published version
        setIsValidated(false);
        setValidationErrors([]);
        setError("");
        setSuccess("");

        if (pattern.format === "csv") {
          const delimiterValue =
            (pattern.csv_delimiter as "comma" | "semicolon" | undefined) ?? "comma";
          setOriginalCsvDelimiter(delimiterValue);
          setCsvDelimiter(delimiterValue);
        } else {
          setOriginalCsvDelimiter("comma");
          setCsvDelimiter("comma");
        }
      }
    } else {
      // New pattern mode: Clear everything
      setName("");
      setInstructions("");
      setOriginalInstructions("");
      setInitialInstructions(""); // Clear initial instructions too
      setTemplate("");
      setOriginalTemplate(""); // Clear original template
      setIsTemplateEditable(false);
      setIsValidated(false);
      setValidationErrors([]);
      setError("");
      setSuccess("");
      setOriginalCsvDelimiter("comma");
      setCsvDelimiter("comma");
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
        const parsed = JSON.parse(template);
        const violations = findWhitespaceViolations(parsed);
        if (violations.length > 0) {
          throw new Error(violations[0]);
        }
      } else if (format === "yaml") {
        if (!template.trim()) {
          throw new Error("YAML content is empty");
        }
        const result = validateYamlSyntax(template);
        if (!result.valid) {
          throw new Error(result.error || "Invalid YAML");
        }
      } else if (format === "xml") {
        if (!template.trim()) {
          throw new Error("XML content is empty");
        }
        const result = validateXmlSyntax(template);
        if (!result.valid) {
          throw new Error(result.error || "Invalid XML");
        }
      } else if (format === "csv") {
        // CSV validation
        if (!template.trim()) {
          throw new Error("CSV content is empty");
        }
        const formatResult = validateCsvFormat(template);
        if (!formatResult.valid) {
          throw new Error(formatResult.error || "Invalid CSV format");
        }

        const delimiter = csvDelimiter === "semicolon" ? ";" : ",";
        const lines = template.trim().split("\n");

        if (lines.length < 2) {
          throw new Error("CSV must have at least a header row and one data row");
        }

        // Validate header row exists
        const firstLine = lines[0];
        if (!firstLine) {
          throw new Error("CSV header row is missing");
        }
        
        const headerColumns = firstLine.split(delimiter).length;
        if (headerColumns === 0) {
          throw new Error("CSV header row is empty");
        }

        // Validate all rows have same number of columns by counting delimiters
        // Use smart counting that respects quoted cells
        const countDelimiters = (line: string, delim: string): number => {
          let count = 0;
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') inQuotes = !inQuotes;
            if (!inQuotes && line[i] === delim) count++;
          }
          return count;
        };

        const headerLine = lines[0];
        if (!headerLine) {
          throw new Error("CSV header row is missing");
        }
        const headerDelimiterCount = countDelimiters(headerLine, delimiter);
        
        for (let i = 1; i < lines.length; i++) {
          const currentLine = lines[i];
          if (!currentLine) continue; // Skip empty lines
          
          const lineDelimiterCount = countDelimiters(currentLine, delimiter);
          if (lineDelimiterCount !== headerDelimiterCount) {
            throw new Error(
              `CSV row ${i + 1} has ${lineDelimiterCount} delimiters, expected ${headerDelimiterCount} (same as header row)`
            );
          }
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
      const lineMatch = errorMessage.match(/line (\d+)/i) || errorMessage.match(/position (\d+)/i) || errorMessage.match(/row (\d+)/i);
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

      // Auto-detect CSV delimiter from template for CSV format
      let detectedDelimiter = csvDelimiter;
      if (format === "csv" && template) {
        const cleaned = cleanTemplate(template);
        const firstLine = cleaned.split('\n')[0] || '';
        const detected = detectCsvDelimiterChar(firstLine);

        console.log('[Pattern Studio] CSV Delimiter Detection:');
        console.log('  - Current UI selection:', csvDelimiter);
        console.log('  - First line of CSV:', firstLine);
        console.log('  - Detected delimiter char:', detected);

        if (detected === ';') {
          detectedDelimiter = 'semicolon' as const;
          console.log('[Pattern Studio] ✅ Auto-detected SEMICOLON delimiter from CSV template');
        } else if (detected === ',') {
          detectedDelimiter = 'comma' as const;
          console.log('[Pattern Studio] ✅ Auto-detected COMMA delimiter from CSV template');
        } else {
          console.log('[Pattern Studio] ⚠️ Could not detect delimiter, using UI selection:', csvDelimiter);
        }
      }

      // CRITICAL: Check if publishing a draft with a parent pattern
      if (parentPatternId) {
        // Publishing a draft → Update PARENT pattern (not the draft itself)
        // Strip "(Draft)" suffix to use parent's original name
        const parentName = name.replace(/\s*\(Draft\)\s*$/i, "").trim();

        const updatePayload = {
          format,
          csv_delimiter: detectedDelimiter,
          instructions: originalInstructions + (instructions ? `\n\n${instructions}` : ""), // Append follow-up
          ...schemaData, // Spread format-specific schema
          publish_new_version: true, // Increment version on parent
        };

        console.log("Publishing draft to parent pattern:", parentPatternId);
        console.log("Update payload:", JSON.stringify(updatePayload, null, 2));

        const response = await fetch(`/api/patterns/${parentPatternId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(updatePayload),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Failed to update parent pattern:", errorData);
          throw new Error(errorData.error?.message || errorData.message || "Failed to publish draft to parent pattern");
        }

        // Successfully published draft to parent - now delete the draft pattern
        // CRITICAL: Use draftId (not selectedPatternId which points to parent)
        if (draftId) {
          try {
            await fetch(`/api/patterns/${draftId}`, {
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${session.access_token}`,
              },
            });
            console.log("Draft pattern deleted after successful publish");
          } catch (deleteErr) {
            console.warn("Failed to delete draft pattern after publish:", deleteErr);
            // Continue anyway - parent was updated successfully
          }
        }

        setSuccess(`Draft published to "${parentName}"! New version created.`);
      } else if (selectedPatternId) {
        // Update existing pattern (increment version) - normal versioning workflow
        const updatePayload = {
          format,
          csv_delimiter: detectedDelimiter,
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
          csv_delimiter: detectedDelimiter,
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

        console.log("=== PATTERN STUDIO CREATE PAYLOAD ===");
        console.log("Format:", format);
        console.log("CSV Schema:", newPatternSchema.csv_schema ? String(newPatternSchema.csv_schema).substring(0, 300) : "NULL");
        console.log("Full Payload:", JSON.stringify(newPatternSchema, null, 2));
        console.log("=====================================");

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

        // Successfully created new pattern - if this was from a draft, delete the draft
        // CRITICAL: Delete draft only if it was a draft from scratch (no parent)
        if (isDraftMode && draftId && !parentPatternId) {
          try {
            await fetch(`/api/patterns/${draftId}`, {
              method: "DELETE",
              headers: {
                "Authorization": `Bearer ${session.access_token}`,
              },
            });
            console.log("Draft pattern deleted after successful publish (scratch draft)");
          } catch (deleteErr) {
            console.warn("Failed to delete scratch draft after publish:", deleteErr);
            // Continue anyway - new pattern was created successfully
          }
        }

        setSuccess(`Pattern "${name}" published successfully!`);
      }

      // Set flag to bypass beforeunload warning
      isNavigatingAway.current = true;

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
      // Clean markdown code blocks from template
      const cleanTemplate = (text: string): string => {
        return text
          .replace(/```json\s*/g, '')
          .replace(/```yaml\s*/g, '')
          .replace(/```xml\s*/g, '')
          .replace(/```csv\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
      };

      // Prepare schema based on format
      const schemaData: Record<string, unknown> = {};

      if (template) {
        const cleaned = cleanTemplate(template);

        if (format === "json") {
          try {
            schemaData.json_schema = JSON.parse(cleaned);
          } catch {
            // If parse fails, save as string
            schemaData.json_schema = cleaned;
          }
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

      // Draft payload: version = 0, is_active = false
      // CRITICAL: If updating a pattern, append " (Draft)" to name to avoid unique constraint
      const draftName = selectedPatternId
        ? `${name.trim()} (Draft)` // Update mode: add suffix to avoid conflict
        : name.trim() || "Untitled Draft"; // New mode: use as-is or default

      const draftPayload = {
        name: draftName,
        format,
        csv_delimiter: format === "csv" ? csvDelimiter : undefined,
        instructions: originalInstructions || instructions,
        ...schemaData,
        version: 0, // CRITICAL: Drafts have version 0
        is_active: false, // CRITICAL: Drafts are inactive
        parent_pattern_id: selectedPatternId || null, // CRITICAL: Link to parent pattern for versioning
      };

      const response = await fetch("/api/patterns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(draftPayload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to save draft");
      }

      const result = await response.json();
      setSuccess(`Draft "${draftName}" saved successfully!`);

      // Set flag to bypass beforeunload warning
      isNavigatingAway.current = true;

      // Redirect to patterns page after 1.5s
      setTimeout(() => {
        router.push("/patterns");
      }, 1500);
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

  const getDelimiterChar = (delimiter: "comma" | "semicolon"): string =>
    delimiter === "semicolon" ? ";" : ",";

  const convertCsvLineDelimiter = (line: string, from: string, to: string): string => {
    if (from === to) return line;
    let result = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        const nextChar = line[i + 1];
        if (inQuotes && nextChar === '"') {
          // Escaped quote inside quoted value
          result += char;
          i += 1;
          result += line[i];
          continue;
        }
        inQuotes = !inQuotes;
        result += char;
        continue;
      }

      if (char === from && !inQuotes) {
        result += to;
      } else {
        result += char;
      }
    }

    return result;
  };

  const detectCsvDelimiterChar = (line: string): "," | ";" | null => {
    const countOccurrences = (target: string): number => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          const nextChar = line[i + 1];
          if (inQuotes && nextChar === '"') {
            i += 1;
            continue;
          }
          inQuotes = !inQuotes;
          continue;
        }
        if (char === target && !inQuotes) {
          count += 1;
        }
      }
      return count;
    };

    const commaCount = countOccurrences(",");
    const semicolonCount = countOccurrences(";");

    if (commaCount === 0 && semicolonCount === 0) return null;
    if (commaCount === semicolonCount) return null;
    return commaCount > semicolonCount ? "," : ";";
  };

  const applyDelimiterToCsvTemplate = (
    csvText: string,
    delimiter: "comma" | "semicolon"
  ): string => {
    const targetChar = getDelimiterChar(delimiter);
    const lines = csvText.split("\n");
    if (lines.length === 0) return csvText;

    const firstDataLine = lines.find((line) => line.trim().length > 0) ?? "";
    const detectedDelimiter = detectCsvDelimiterChar(firstDataLine);
    if (!detectedDelimiter) {
      // No clear delimiter detected; assume template already uses target
      return csvText;
    }

    if (detectedDelimiter === targetChar) {
      return csvText;
    }

    const convertedLines = lines.map((line) =>
      convertCsvLineDelimiter(line, detectedDelimiter, targetChar)
    );
    return convertedLines.join("\n");
  };

  const jsonToCsv = (obj: Record<string, unknown>): string => {
    const delimiterChar = getDelimiterChar(csvDelimiter);
    const keys = Object.keys(obj);
    const values = Object.values(obj).map((v) => JSON.stringify(v));
    return `${keys.join(delimiterChar)}\n${values.join(delimiterChar)}`;
  };

  const jsonToText = (obj: Record<string, unknown>): string => {
    const lines: string[] = ['# Overview'];

    const formatValue = (value: unknown): string => {
      if (value === null || value === undefined) return 'Not provided';
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value, null, 2);
        } catch (error) {
          return String(value);
        }
      }
      return String(value);
    };

    Object.entries(obj).forEach(([key, value]) => {
      lines.push(`## ${key}`);
      lines.push(formatValue(value));
      lines.push('');
    });

    return lines.join('\n').trim();
  };

  const getFormatPlaceholder = (): string => {
    const delimiter = csvDelimiter === "semicolon" ? ";" : ",";
    switch (format) {
      case "json":
        return '{\n  "key": "value"\n}';
      case "yaml":
        return 'key: value\nlist:\n  - item1\n  - item2';
      case "xml":
        return '<root>\n  <item>value</item>\n</root>';
      case "csv":
        return `header1${delimiter}header2${delimiter}header3\nvalue1${delimiter}value2${delimiter}value3`;
      case "text":
        return '# Overview\nA short summary of the image context.\n\n## Key Details\n- Detail 1\n- Detail 2\n\n## Observations\nAdd any observations here.';
      default:
        return "";
    }
  };

  // Navigation handlers with confirmation
  const handleSaveAndExit = async () => {
    if (!session?.access_token || !pendingNavigation) return;

    setIsSavingDraft(true);
    try {
      const cleanTemplate = (text: string): string => {
        return text
          .replace(/```json\s*/g, '')
          .replace(/```yaml\s*/g, '')
          .replace(/```xml\s*/g, '')
          .replace(/```csv\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();
      };

      const schemaData: Record<string, unknown> = {};
      if (template) {
        const cleaned = cleanTemplate(template);
        if (format === "json") {
          try { schemaData.json_schema = JSON.parse(cleaned); } catch { schemaData.json_schema = cleaned; }
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

      // CRITICAL: If updating a pattern, append " (Draft)" to name to avoid unique constraint
      const draftName = selectedPatternId
        ? `${name.trim()} (Draft)` // Update mode: add suffix to avoid conflict
        : name.trim() || "Untitled Draft"; // New mode: use as-is or default

      const draftPayload = {
        name: draftName,
        format,
        csv_delimiter: format === "csv" ? csvDelimiter : undefined,
        instructions: originalInstructions || instructions,
        ...schemaData,
        version: 0,
        is_active: false,
        parent_pattern_id: selectedPatternId || null, // Link to parent for versioning
      };

      const response = await fetch("/api/patterns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(draftPayload),
      });

      if (response.ok) {
        // Navigate after successful save
        router.push(pendingNavigation);
      } else {
        throw new Error("Failed to save draft");
      }
    } catch (err) {
      console.error("Save and exit error:", err);
      setError(err instanceof Error ? err.message : "Failed to save draft");
      setShowExitDialog(false);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleDiscardAndExit = () => {
    if (pendingNavigation) {
      router.push(pendingNavigation);
    }
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Pattern Studio</h1>
              <p className="text-muted-foreground mt-2">
                Create a new pattern to analyze images with AI
              </p>
            </div>
            <button
              onClick={() => {
                if (hasUnsavedContent()) {
                  setPendingNavigation("/patterns");
                  setShowExitDialog(true);
                } else {
                  router.push("/patterns");
                }
              }}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg hover:bg-accent transition text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Patterns
            </button>
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
                {isDraftMode ? (
                  <>
                    <Edit3 className="w-4 h-4" />
                    Editing Draft
                  </>
                ) : selectedPatternId ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Update Pattern
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    Create New Pattern
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

            {/* CSV Delimiter Selection */}
            {format === "csv" && (
              <div key={`delimiter-${csvDelimiter}`}>
                <label className="block text-sm font-medium mb-2">
                  CSV Delimiter
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border border-border rounded-lg hover:bg-accent transition">
                    <input
                      type="radio"
                      name="delimiter"
                      value="comma"
                      checked={csvDelimiter === "comma"}
                      onChange={() => setCsvDelimiter("comma")}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Comma (,)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border border-border rounded-lg hover:bg-accent transition">
                    <input
                      type="radio"
                      name="delimiter"
                      value="semicolon"
                      checked={csvDelimiter === "semicolon"}
                      onChange={() => setCsvDelimiter("semicolon")}
                      className="cursor-pointer"
                    />
                    <span className="text-sm">Semicolon (;)</span>
                  </label>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {csvDelimiter === "comma"
                    ? "Standard format for international use"
                    : "European format where comma is used as decimal separator"}
                </p>
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
                <div className="flex items-center gap-2">
                  <span>{format.toUpperCase()} Schema (Optional)</span>
                  <div className="group relative inline-block">
                    <div className="w-4 h-4 rounded-full border border-muted-foreground/30 flex items-center justify-center cursor-help text-[10px] text-muted-foreground">
                      !
                    </div>
                    <div className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-80 p-3 bg-popover border border-border rounded-lg shadow-lg text-xs text-popover-foreground z-50">
                      <p className="font-semibold mb-1.5">Hybrid Approach - Send Either:</p>
                      <ul className="space-y-1.5 mb-2">
                        <li className="flex gap-1.5">
                          <span className="text-green-500 shrink-0">✓</span>
                          <span><strong>Example Data:</strong> {`{ "name": "John", "age": 25 }`}</span>
                        </li>
                        <li className="flex gap-1.5">
                          <span className="text-green-500 shrink-0">✓</span>
                          <span><strong>Schema Format:</strong> {`{ "type": "object", "properties": {...} }`}</span>
                        </li>
                      </ul>
                      <p className="text-muted-foreground">
                        <strong>Note:</strong> Schema format allows advanced constraints (enums, patterns, min/max) and explicit type control. Example format is easier and provides semantic context for the AI, but is limited to basic type inference.
                      </p>
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-border"></div>
                    </div>
                  </div>
                </div>
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
                  format === "csv" ? `header1${csvDelimiter === "semicolon" ? ";" : ","}header2${csvDelimiter === "semicolon" ? ";" : ","}header3\nvalue1${csvDelimiter === "semicolon" ? ";" : ","}value2${csvDelimiter === "semicolon" ? ";" : ","}value3` :
                  format === "text" ? '# Main Heading\n[Placeholder]\n\n## Sub Heading\n[Placeholder]' :
                  '{"type": "object", "properties": {...}}'
                }
                rows={8}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background resize-none font-mono text-sm ${
                  jsonSchema.length > userPlanLimit
                    ? "border-destructive"
                    : "border-border"
                }`}
              />
              <div className="flex items-center justify-end mt-1">
                <span className={`text-xs ${
                  jsonSchema.length > userPlanLimit
                    ? "text-destructive font-medium"
                    : jsonSchema.length > userPlanLimit * 0.9
                    ? "text-yellow-600 dark:text-yellow-400"
                    : "text-muted-foreground"
                }`}>
                  {jsonSchema.length} / {userPlanLimit.toLocaleString()} characters
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
                      template.length > userPlanLimit
                        ? "text-destructive font-medium"
                        : template.length > userPlanLimit * 0.9
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-muted-foreground"
                    }`}>
                      {template.length} / {userPlanLimit.toLocaleString()} characters
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
                    : template.length > userPlanLimit
                    ? `• Template exceeds plan limit (${template.length.toLocaleString()} / ${userPlanLimit.toLocaleString()} chars)`
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

      {/* Exit Confirmation Dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-xl max-w-md w-full p-6 space-y-6 relative">
            {/* Close button (X) */}
            <button
              onClick={() => {
                setShowExitDialog(false);
                setPendingNavigation(null);
              }}
              disabled={isSavingDraft}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <div className="p-2 rounded-full bg-yellow-500/10">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-2">Unsaved Changes</h3>
                <p className="text-sm text-muted-foreground">
                  You have unsaved work. Would you like to save it as a draft before leaving?
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveAndExit}
                disabled={isSavingDraft}
                className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingDraft ? "Saving..." : "Save as Draft & Exit"}</span>
              </button>

              <button
                onClick={handleDiscardAndExit}
                disabled={isSavingDraft}
                className="flex items-center justify-center gap-1.5 flex-1 px-3 py-2.5 border border-destructive text-destructive rounded-lg hover:bg-destructive/10 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Discard & Exit</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
