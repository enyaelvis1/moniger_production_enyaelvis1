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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      account_session_inventory: {
        Row: {
          aal: string | null
          auth_methods: Json
          browser: string
          created_at: string
          device_label: string
          expires_at: string | null
          last_seen_at: string
          os: string
          platform: string
          provider: string | null
          recovery_bypass_active: boolean
          session_id: string
          signed_out_at: string | null
          user_id: string
        }
        Insert: {
          aal?: string | null
          auth_methods?: Json
          browser: string
          created_at?: string
          device_label: string
          expires_at?: string | null
          last_seen_at?: string
          os: string
          platform: string
          provider?: string | null
          recovery_bypass_active?: boolean
          session_id: string
          signed_out_at?: string | null
          user_id: string
        }
        Update: {
          aal?: string | null
          auth_methods?: Json
          browser?: string
          created_at?: string
          device_label?: string
          expires_at?: string | null
          last_seen_at?: string
          os?: string
          platform?: string
          provider?: string | null
          recovery_bypass_active?: boolean
          session_id?: string
          signed_out_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          business_id: string
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string
          id: number
          summary: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          business_id: string
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
          summary: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          business_id?: string
          created_at?: string
          detail?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_wallets: {
        Row: {
          available_balance: number
          balance: number
          business_id: string
          created_at: string
          created_by: string | null
          currency: string
          id: string
          last_funded_at: string | null
          provider: string
          provider_metadata: Json
          reserved_balance: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          available_balance?: number
          balance?: number
          business_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          last_funded_at?: string | null
          provider?: string
          provider_metadata?: Json
          reserved_balance?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          available_balance?: number
          balance?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          last_funded_at?: string | null
          provider?: string
          provider_metadata?: Json
          reserved_balance?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_wallets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_wallet_funding_sessions: {
        Row: {
          access_code: string | null
          amount: number
          business_id: string
          callback_url: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          failure_reason: string | null
          id: string
          ledger_entry_id: string | null
          checkout_url: string
          payer_email: string
          payer_name: string | null
          provider: string
          provider_metadata: Json
          provider_reference: string
          status: Database["public"]["Enums"]["wallet_funding_session_status"]
          updated_at: string
          updated_by: string | null
          verified_at: string | null
          wallet_id: string
        }
        Insert: {
          access_code?: string | null
          amount: number
          business_id: string
          callback_url: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          failure_reason?: string | null
          id?: string
          ledger_entry_id?: string | null
          checkout_url: string
          payer_email: string
          payer_name?: string | null
          provider?: string
          provider_metadata?: Json
          provider_reference: string
          status?: Database["public"]["Enums"]["wallet_funding_session_status"]
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          wallet_id: string
        }
        Update: {
          access_code?: string | null
          amount?: number
          business_id?: string
          callback_url?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          failure_reason?: string | null
          id?: string
          ledger_entry_id?: string | null
          checkout_url?: string
          payer_email?: string
          payer_name?: string | null
          provider?: string
          provider_metadata?: Json
          provider_reference?: string
          status?: Database["public"]["Enums"]["wallet_funding_session_status"]
          updated_at?: string
          updated_by?: string | null
          verified_at?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_wallet_funding_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_wallet_funding_sessions_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "wallet_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_wallet_funding_sessions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "workspace_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger_entries: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          business_id: string
          created_at: string
          created_by: string | null
          currency: string
          entry_type: Database["public"]["Enums"]["wallet_ledger_entry_type"]
          id: string
          idempotency_key: string | null
          provider_metadata: Json
          provider_reference: string | null
          reserved_after: number
          reserved_before: number
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          business_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_type: Database["public"]["Enums"]["wallet_ledger_entry_type"]
          id?: string
          idempotency_key?: string | null
          provider_metadata?: Json
          provider_reference?: string | null
          reserved_after: number
          reserved_before: number
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          entry_type?: Database["public"]["Enums"]["wallet_ledger_entry_type"]
          id?: string
          idempotency_key?: string | null
          provider_metadata?: Json
          provider_reference?: string | null
          reserved_after?: number
          reserved_before?: number
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "workspace_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount_paid: number
          balance_due: number | null
          bill_date: string
          bill_number: string
          business_id: string
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          due_date: string | null
          id: string
          notes: string | null
          scheduled_payment_date: string | null
          status: Database["public"]["Enums"]["bill_status"]
          subtotal: number
          tax_total: number
          total_amount: number
          updated_at: string
          updated_by: string | null
          vendor_id: string
        }
        Insert: {
          amount_paid?: number
          balance_due?: number | null
          bill_date?: string
          bill_number: string
          business_id: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          scheduled_payment_date?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          tax_total?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          vendor_id: string
        }
        Update: {
          amount_paid?: number
          balance_due?: number | null
          bill_date?: string
          bill_number?: string
          business_id?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          scheduled_payment_date?: string | null
          status?: Database["public"]["Enums"]["bill_status"]
          subtotal?: number
          tax_total?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          role: Database["public"]["Enums"]["business_role"]
          status: Database["public"]["Enums"]["business_member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          status?: Database["public"]["Enums"]["business_member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          role?: Database["public"]["Enums"]["business_role"]
          status?: Database["public"]["Enums"]["business_member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          created_at: string
          default_currency: string
          default_language: string
          default_locale: string
          email: string | null
          fiscal_year_start_month: number
          id: string
          legal_name: string | null
          name: string
          owner_user_id: string
          phone: string | null
          rc_number: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          default_currency?: string
          default_language?: string
          default_locale?: string
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          legal_name?: string | null
          name: string
          owner_user_id: string
          phone?: string | null
          rc_number?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          default_currency?: string
          default_language?: string
          default_locale?: string
          email?: string | null
          fiscal_year_start_month?: number
          id?: string
          legal_name?: string | null
          name?: string
          owner_user_id?: string
          phone?: string | null
          rc_number?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          billing_address: string | null
          business_name: string | null
          business_id: string
          city_state: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          street_address: string | null
          updated_at: string
        }
        Insert: {
          billing_address?: string | null
          business_name?: string | null
          business_id: string
          city_state?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          street_address?: string | null
          updated_at?: string
        }
        Update: {
          billing_address?: string | null
          business_name?: string | null
          business_id?: string
          city_state?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          street_address?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_deliveries: {
        Row: {
          business_id: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json
          provider: string
          recipient_email: string
          sent_at: string | null
          status: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          provider?: string
          recipient_email: string
          sent_at?: string | null
          status: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json
          provider?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_deliveries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      existing_secret_id: {
        Row: {
          id: string | null
        }
        Insert: {
          id?: string | null
        }
        Update: {
          id?: string | null
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          line_number: number
          line_total: number | null
          quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          line_number: number
          line_total?: number | null
          quantity: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          line_number?: number
          line_total?: number | null
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          balance_due: number | null
          business_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          delivery_attempt_count: number
          delivery_email: string | null
          delivery_last_attempt_at: string | null
          delivery_last_error: string | null
          delivery_message: string | null
          delivery_method: string
          delivery_status: string
          delivery_subject: string | null
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_at: string | null
          payment_link_enabled: boolean
          payment_link_last_shared_at: string | null
          payment_public_token: string
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_total: number
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number | null
          business_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          delivery_attempt_count?: number
          delivery_email?: string | null
          delivery_last_attempt_at?: string | null
          delivery_last_error?: string | null
          delivery_message?: string | null
          delivery_method?: string
          delivery_status?: string
          delivery_subject?: string | null
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          payment_link_enabled?: boolean
          payment_link_last_shared_at?: string | null
          payment_public_token?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          delivery_attempt_count?: number
          delivery_email?: string | null
          delivery_last_attempt_at?: string | null
          delivery_last_error?: string | null
          delivery_message?: string | null
          delivery_method?: string
          delivery_status?: string
          delivery_subject?: string | null
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          payment_link_enabled?: boolean
          payment_link_last_shared_at?: string | null
          payment_public_token?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_total?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          code_hint: string
          created_at: string
          id: string
          used_at: string | null
          used_session_id: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          code_hint: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_session_id?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          code_hint?: string
          created_at?: string
          id?: string
          used_at?: string | null
          used_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mfa_recovery_sessions: {
        Row: {
          created_at: string
          expires_at: string
          recovery_code_id: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          recovery_code_id?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          recovery_code_id?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mfa_recovery_sessions_recovery_code_id_fkey"
            columns: ["recovery_code_id"]
            isOneToOne: false
            referencedRelation: "mfa_recovery_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          bill_due: boolean
          business_id: string
          created_at: string
          email_digest: boolean
          id: string
          invoice_sent: boolean
          overdue: boolean
          payment_received: boolean
          push_notifications: boolean
          team_updates: boolean
          updated_at: string
          user_id: string
          weekly_report: boolean
        }
        Insert: {
          bill_due?: boolean
          business_id: string
          created_at?: string
          email_digest?: boolean
          id?: string
          invoice_sent?: boolean
          overdue?: boolean
          payment_received?: boolean
          push_notifications?: boolean
          team_updates?: boolean
          updated_at?: string
          user_id: string
          weekly_report?: boolean
        }
        Update: {
          bill_due?: boolean
          business_id?: string
          created_at?: string
          email_digest?: boolean
          id?: string
          invoice_sent?: boolean
          overdue?: boolean
          payment_received?: boolean
          push_notifications?: boolean
          team_updates?: boolean
          updated_at?: string
          user_id?: string
          weekly_report?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          business_id: string
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          recipient_user_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body: string
          business_id: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          recipient_user_id: string
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          body?: string
          business_id?: string
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          recipient_user_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          bill_id: string | null
          business_id: string
          counterparty_name: string | null
          created_at: string
          created_by: string | null
          currency: string
          gateway: Database["public"]["Enums"]["payment_gateway"]
          gateway_response: string | null
          id: string
          invoice_id: string | null
          metadata: Json
          paid_on: string
          payment_reference: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          bill_id?: string | null
          business_id: string
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gateway?: Database["public"]["Enums"]["payment_gateway"]
          gateway_response?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json
          paid_on?: string
          payment_reference: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          business_id?: string
          counterparty_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          gateway?: Database["public"]["Enums"]["payment_gateway"]
          gateway_response?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json
          paid_on?: string
          payment_reference?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_preferences: {
        Row: {
          analytics_opt_in: boolean
          business_id: string
          created_at: string
          id: string
          include_audit_log_in_exports: boolean
          include_contact_details_in_exports: boolean
          product_updates_opt_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          analytics_opt_in?: boolean
          business_id: string
          created_at?: string
          id?: string
          include_audit_log_in_exports?: boolean
          include_contact_details_in_exports?: boolean
          product_updates_opt_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          analytics_opt_in?: boolean
          business_id?: string
          created_at?: string
          id?: string
          include_audit_log_in_exports?: boolean
          include_contact_details_in_exports?: boolean
          product_updates_opt_in?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_preferences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_currency: string
          full_name: string | null
          id: string
          language: string | null
          locale: string | null
          phone: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          full_name?: string | null
          id: string
          language?: string | null
          locale?: string | null
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_currency?: string
          full_name?: string | null
          id?: string
          language?: string | null
          locale?: string | null
          phone?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_digest_runs: {
        Row: {
          business_id: string
          created_at: string
          email_delivery_id: string | null
          error_message: string | null
          id: string
          item_count: number
          period_key: string
          scheduled_for: string
          status: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email_delivery_id?: string | null
          error_message?: string | null
          id?: string
          item_count?: number
          period_key: string
          scheduled_for: string
          status: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email_delivery_id?: string | null
          error_message?: string | null
          id?: string
          item_count?: number
          period_key?: string
          scheduled_for?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_digest_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_digest_runs_email_delivery_id_fkey"
            columns: ["email_delivery_id"]
            isOneToOne: false
            referencedRelation: "email_deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          account_name: string | null
          account_number: string | null
          bank_name: string | null
          bank_id: string | null
          business_id: string
          business_name: string
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          bank_id?: string | null
          business_id: string
          business_name: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          bank_name?: string | null
          bank_id?: string | null
          business_id?: string
          business_name?: string
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          bank_code: string | null
          country_code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          bank_code?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          bank_code?: string | null
          country_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_payouts: {
        Row: {
          amount: number
          bill_id: string | null
          business_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          cancelled_at: string | null
          last_attempt_at: string | null
          next_retry_at: string | null
          retry_count: number
          provider: string
          provider_metadata: Json
          provider_recipient_code: string | null
          provider_reference: string | null
          provider_transfer_code: string | null
          reversed_at: string | null
          reserved_at: string | null
          scheduled_for: string | null
          status: Database["public"]["Enums"]["workspace_payout_status"]
          submitted_at: string | null
          updated_at: string
          updated_by: string | null
          vendor_bank_id: string | null
          vendor_id: string | null
          wallet_id: string
        }
        Insert: {
          amount: number
          bill_id?: string | null
          business_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          cancelled_at?: string | null
          last_attempt_at?: string | null
          next_retry_at?: string | null
          retry_count?: number
          provider?: string
          provider_metadata?: Json
          provider_recipient_code?: string | null
          provider_reference?: string | null
          provider_transfer_code?: string | null
          reversed_at?: string | null
          reserved_at?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["workspace_payout_status"]
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_bank_id?: string | null
          vendor_id?: string | null
          wallet_id: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          business_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          cancelled_at?: string | null
          last_attempt_at?: string | null
          next_retry_at?: string | null
          retry_count?: number
          provider?: string
          provider_metadata?: Json
          provider_recipient_code?: string | null
          provider_reference?: string | null
          provider_transfer_code?: string | null
          reversed_at?: string | null
          reserved_at?: string | null
          scheduled_for?: string | null
          status?: Database["public"]["Enums"]["workspace_payout_status"]
          submitted_at?: string | null
          updated_at?: string
          updated_by?: string | null
          vendor_bank_id?: string | null
          vendor_id?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_payouts_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_payouts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_payouts_vendor_bank_id_fkey"
            columns: ["vendor_bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_payouts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_payouts_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "workspace_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_categories: {
        Row: {
          id: string
          name: string
          is_active: boolean
          created_at: string
          created_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          is_active?: boolean
          created_at?: string
          created_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      workspace_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          business_id: string
          created_at: string
          expires_at: string
          id: string
          invitation_token: string
          invited_by: string
          invited_email: string
          role: Database["public"]["Enums"]["business_role"]
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          business_id: string
          created_at?: string
          expires_at?: string
          id?: string
          invitation_token: string
          invited_by: string
          invited_email: string
          role: Database["public"]["Enums"]["business_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          business_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          invitation_token?: string
          invited_by?: string
          invited_email?: string
          role?: Database["public"]["Enums"]["business_role"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_workspace_invitation: {
        Args: { p_token: string }
        Returns: {
          business_id: string
          business_name: string
          membership_id: string
          role: Database["public"]["Enums"]["business_role"]
        }[]
      }
      delete_customer_with_guard: {
        Args: { p_business_id: string; p_customer_id: string }
        Returns: Json
      }
      get_mfa_recovery_summary: {
        Args: never
        Returns: {
          last_used_at: string
          latest_generated_at: string
          remaining_codes: number
          total_codes: number
        }[]
      }
      get_workspace_invitation: {
        Args: { p_token: string }
        Returns: {
          business_id: string
          business_name: string
          expires_at: string
          invitation_id: string
          invited_by_name: string
          invited_email: string
          role: Database["public"]["Enums"]["business_role"]
          status: string
        }[]
      }
      has_business_role: {
        Args: {
          allowed_roles: Database["public"]["Enums"]["business_role"][]
          target_business_id: string
        }
        Returns: boolean
      }
      has_mfa_recovery_session: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      invite_business_member: {
        Args: {
          p_business_id: string
          p_email: string
          p_role?: Database["public"]["Enums"]["business_role"]
        }
        Returns: Json
      }
      is_business_member: {
        Args: { target_business_id: string }
        Returns: boolean
      }
      is_email_registered: { Args: { p_email: string }; Returns: boolean }
      list_account_session_inventory: {
        Args: never
        Returns: {
          aal: string
          auth_methods: Json
          browser: string
          created_at: string
          device_label: string
          expires_at: string
          last_seen_at: string
          os: string
          platform: string
          provider: string
          recovery_bypass_active: boolean
          session_id: string
          signed_out_at: string
        }[]
      }
      list_business_members: {
        Args: { p_business_id: string }
        Returns: {
          avatar_url: string
          business_id: string
          created_at: string
          email: string
          full_name: string
          invited_by: string
          joined_at: string
          membership_id: string
          role: Database["public"]["Enums"]["business_role"]
          status: Database["public"]["Enums"]["business_member_status"]
          updated_at: string
          user_id: string
        }[]
      }
      list_workspace_invitations: {
        Args: { p_business_id: string }
        Returns: {
          accepted_at: string
          accepted_user_id: string
          business_id: string
          created_at: string
          expires_at: string
          invitation_id: string
          invited_by: string
          invited_by_name: string
          invited_email: string
          role: Database["public"]["Enums"]["business_role"]
          status: string
          updated_at: string
        }[]
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_actor_user_id?: string
          p_business_id: string
          p_detail?: Json
          p_entity_id: string
          p_entity_type: string
          p_summary: string
        }
        Returns: {
          action: string
          actor_user_id: string | null
          business_id: string
          created_at: string
          detail: Json
          entity_id: string | null
          entity_type: string
          id: number
          summary: string
        }
        SetofOptions: {
          from: "*"
          to: "audit_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      mark_account_sessions_signed_out: {
        Args: { p_current_session_id?: string; p_scope: string }
        Returns: number
      }
      update_business_member_role: {
        Args: {
          p_membership_id: string
          p_role: Database["public"]["Enums"]["business_role"]
        }
        Returns: undefined
      }
      update_business_member_status: {
        Args: {
          p_membership_id: string
          p_status: Database["public"]["Enums"]["business_member_status"]
        }
        Returns: undefined
      }
      upsert_account_session_inventory: {
        Args: {
          p_aal?: string
          p_auth_methods?: Json
          p_browser?: string
          p_device_label?: string
          p_expires_at?: string
          p_os?: string
          p_platform?: string
          p_provider?: string
          p_recovery_bypass_active?: boolean
          p_session_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      bill_status: "unpaid" | "scheduled" | "paid" | "overdue"
      business_member_status: "active" | "pending" | "revoked"
      business_role: "owner" | "admin" | "accountant" | "viewer"
      invoice_status: "draft" | "sent" | "overdue" | "paid" | "cancelled"
      notification_type:
        | "invoice"
        | "bill"
        | "payment"
        | "team"
        | "report"
        | "system"
      payment_gateway: "paystack" | "stripe" | "bank_transfer" | "manual"
      payment_status: "pending" | "completed" | "failed" | "scheduled"
      payment_type: "receivable" | "payable"
      workspace_payout_status: "pending" | "reserved" | "submitted" | "completed" | "failed" | "reversed" | "cancelled"
      wallet_ledger_entry_type:
        | "topup_pending"
        | "topup_completed"
        | "payout_reserved"
        | "payout_completed"
        | "payout_failed"
        | "payout_reversed"
        | "adjustment_credit"
        | "adjustment_debit"
      wallet_funding_session_status: "initialized" | "completed" | "failed" | "cancelled"
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
      bill_status: ["unpaid", "scheduled", "paid", "overdue"],
      business_member_status: ["active", "pending", "revoked"],
      business_role: ["owner", "admin", "accountant", "viewer"],
      invoice_status: ["draft", "sent", "overdue", "paid", "cancelled"],
      notification_type: [
        "invoice",
        "bill",
        "payment",
        "team",
        "report",
        "system",
      ],
      payment_gateway: ["paystack", "stripe", "bank_transfer", "manual"],
      payment_status: ["pending", "completed", "failed", "scheduled"],
      payment_type: ["receivable", "payable"],
      workspace_payout_status: [
        "pending",
        "reserved",
        "submitted",
        "completed",
        "failed",
        "reversed",
        "cancelled",
      ],
      wallet_ledger_entry_type: [
        "topup_pending",
        "topup_completed",
        "payout_reserved",
        "payout_completed",
        "payout_failed",
        "payout_reversed",
        "adjustment_credit",
        "adjustment_debit",
      ],
      wallet_funding_session_status: ["initialized", "completed", "failed", "cancelled"],
    },
  },
} as const
