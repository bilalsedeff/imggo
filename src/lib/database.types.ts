export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          environment: string
          expires_at: string | null
          id: string
          ip_whitelist: string[] | null
          key_hash: string
          key_prefix: string
          last_request_reset_at: string | null
          last_used_at: string | null
          last_used_ip: string | null
          name: string
          request_count: number | null
          revoked_at: string | null
          revoked_reason: string | null
          scopes: string[]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          ip_whitelist?: string[] | null
          key_hash: string
          key_prefix: string
          last_request_reset_at?: string | null
          last_used_at?: string | null
          last_used_ip?: string | null
          name: string
          request_count?: number | null
          revoked_at?: string | null
          revoked_reason?: string | null
          scopes?: string[]
          user_id: string
        }
        Update: {
          created_at?: string | null
          environment?: string
          expires_at?: string | null
          id?: string
          ip_whitelist?: string[] | null
          key_hash?: string
          key_prefix?: string
          last_request_reset_at?: string | null
          last_used_at?: string | null
          last_used_ip?: string | null
          name?: string
          request_count?: number | null
          revoked_at?: string | null
          revoked_reason?: string | null
          scopes?: string[]
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          extras: Json | null
          id: string
          idempotency_key: string | null
          image_url: string
          latency_ms: number | null
          manifest: Json | null
          pattern_id: string
          requested_by: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          extras?: Json | null
          id?: string
          idempotency_key?: string | null
          image_url: string
          latency_ms?: number | null
          manifest?: Json | null
          pattern_id: string
          requested_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          extras?: Json | null
          id?: string
          idempotency_key?: string | null
          image_url?: string
          latency_ms?: number | null
          manifest?: Json | null
          pattern_id?: string
          requested_by?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_versions: {
        Row: {
          created_at: string
          csv_delimiter: string | null
          csv_schema: string | null
          format: Database["public"]["Enums"]["manifest_format"] | null
          id: string
          instructions: string
          json_schema: Json | null
          pattern_id: string
          plain_text_schema: string | null
          version: number
          xml_schema: string | null
          yaml_schema: string | null
        }
        Insert: {
          created_at?: string
          csv_delimiter?: string | null
          csv_schema?: string | null
          format?: Database["public"]["Enums"]["manifest_format"] | null
          id?: string
          instructions: string
          json_schema?: Json | null
          pattern_id: string
          plain_text_schema?: string | null
          version: number
          xml_schema?: string | null
          yaml_schema?: string | null
        }
        Update: {
          created_at?: string
          csv_delimiter?: string | null
          csv_schema?: string | null
          format?: Database["public"]["Enums"]["manifest_format"] | null
          id?: string
          instructions?: string
          json_schema?: Json | null
          pattern_id?: string
          plain_text_schema?: string | null
          version?: number
          xml_schema?: string | null
          yaml_schema?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pattern_versions_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
        ]
      }
      patterns: {
        Row: {
          created_at: string
          csv_delimiter: string | null
          csv_schema: string | null
          format: Database["public"]["Enums"]["manifest_format"]
          id: string
          instructions: string
          is_active: boolean
          json_schema: Json | null
          model_profile: string
          name: string
          parent_pattern_id: string | null
          plain_text_schema: string | null
          updated_at: string
          user_id: string
          version: number
          xml_schema: string | null
          yaml_schema: string | null
        }
        Insert: {
          created_at?: string
          csv_delimiter?: string | null
          csv_schema?: string | null
          format?: Database["public"]["Enums"]["manifest_format"]
          id?: string
          instructions: string
          is_active?: boolean
          json_schema?: Json | null
          model_profile?: string
          name: string
          parent_pattern_id?: string | null
          plain_text_schema?: string | null
          updated_at?: string
          user_id: string
          version?: number
          xml_schema?: string | null
          yaml_schema?: string | null
        }
        Update: {
          created_at?: string
          csv_delimiter?: string | null
          csv_schema?: string | null
          format?: Database["public"]["Enums"]["manifest_format"]
          id?: string
          instructions?: string
          is_active?: boolean
          json_schema?: Json | null
          model_profile?: string
          name?: string
          parent_pattern_id?: string | null
          plain_text_schema?: string | null
          updated_at?: string
          user_id?: string
          version?: number
          xml_schema?: string | null
          yaml_schema?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patterns_parent_pattern_id_fkey"
            columns: ["parent_pattern_id"]
            isOneToOne: false
            referencedRelation: "patterns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patterns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          last_refill_at: string
          tokens: number
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          last_refill_at?: string
          tokens?: number
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          last_refill_at?: string
          tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plans: {
        Row: {
          created_at: string | null
          max_api_keys: number
          max_patterns: number
          max_webhooks: number
          plan_expires_at: string | null
          plan_name: string
          plan_started_at: string | null
          rate_limit_requests: number
          rate_limit_window_seconds: number
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          max_api_keys?: number
          max_patterns?: number
          max_webhooks?: number
          plan_expires_at?: string | null
          plan_name?: string
          plan_started_at?: string | null
          rate_limit_requests?: number
          rate_limit_window_seconds?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          max_api_keys?: number
          max_patterns?: number
          max_webhooks?: number
          plan_expires_at?: string | null
          plan_name?: string
          plan_started_at?: string | null
          rate_limit_requests?: number
          rate_limit_window_seconds?: number
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhooks: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          last_triggered_at: string | null
          secret: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          secret: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          secret?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_api_key: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_endpoint: string
          p_max_tokens?: number
          p_refill_interval?: unknown
          p_refill_rate?: number
        }
        Returns: boolean
      }
      get_my_jobs: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_pattern_id?: string
          p_status?: Database["public"]["Enums"]["job_status"]
        }
        Returns: {
          completed_at: string
          created_at: string
          error: string
          id: string
          image_url: string
          latency_ms: number
          manifest: Json
          pattern_id: string
          pattern_name: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }[]
      }
      get_pattern_job_stats: {
        Args: { p_user_id: string }
        Returns: {
          last_job_at: string
          pattern_format: Database["public"]["Enums"]["manifest_format"]
          pattern_id: string
          pattern_name: string
          success_rate: number
          successful_jobs_24h: number
          total_jobs_24h: number
        }[]
      }
      get_pattern_with_version: {
        Args: { p_pattern_id: string }
        Returns: {
          created_at: string
          format: Database["public"]["Enums"]["manifest_format"]
          id: string
          instructions: string
          is_active: boolean
          json_schema: Json
          model_profile: string
          name: string
          updated_at: string
          user_id: string
          version: number
        }[]
      }
      get_user_rate_limit: {
        Args: { p_user_id: string }
        Returns: {
          requests: number
          window_seconds: number
        }[]
      }
      pgmq_archive: {
        Args: { msg_id: number; queue_name: string }
        Returns: boolean
      }
      pgmq_create: {
        Args: { queue_name: string }
        Returns: undefined
      }
      pgmq_delete: {
        Args: { msg_id: number; queue_name: string }
        Returns: boolean
      }
      pgmq_metrics: {
        Args: { q_name: string }
        Returns: {
          newest_msg_age_sec: number
          oldest_msg_age_sec: number
          queue_length: number
          queue_name: string
          scrape_time: string
          total_messages: number
        }[]
      }
      pgmq_read: {
        Args: { qty: number; queue_name: string; vt: number }
        Returns: unknown[]
      }
      pgmq_send: {
        Args: { msg: Json; queue_name: string }
        Returns: number
      }
      publish_pattern_version: {
        Args: {
          p_csv_delimiter?: string
          p_csv_schema?: string
          p_format: Database["public"]["Enums"]["manifest_format"]
          p_instructions: string
          p_json_schema?: Json
          p_pattern_id: string
          p_plain_text_schema?: string
          p_xml_schema?: string
          p_yaml_schema?: string
        }
        Returns: number
      }
      switch_to_pattern_version: {
        Args: {
          p_pattern_id: string
          p_target_version: number
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      job_status: "queued" | "running" | "succeeded" | "failed"
      manifest_format: "json" | "yaml" | "xml" | "csv" | "text"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      job_status: ["queued", "running", "succeeded", "failed"],
      manifest_format: ["json", "yaml", "xml", "csv", "text"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.51.0 (currently installed v2.48.3)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
