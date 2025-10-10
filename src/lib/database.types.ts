/**
 * Database type definitions for ImgGo
 * Generated from Supabase schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ManifestFormat = "json" | "yaml" | "xml" | "csv" | "text";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          hashed_key: string;
          name: string;
          scopes: string[];
          created_at: string;
          last_used_at: string | null;
          expires_at: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          hashed_key: string;
          name: string;
          scopes?: string[];
          created_at?: string;
          last_used_at?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          hashed_key?: string;
          name?: string;
          scopes?: string[];
          created_at?: string;
          last_used_at?: string | null;
          expires_at?: string | null;
          is_active?: boolean;
        };
      };
      patterns: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          format: ManifestFormat;
          json_schema: Json | null;
          instructions: string;
          model_profile: string;
          version: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          format?: ManifestFormat;
          json_schema?: Json | null;
          instructions: string;
          model_profile?: string;
          version?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          format?: ManifestFormat;
          json_schema?: Json | null;
          instructions?: string;
          model_profile?: string;
          version?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      pattern_versions: {
        Row: {
          id: string;
          pattern_id: string;
          version: number;
          json_schema: Json | null;
          instructions: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          pattern_id: string;
          version: number;
          json_schema?: Json | null;
          instructions: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          pattern_id?: string;
          version?: number;
          json_schema?: Json | null;
          instructions?: string;
          created_at?: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          pattern_id: string;
          image_url: string;
          status: JobStatus;
          manifest: Json | null;
          error: string | null;
          latency_ms: number | null;
          created_at: string;
          updated_at: string;
          started_at: string | null;
          completed_at: string | null;
          idempotency_key: string | null;
          requested_by: string | null;
          extras: Json | null;
        };
        Insert: {
          id?: string;
          pattern_id: string;
          image_url: string;
          status?: JobStatus;
          manifest?: Json | null;
          error?: string | null;
          latency_ms?: number | null;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          idempotency_key?: string | null;
          requested_by?: string | null;
          extras?: Json | null;
        };
        Update: {
          id?: string;
          pattern_id?: string;
          image_url?: string;
          status?: JobStatus;
          manifest?: Json | null;
          error?: string | null;
          latency_ms?: number | null;
          created_at?: string;
          updated_at?: string;
          started_at?: string | null;
          completed_at?: string | null;
          idempotency_key?: string | null;
          requested_by?: string | null;
          extras?: Json | null;
        };
      };
      webhooks: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          secret: string;
          events: string[];
          is_active: boolean;
          created_at: string;
          updated_at: string;
          last_triggered_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          url: string;
          secret: string;
          events?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          last_triggered_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          url?: string;
          secret?: string;
          events?: string[];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          last_triggered_at?: string | null;
        };
      };
      rate_limits: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          tokens: number;
          last_refill_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          tokens?: number;
          last_refill_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          endpoint?: string;
          tokens?: number;
          last_refill_at?: string;
          created_at?: string;
        };
      };
    };
    Functions: {
      check_rate_limit: {
        Args: {
          p_endpoint: string;
          p_max_tokens?: number;
          p_refill_rate?: number;
          p_refill_interval?: string;
        };
        Returns: boolean;
      };
      get_my_jobs: {
        Args: {
          p_pattern_id?: string;
          p_status?: JobStatus;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          pattern_id: string;
          pattern_name: string;
          image_url: string;
          status: JobStatus;
          manifest: Json | null;
          error: string | null;
          latency_ms: number | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        }[];
      };
      get_pattern_with_version: {
        Args: {
          p_pattern_id: string;
        };
        Returns: Database["public"]["Tables"]["patterns"]["Row"][];
      };
      publish_pattern_version: {
        Args: {
          p_pattern_id: string;
          p_json_schema: Json | null;
          p_instructions: string;
        };
        Returns: number;
      };
      pgmq_create: {
        Args: {
          queue_name: string;
        };
        Returns: void;
      };
      pgmq_send: {
        Args: {
          queue_name: string;
          msg: Json;
        };
        Returns: number;
      };
      pgmq_read: {
        Args: {
          queue_name: string;
          vt: number;
          qty: number;
        };
        Returns: Json;
      };
      pgmq_delete: {
        Args: {
          queue_name: string;
          msg_id: number;
        };
        Returns: boolean;
      };
      pgmq_archive: {
        Args: {
          queue_name: string;
          msg_id: number;
        };
        Returns: boolean;
      };
      pgmq_metrics: {
        Args: {
          queue_name: string;
        };
        Returns: Json;
      };
      pgmq_purge_queue: {
        Args: {
          queue_name: string;
        };
        Returns: number;
      };
    };
  };
}
