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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_chat_credits: {
        Row: {
          balance_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_cents?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          model: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          model?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          model?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          cost_cents: number | null
          created_at: string
          id: string
          model: string | null
          role: string
          tokens_used: number | null
        }
        Insert: {
          content: string
          conversation_id: string
          cost_cents?: number | null
          created_at?: string
          id?: string
          model?: string | null
          role: string
          tokens_used?: number | null
        }
        Update: {
          content?: string
          conversation_id?: string
          cost_cents?: number | null
          created_at?: string
          id?: string
          model?: string | null
          role?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_transactions: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          note: string | null
          stripe_session_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          note?: string | null
          stripe_session_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          note?: string | null
          stripe_session_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          appointment_date: string | null
          appointment_time: string | null
          booked_at: string | null
          calendar_url: string | null
          call_id: string | null
          caller_name: string | null
          caller_phone: string | null
          client_id: string | null
          created_at: string
          google_event_id: string | null
          id: string
          service: string | null
          slug: string
          status: string
        }
        Insert: {
          appointment_date?: string | null
          appointment_time?: string | null
          booked_at?: string | null
          calendar_url?: string | null
          call_id?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          client_id?: string | null
          created_at?: string
          google_event_id?: string | null
          id?: string
          service?: string | null
          slug: string
          status?: string
        }
        Update: {
          appointment_date?: string | null
          appointment_time?: string | null
          booked_at?: string | null
          calendar_url?: string | null
          call_id?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          client_id?: string | null
          created_at?: string
          google_event_id?: string | null
          id?: string
          service?: string | null
          slug?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      call_analysis_reports: {
        Row: {
          analyzed_at: string | null
          applied_at: string | null
          calls_analyzed: number | null
          client_id: string | null
          id: string
          issues: Json | null
          period_end: string | null
          period_start: string | null
          recommendations: Json | null
          status: string | null
        }
        Insert: {
          analyzed_at?: string | null
          applied_at?: string | null
          calls_analyzed?: number | null
          client_id?: string | null
          id?: string
          issues?: Json | null
          period_end?: string | null
          period_start?: string | null
          recommendations?: Json | null
          status?: string | null
        }
        Update: {
          analyzed_at?: string | null
          applied_at?: string | null
          calls_analyzed?: number | null
          client_id?: string | null
          id?: string
          issues?: Json | null
          period_end?: string | null
          period_start?: string | null
          recommendations?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_analysis_reports_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      call_insights: {
        Row: {
          agent_confidence: number | null
          agent_confused_moments: number
          avg_agent_turn_chars: number | null
          call_id: string
          caller_frustrated: boolean
          client_id: string
          created_at: string
          feature_suggestions: Json
          id: string
          loop_rate: number | null
          repeated_questions: number
          short_turn_count: number | null
          source: string
          talk_ratio_agent: number | null
          unanswered_questions: Json
        }
        Insert: {
          agent_confidence?: number | null
          agent_confused_moments?: number
          avg_agent_turn_chars?: number | null
          call_id: string
          caller_frustrated?: boolean
          client_id: string
          created_at?: string
          feature_suggestions?: Json
          id?: string
          loop_rate?: number | null
          repeated_questions?: number
          short_turn_count?: number | null
          source?: string
          talk_ratio_agent?: number | null
          unanswered_questions?: Json
        }
        Update: {
          agent_confidence?: number | null
          agent_confused_moments?: number
          avg_agent_turn_chars?: number | null
          call_id?: string
          caller_frustrated?: boolean
          client_id?: string
          created_at?: string
          feature_suggestions?: Json
          id?: string
          loop_rate?: number | null
          repeated_questions?: number
          short_turn_count?: number | null
          source?: string
          talk_ratio_agent?: number | null
          unanswered_questions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "call_insights_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      call_logs: {
        Row: {
          ai_summary: string | null
          billed_cost_cents: number | null
          billed_duration_seconds: number | null
          billing_status: string | null
          call_direction: string | null
          call_state: Json | null
          call_status: string | null
          callback_preference: string | null
          caller_name: string | null
          caller_phone: string | null
          client_id: string | null
          confidence: number | null
          contact_id: string | null
          created_at: string | null
          duration_seconds: number | null
          end_reason: string | null
          ended_at: string | null
          faq_suggestions: Json | null
          follow_up_status: string | null
          followup_reminded_at: string | null
          id: string
          in_call_sms_sent: boolean | null
          is_overage: boolean | null
          key_topics: Json | null
          lead_status: string | null
          next_steps: string | null
          parent_call_log_id: string | null
          quality_score: number | null
          recording_url: string | null
          seconds_counted: boolean | null
          sentiment: string | null
          service_type: string | null
          sms_outcome: string | null
          started_at: string | null
          transcript: Json | null
          transfer_started_at: string | null
          transfer_status: string | null
          transfer_updated_at: string | null
          twilio_call_sid: string | null
          ultravox_call_id: string | null
          updated_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          billed_cost_cents?: number | null
          billed_duration_seconds?: number | null
          billing_status?: string | null
          call_direction?: string | null
          call_state?: Json | null
          call_status?: string | null
          callback_preference?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          client_id?: string | null
          confidence?: number | null
          contact_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          faq_suggestions?: Json | null
          follow_up_status?: string | null
          followup_reminded_at?: string | null
          id?: string
          in_call_sms_sent?: boolean | null
          is_overage?: boolean | null
          key_topics?: Json | null
          lead_status?: string | null
          next_steps?: string | null
          parent_call_log_id?: string | null
          quality_score?: number | null
          recording_url?: string | null
          seconds_counted?: boolean | null
          sentiment?: string | null
          service_type?: string | null
          sms_outcome?: string | null
          started_at?: string | null
          transcript?: Json | null
          transfer_started_at?: string | null
          transfer_status?: string | null
          transfer_updated_at?: string | null
          twilio_call_sid?: string | null
          ultravox_call_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          billed_cost_cents?: number | null
          billed_duration_seconds?: number | null
          billing_status?: string | null
          call_direction?: string | null
          call_state?: Json | null
          call_status?: string | null
          callback_preference?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          client_id?: string | null
          confidence?: number | null
          contact_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          end_reason?: string | null
          ended_at?: string | null
          faq_suggestions?: Json | null
          follow_up_status?: string | null
          followup_reminded_at?: string | null
          id?: string
          in_call_sms_sent?: boolean | null
          is_overage?: boolean | null
          key_topics?: Json | null
          lead_status?: string | null
          next_steps?: string | null
          parent_call_log_id?: string | null
          quality_score?: number | null
          recording_url?: string | null
          seconds_counted?: boolean | null
          sentiment?: string | null
          service_type?: string | null
          sms_outcome?: string | null
          started_at?: string | null
          transcript?: Json | null
          transfer_started_at?: string | null
          transfer_status?: string | null
          transfer_updated_at?: string | null
          twilio_call_sid?: string | null
          ultravox_call_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_parent_call_log_id_fkey"
            columns: ["parent_call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      call_stages: {
        Row: {
          call_log_id: string | null
          id: string
          stage_index: number
          stage_type: string
          trigger_reason: string | null
          triggered_at: string | null
          ultravox_call_id: string | null
        }
        Insert: {
          call_log_id?: string | null
          id?: string
          stage_index?: number
          stage_type?: string
          trigger_reason?: string | null
          triggered_at?: string | null
          ultravox_call_id?: string | null
        }
        Update: {
          call_log_id?: string | null
          id?: string
          stage_index?: number
          stage_type?: string
          trigger_reason?: string | null
          triggered_at?: string | null
          ultravox_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_stages_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_leads: {
        Row: {
          added_at: string | null
          call_count: number | null
          client_id: string | null
          disposition: string | null
          id: string
          last_call_log_id: string | null
          last_called_at: string | null
          lead_status: string | null
          name: string | null
          notes: string | null
          phone: string
          scheduled_callback_at: string | null
          source: string | null
          status: string
        }
        Insert: {
          added_at?: string | null
          call_count?: number | null
          client_id?: string | null
          disposition?: string | null
          id?: string
          last_call_log_id?: string | null
          last_called_at?: string | null
          lead_status?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          scheduled_callback_at?: string | null
          source?: string | null
          status?: string
        }
        Update: {
          added_at?: string | null
          call_count?: number | null
          client_id?: string | null
          disposition?: string | null
          id?: string
          last_call_log_id?: string | null
          last_called_at?: string | null
          lead_status?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          scheduled_callback_at?: string | null
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_leads_last_call_log_id_fkey"
            columns: ["last_call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          call_count: number | null
          client_id: string
          created_at: string | null
          document_url: string | null
          email: string | null
          first_seen_at: string | null
          id: string
          is_vip: boolean | null
          last_call_at: string | null
          last_outcome: string | null
          name: string | null
          notes: string | null
          phone: string
          preferences: Json | null
          sms_opted_out: boolean | null
          source: string | null
          tags: string[] | null
          transfer_enabled: boolean | null
          updated_at: string | null
          vip_notes: string | null
          vip_relationship: string | null
        }
        Insert: {
          call_count?: number | null
          client_id: string
          created_at?: string | null
          document_url?: string | null
          email?: string | null
          first_seen_at?: string | null
          id?: string
          is_vip?: boolean | null
          last_call_at?: string | null
          last_outcome?: string | null
          name?: string | null
          notes?: string | null
          phone: string
          preferences?: Json | null
          sms_opted_out?: boolean | null
          source?: string | null
          tags?: string[] | null
          transfer_enabled?: boolean | null
          updated_at?: string | null
          vip_notes?: string | null
          vip_relationship?: string | null
        }
        Update: {
          call_count?: number | null
          client_id?: string
          created_at?: string | null
          document_url?: string | null
          email?: string | null
          first_seen_at?: string | null
          id?: string
          is_vip?: boolean | null
          last_call_at?: string | null
          last_outcome?: string | null
          name?: string | null
          notes?: string | null
          phone?: string
          preferences?: Json | null
          sms_opted_out?: boolean | null
          source?: string | null
          tags?: string[] | null
          transfer_enabled?: boolean | null
          updated_at?: string | null
          vip_notes?: string | null
          vip_relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_knowledge_docs: {
        Row: {
          char_count: number
          client_id: string | null
          content_text: string
          corpus_document_id: string | null
          corpus_source_id: string | null
          corpus_status: string | null
          created_at: string | null
          file_size_bytes: number | null
          filename: string
          id: string
          intake_id: string | null
          mime_type: string | null
        }
        Insert: {
          char_count: number
          client_id?: string | null
          content_text: string
          corpus_document_id?: string | null
          corpus_source_id?: string | null
          corpus_status?: string | null
          created_at?: string | null
          file_size_bytes?: number | null
          filename: string
          id?: string
          intake_id?: string | null
          mime_type?: string | null
        }
        Update: {
          char_count?: number
          client_id?: string | null
          content_text?: string
          corpus_document_id?: string | null
          corpus_source_id?: string | null
          corpus_status?: string | null
          created_at?: string | null
          file_size_bytes?: number | null
          filename?: string
          id?: string
          intake_id?: string | null
          mime_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_knowledge_docs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_knowledge_docs_intake_id_fkey"
            columns: ["intake_id"]
            isOneToOne: false
            referencedRelation: "intake_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      client_services: {
        Row: {
          active: boolean
          booking_notes: string
          category: string
          client_id: string
          created_at: string
          description: string
          duration_mins: number | null
          id: string
          name: string
          price: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          booking_notes?: string
          category?: string
          client_id: string
          created_at?: string
          description?: string
          duration_mins?: number | null
          id?: string
          name: string
          price?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          booking_notes?: string
          category?: string
          client_id?: string
          created_at?: string
          description?: string
          duration_mins?: number | null
          id?: string
          name?: string
          price?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_services_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_users: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          onboarding_state: Json | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          onboarding_state?: Json | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          onboarding_state?: Json | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_vip_contacts: {
        Row: {
          client_id: string
          created_at: string
          document_url: string | null
          id: string
          name: string
          notes: string | null
          phone: string
          relationship: string | null
          transfer_enabled: boolean
        }
        Insert: {
          client_id: string
          created_at?: string
          document_url?: string | null
          id?: string
          name: string
          notes?: string | null
          phone: string
          relationship?: string | null
          transfer_enabled?: boolean
        }
        Update: {
          client_id?: string
          created_at?: string
          document_url?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          relationship?: string | null
          transfer_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "client_vip_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_website_sources: {
        Row: {
          chunk_count: number | null
          client_id: string
          created_at: string
          id: string
          last_scraped_at: string | null
          scrape_error: string | null
          scrape_status: string
          url: string
        }
        Insert: {
          chunk_count?: number | null
          client_id: string
          created_at?: string
          id?: string
          last_scraped_at?: string | null
          scrape_error?: string | null
          scrape_status?: string
          url: string
        }
        Update: {
          chunk_count?: number | null
          client_id?: string
          created_at?: string
          id?: string
          last_scraped_at?: string | null
          scrape_error?: string | null
          scrape_status?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_website_sources_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          activation_log: Json | null
          active_prompt_version_id: string | null
          after_hours_behavior: string | null
          after_hours_emergency_phone: string | null
          agent_mode: string
          agent_name: string | null
          agent_voice_id: string | null
          bonus_minutes: number
          booking_buffer_minutes: number | null
          booking_enabled: boolean | null
          booking_service_duration_minutes: number | null
          business_facts: string[] | null
          business_hours_weekday: string | null
          business_hours_weekend: string | null
          business_name: string
          business_notes: string | null
          calendar_auth_status: string | null
          calendar_beta_enabled: boolean | null
          calendar_mode: string | null
          call_handling_mode: string
          callback_phone: string | null
          cancel_at: string | null
          city: string | null
          classification_rules: string | null
          claude_knowledge_path: string | null
          contact_email: string | null
          context_data: string | null
          context_data_label: string | null
          created_at: string | null
          effective_monthly_rate: number | null
          email_notifications_enabled: boolean | null
          extra_qa: Json | null
          fields_to_collect: string[] | null
          first_call_at: string | null
          forwarding_number: string | null
          gbp_photo_url: string | null
          gbp_place_id: string | null
          gbp_rating: number | null
          gbp_review_count: number | null
          gbp_summary: string | null
          google_calendar_id: string | null
          google_refresh_token: string | null
          grace_period_end: string | null
          hand_tuned: boolean | null
          hours: string | null
          id: string
          injected_note: string | null
          injected_note_expires_at: string | null
          ivr_enabled: boolean | null
          ivr_prompt: string | null
          knowledge_backend: string | null
          last_agent_sync_at: string | null
          last_agent_sync_error: string | null
          last_agent_sync_status: string | null
          last_agent_synced_at: string | null
          last_minute_reset_at: string | null
          minute_warning_100_sent_at: string | null
          minute_warning_80_sent_at: string | null
          minutes_used_this_month: number | null
          monthly_minute_limit: number | null
          niche: string | null
          niche_custom_variables: Json | null
          outbound_goal: string | null
          outbound_notes: string | null
          outbound_opening: string | null
          outbound_prompt: string | null
          outbound_tone: string | null
          outbound_vm_script: string | null
          owner_name: string | null
          pending_loop_suggestion: Json | null
          previous_agent_voice_id: string | null
          pricing_policy: string | null
          seconds_used_this_month: number | null
          selected_plan: string | null
          service_catalog: Json
          services_offered: string | null
          settings_revision: number
          setup_complete: boolean | null
          slug: string
          sms_enabled: boolean | null
          sms_template: string | null
          staff_roster: Json | null
          state: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_discount_name: string | null
          stripe_subscription_id: string | null
          subscription_current_period_end: string | null
          subscription_status: string | null
          system_prompt: string
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          telegram_chat_id_2: string | null
          telegram_notifications_enabled: boolean | null
          telegram_registration_token: string | null
          telegram_style: string
          timezone: string | null
          today_update: string | null
          tools: Json | null
          transfer_conditions: string | null
          trial_converted: boolean | null
          trial_expires_at: string | null
          twilio_number: string | null
          twilio_subaccount_sid: string | null
          ultravox_agent_id: string | null
          unknown_answer_behavior: string | null
          updated_at: string | null
          user_id: string | null
          voice_style_preset: string | null
          voicemail_greeting_audio_url: string | null
          voicemail_greeting_text: string | null
          website_knowledge_approved: Json | null
          website_knowledge_preview: Json | null
          website_last_scraped_at: string | null
          website_scrape_error: string | null
          website_scrape_pages: Json | null
          website_scrape_status: string | null
          website_url: string | null
          weekly_digest_enabled: boolean | null
        }
        Insert: {
          activation_log?: Json | null
          active_prompt_version_id?: string | null
          after_hours_behavior?: string | null
          after_hours_emergency_phone?: string | null
          agent_mode?: string
          agent_name?: string | null
          agent_voice_id?: string | null
          bonus_minutes?: number
          booking_buffer_minutes?: number | null
          booking_enabled?: boolean | null
          booking_service_duration_minutes?: number | null
          business_facts?: string[] | null
          business_hours_weekday?: string | null
          business_hours_weekend?: string | null
          business_name: string
          business_notes?: string | null
          calendar_auth_status?: string | null
          calendar_beta_enabled?: boolean | null
          calendar_mode?: string | null
          call_handling_mode?: string
          callback_phone?: string | null
          cancel_at?: string | null
          city?: string | null
          classification_rules?: string | null
          claude_knowledge_path?: string | null
          contact_email?: string | null
          context_data?: string | null
          context_data_label?: string | null
          created_at?: string | null
          effective_monthly_rate?: number | null
          email_notifications_enabled?: boolean | null
          extra_qa?: Json | null
          fields_to_collect?: string[] | null
          first_call_at?: string | null
          forwarding_number?: string | null
          gbp_photo_url?: string | null
          gbp_place_id?: string | null
          gbp_rating?: number | null
          gbp_review_count?: number | null
          gbp_summary?: string | null
          google_calendar_id?: string | null
          google_refresh_token?: string | null
          grace_period_end?: string | null
          hand_tuned?: boolean | null
          hours?: string | null
          id?: string
          injected_note?: string | null
          injected_note_expires_at?: string | null
          ivr_enabled?: boolean | null
          ivr_prompt?: string | null
          knowledge_backend?: string | null
          last_agent_sync_at?: string | null
          last_agent_sync_error?: string | null
          last_agent_sync_status?: string | null
          last_agent_synced_at?: string | null
          last_minute_reset_at?: string | null
          minute_warning_100_sent_at?: string | null
          minute_warning_80_sent_at?: string | null
          minutes_used_this_month?: number | null
          monthly_minute_limit?: number | null
          niche?: string | null
          niche_custom_variables?: Json | null
          outbound_goal?: string | null
          outbound_notes?: string | null
          outbound_opening?: string | null
          outbound_prompt?: string | null
          outbound_tone?: string | null
          outbound_vm_script?: string | null
          owner_name?: string | null
          pending_loop_suggestion?: Json | null
          previous_agent_voice_id?: string | null
          pricing_policy?: string | null
          seconds_used_this_month?: number | null
          selected_plan?: string | null
          service_catalog?: Json
          services_offered?: string | null
          settings_revision?: number
          setup_complete?: boolean | null
          slug: string
          sms_enabled?: boolean | null
          sms_template?: string | null
          staff_roster?: Json | null
          state?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_discount_name?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          system_prompt?: string
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          telegram_chat_id_2?: string | null
          telegram_notifications_enabled?: boolean | null
          telegram_registration_token?: string | null
          telegram_style?: string
          timezone?: string | null
          today_update?: string | null
          tools?: Json | null
          transfer_conditions?: string | null
          trial_converted?: boolean | null
          trial_expires_at?: string | null
          twilio_number?: string | null
          twilio_subaccount_sid?: string | null
          ultravox_agent_id?: string | null
          unknown_answer_behavior?: string | null
          updated_at?: string | null
          user_id?: string | null
          voice_style_preset?: string | null
          voicemail_greeting_audio_url?: string | null
          voicemail_greeting_text?: string | null
          website_knowledge_approved?: Json | null
          website_knowledge_preview?: Json | null
          website_last_scraped_at?: string | null
          website_scrape_error?: string | null
          website_scrape_pages?: Json | null
          website_scrape_status?: string | null
          website_url?: string | null
          weekly_digest_enabled?: boolean | null
        }
        Update: {
          activation_log?: Json | null
          active_prompt_version_id?: string | null
          after_hours_behavior?: string | null
          after_hours_emergency_phone?: string | null
          agent_mode?: string
          agent_name?: string | null
          agent_voice_id?: string | null
          bonus_minutes?: number
          booking_buffer_minutes?: number | null
          booking_enabled?: boolean | null
          booking_service_duration_minutes?: number | null
          business_facts?: string[] | null
          business_hours_weekday?: string | null
          business_hours_weekend?: string | null
          business_name?: string
          business_notes?: string | null
          calendar_auth_status?: string | null
          calendar_beta_enabled?: boolean | null
          calendar_mode?: string | null
          call_handling_mode?: string
          callback_phone?: string | null
          cancel_at?: string | null
          city?: string | null
          classification_rules?: string | null
          claude_knowledge_path?: string | null
          contact_email?: string | null
          context_data?: string | null
          context_data_label?: string | null
          created_at?: string | null
          effective_monthly_rate?: number | null
          email_notifications_enabled?: boolean | null
          extra_qa?: Json | null
          fields_to_collect?: string[] | null
          first_call_at?: string | null
          forwarding_number?: string | null
          gbp_photo_url?: string | null
          gbp_place_id?: string | null
          gbp_rating?: number | null
          gbp_review_count?: number | null
          gbp_summary?: string | null
          google_calendar_id?: string | null
          google_refresh_token?: string | null
          grace_period_end?: string | null
          hand_tuned?: boolean | null
          hours?: string | null
          id?: string
          injected_note?: string | null
          injected_note_expires_at?: string | null
          ivr_enabled?: boolean | null
          ivr_prompt?: string | null
          knowledge_backend?: string | null
          last_agent_sync_at?: string | null
          last_agent_sync_error?: string | null
          last_agent_sync_status?: string | null
          last_agent_synced_at?: string | null
          last_minute_reset_at?: string | null
          minute_warning_100_sent_at?: string | null
          minute_warning_80_sent_at?: string | null
          minutes_used_this_month?: number | null
          monthly_minute_limit?: number | null
          niche?: string | null
          niche_custom_variables?: Json | null
          outbound_goal?: string | null
          outbound_notes?: string | null
          outbound_opening?: string | null
          outbound_prompt?: string | null
          outbound_tone?: string | null
          outbound_vm_script?: string | null
          owner_name?: string | null
          pending_loop_suggestion?: Json | null
          previous_agent_voice_id?: string | null
          pricing_policy?: string | null
          seconds_used_this_month?: number | null
          selected_plan?: string | null
          service_catalog?: Json
          services_offered?: string | null
          settings_revision?: number
          setup_complete?: boolean | null
          slug?: string
          sms_enabled?: boolean | null
          sms_template?: string | null
          staff_roster?: Json | null
          state?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_discount_name?: string | null
          stripe_subscription_id?: string | null
          subscription_current_period_end?: string | null
          subscription_status?: string | null
          system_prompt?: string
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          telegram_chat_id_2?: string | null
          telegram_notifications_enabled?: boolean | null
          telegram_registration_token?: string | null
          telegram_style?: string
          timezone?: string | null
          today_update?: string | null
          tools?: Json | null
          transfer_conditions?: string | null
          trial_converted?: boolean | null
          trial_expires_at?: string | null
          twilio_number?: string | null
          twilio_subaccount_sid?: string | null
          ultravox_agent_id?: string | null
          unknown_answer_behavior?: string | null
          updated_at?: string | null
          user_id?: string | null
          voice_style_preset?: string | null
          voicemail_greeting_audio_url?: string | null
          voicemail_greeting_text?: string | null
          website_knowledge_approved?: Json | null
          website_knowledge_preview?: Json | null
          website_last_scraped_at?: string | null
          website_scrape_error?: string | null
          website_scrape_pages?: Json | null
          website_scrape_status?: string | null
          website_url?: string | null
          weekly_digest_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_active_prompt_version_id_fkey"
            columns: ["active_prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_messages: {
        Row: {
          call_log_id: string | null
          client_id: string
          created_at: string | null
          delivered_at: string | null
          id: string
          message: string
          status: string | null
          ultravox_call_id: string | null
        }
        Insert: {
          call_log_id?: string | null
          client_id: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          message: string
          status?: string | null
          ultravox_call_id?: string | null
        }
        Update: {
          call_log_id?: string | null
          client_id?: string
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          message?: string
          status?: string | null
          ultravox_call_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coaching_messages_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaching_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      compiler_runs: {
        Row: {
          approved_count: number
          chunk_count: number
          client_id: string
          conflicts: Json
          conflicts_dismissed: boolean
          created_at: string
          created_by_user_id: string | null
          faq_count: number
          high_risk_count: number
          id: string
          model_used: string
          raw_input_hash: string
          rejected_count: number
          total_extracted: number
        }
        Insert: {
          approved_count?: number
          chunk_count?: number
          client_id: string
          conflicts?: Json
          conflicts_dismissed?: boolean
          created_at?: string
          created_by_user_id?: string | null
          faq_count?: number
          high_risk_count?: number
          id?: string
          model_used: string
          raw_input_hash: string
          rejected_count?: number
          total_extracted?: number
        }
        Update: {
          approved_count?: number
          chunk_count?: number
          client_id?: string
          conflicts?: Json
          conflicts_dismissed?: boolean
          created_at?: string
          created_by_user_id?: string | null
          faq_count?: number
          high_risk_count?: number
          id?: string
          model_used?: string
          raw_input_hash?: string
          rejected_count?: number
          total_extracted?: number
        }
        Relationships: [
          {
            foreignKeyName: "compiler_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_calls: {
        Row: {
          caller_email: string | null
          caller_name: string | null
          caller_phone: string | null
          converted: boolean
          demo_id: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          in_call_sms_sent: boolean | null
          ip_hash: string | null
          source: string
          started_at: string
          ultravox_call_id: string | null
        }
        Insert: {
          caller_email?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          converted?: boolean
          demo_id: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          in_call_sms_sent?: boolean | null
          ip_hash?: string | null
          source: string
          started_at?: string
          ultravox_call_id?: string | null
        }
        Update: {
          caller_email?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          converted?: boolean
          demo_id?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          in_call_sms_sent?: boolean | null
          ip_hash?: string | null
          source?: string
          started_at?: string
          ultravox_call_id?: string | null
        }
        Relationships: []
      }
      demo_events: {
        Row: {
          created_at: string
          demo_call_id: string | null
          event_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          created_at?: string
          demo_call_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          created_at?: string
          demo_call_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_events_demo_call_id_fkey"
            columns: ["demo_call_id"]
            isOneToOne: false
            referencedRelation: "demo_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_submissions: {
        Row: {
          business_name: string
          client_id: string | null
          client_slug: string | null
          contact_email: string | null
          created_by_user_id: string | null
          generated_prompt: string | null
          id: string
          intake_json: Json
          niche: string | null
          owner_name: string | null
          progress_status: string | null
          status: string | null
          submitted_at: string | null
          supabase_user_id: string | null
          twilio_number: string | null
        }
        Insert: {
          business_name: string
          client_id?: string | null
          client_slug?: string | null
          contact_email?: string | null
          created_by_user_id?: string | null
          generated_prompt?: string | null
          id?: string
          intake_json: Json
          niche?: string | null
          owner_name?: string | null
          progress_status?: string | null
          status?: string | null
          submitted_at?: string | null
          supabase_user_id?: string | null
          twilio_number?: string | null
        }
        Update: {
          business_name?: string
          client_id?: string | null
          client_slug?: string | null
          contact_email?: string | null
          created_by_user_id?: string | null
          generated_prompt?: string | null
          id?: string
          intake_json?: Json
          niche?: string | null
          owner_name?: string | null
          progress_status?: string | null
          status?: string | null
          submitted_at?: string | null
          supabase_user_id?: string | null
          twilio_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_submissions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_type: string
          client_id: string
          compile_run_id: string | null
          content: string
          content_hash: string | null
          created_at: string | null
          embedding: string | null
          fts: unknown
          hit_count: number
          id: string
          last_hit_at: string | null
          metadata: Json | null
          source: string
          source_run_id: string | null
          source_url: string | null
          status: string | null
          trust_tier: string | null
          updated_at: string | null
        }
        Insert: {
          chunk_type: string
          client_id: string
          compile_run_id?: string | null
          content: string
          content_hash?: string | null
          created_at?: string | null
          embedding?: string | null
          fts?: unknown
          hit_count?: number
          id?: string
          last_hit_at?: string | null
          metadata?: Json | null
          source?: string
          source_run_id?: string | null
          source_url?: string | null
          status?: string | null
          trust_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          chunk_type?: string
          client_id?: string
          compile_run_id?: string | null
          content?: string
          content_hash?: string | null
          created_at?: string | null
          embedding?: string | null
          fts?: unknown
          hit_count?: number
          id?: string
          last_hit_at?: string | null
          metadata?: Json | null
          source?: string
          source_run_id?: string | null
          source_url?: string | null
          status?: string | null
          trust_tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_compile_run_id_fkey"
            columns: ["compile_run_id"]
            isOneToOne: false
            referencedRelation: "compiler_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_query_log: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          latency_ms: number
          query_embedding: string | null
          query_text: string
          resolution_type: string | null
          resolved_at: string | null
          result_count: number
          slug: string
          source: string | null
          threshold_used: number
          top_similarity: number | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          latency_ms: number
          query_embedding?: string | null
          query_text: string
          resolution_type?: string | null
          resolved_at?: string | null
          result_count?: number
          slug: string
          source?: string | null
          threshold_used: number
          top_similarity?: number | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          latency_ms?: number
          query_embedding?: string | null
          query_text?: string
          resolution_type?: string | null
          resolved_at?: string | null
          result_count?: number
          slug?: string
          source?: string | null
          threshold_used?: number
          top_similarity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_query_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_transcripts: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          prompt_snapshot: string | null
          transcript_json: Json
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          prompt_snapshot?: string | null
          transcript_json: Json
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          prompt_snapshot?: string | null
          transcript_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "lab_transcripts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          call_log_id: string | null
          caller_phone: string | null
          category: string
          client_id: string | null
          created_at: string | null
          created_by: string
          description: string
          entry_permission: boolean | null
          id: string
          notes: string[] | null
          preferred_access_window: string | null
          status: string
          tenant_name: string
          unit_number: string
          urgency_tier: string
        }
        Insert: {
          call_log_id?: string | null
          caller_phone?: string | null
          category: string
          client_id?: string | null
          created_at?: string | null
          created_by?: string
          description: string
          entry_permission?: boolean | null
          id?: string
          notes?: string[] | null
          preferred_access_window?: string | null
          status?: string
          tenant_name: string
          unit_number: string
          urgency_tier: string
        }
        Update: {
          call_log_id?: string | null
          caller_phone?: string | null
          category?: string
          client_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string
          entry_permission?: boolean | null
          id?: string
          notes?: string[] | null
          preferred_access_window?: string | null
          status?: string
          tenant_name?: string
          unit_number?: string
          urgency_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          call_id: string | null
          channel: string
          client_id: string
          content: string
          created_at: string
          error: string | null
          external_id: string | null
          id: string
          recipient: string
          status: string
        }
        Insert: {
          call_id?: string | null
          channel: string
          client_id: string
          content: string
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          recipient: string
          status?: string
        }
        Update: {
          call_id?: string | null
          channel?: string
          client_id?: string
          content?: string
          created_at?: string
          error?: string | null
          external_id?: string | null
          id?: string
          recipient?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      number_inventory: {
        Row: {
          area_code: string | null
          assigned_client_id: string | null
          country: string | null
          created_at: string | null
          id: string
          phone_number: string
          province: string | null
          reserved_at: string | null
          reserved_intake_id: string | null
          status: string | null
          twilio_sid: string
          updated_at: string | null
        }
        Insert: {
          area_code?: string | null
          assigned_client_id?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          phone_number: string
          province?: string | null
          reserved_at?: string | null
          reserved_intake_id?: string | null
          status?: string | null
          twilio_sid: string
          updated_at?: string | null
        }
        Update: {
          area_code?: string | null
          assigned_client_id?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          phone_number?: string
          province?: string | null
          reserved_at?: string | null
          reserved_intake_id?: string | null
          status?: string | null
          twilio_sid?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "number_inventory_assigned_client_id_fkey"
            columns: ["assigned_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_connect_tokens: {
        Row: {
          client_id: string | null
          created_at: string
          expires_at: string
          id: string
          join_url: string
          ultravox_call_id: string | null
          vm_script: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          join_url: string
          ultravox_call_id?: string | null
          vm_script?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          join_url?: string
          ultravox_call_id?: string | null
          vm_script?: string | null
        }
        Relationships: []
      }
      prompt_improvement_suggestions: {
        Row: {
          applied_at: string | null
          call_log_ids: string[]
          client_id: string
          created_at: string
          evidence_count: number
          id: string
          section_id: string
          status: string
          suggestion_text: string
          trigger_type: string
        }
        Insert: {
          applied_at?: string | null
          call_log_ids?: string[]
          client_id: string
          created_at?: string
          evidence_count?: number
          id?: string
          section_id: string
          status?: string
          suggestion_text: string
          trigger_type: string
        }
        Update: {
          applied_at?: string | null
          call_log_ids?: string[]
          client_id?: string
          created_at?: string
          evidence_count?: number
          id?: string
          section_id?: string
          status?: string
          suggestion_text?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_improvement_suggestions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          change_description: string | null
          char_count: number | null
          client_id: string
          content: string
          created_at: string | null
          deployed_at: string
          force_overrode_hand_tuned: boolean
          id: string
          is_active: boolean | null
          prev_char_count: number | null
          supabase_synced: boolean
          triggered_by_role: string | null
          triggered_by_user_id: string | null
          ultravox_synced: boolean
          version: number
          version_hash: string | null
        }
        Insert: {
          change_description?: string | null
          char_count?: number | null
          client_id: string
          content: string
          created_at?: string | null
          deployed_at?: string
          force_overrode_hand_tuned?: boolean
          id?: string
          is_active?: boolean | null
          prev_char_count?: number | null
          supabase_synced?: boolean
          triggered_by_role?: string | null
          triggered_by_user_id?: string | null
          ultravox_synced?: boolean
          version: number
          version_hash?: string | null
        }
        Update: {
          change_description?: string | null
          char_count?: number | null
          client_id?: string
          content?: string
          created_at?: string | null
          deployed_at?: string
          force_overrode_hand_tuned?: boolean
          id?: string
          is_active?: boolean | null
          prev_char_count?: number | null
          supabase_synced?: boolean
          triggered_by_role?: string | null
          triggered_by_user_id?: string | null
          ultravox_synced?: boolean
          version?: number
          version_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          attempted_at: string | null
          body: string | null
          client_id: string
          created_at: string | null
          delivery_error_code: string | null
          delivery_status: string | null
          direction: string
          error_code: string | null
          error_message: string | null
          from_number: string
          id: string
          message_sid: string
          opt_out: boolean | null
          provider_message_sid: string | null
          related_call_id: string | null
          status: string | null
          to_number: string
          updated_at: string | null
        }
        Insert: {
          attempted_at?: string | null
          body?: string | null
          client_id: string
          created_at?: string | null
          delivery_error_code?: string | null
          delivery_status?: string | null
          direction: string
          error_code?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          message_sid: string
          opt_out?: boolean | null
          provider_message_sid?: string | null
          related_call_id?: string | null
          status?: string | null
          to_number: string
          updated_at?: string | null
        }
        Update: {
          attempted_at?: string | null
          body?: string | null
          client_id?: string
          created_at?: string | null
          delivery_error_code?: string | null
          delivery_status?: string | null
          direction?: string
          error_code?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          message_sid?: string
          opt_out?: boolean | null
          provider_message_sid?: string | null
          related_call_id?: string | null
          status?: string | null
          to_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_related_call_id_fkey"
            columns: ["related_call_id"]
            isOneToOne: false
            referencedRelation: "call_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_opt_outs: {
        Row: {
          client_id: string
          id: string
          opted_back_in_at: string | null
          opted_out_at: string | null
          phone_number: string
          reason: string | null
        }
        Insert: {
          client_id: string
          id?: string
          opted_back_in_at?: string | null
          opted_out_at?: string | null
          phone_number: string
          reason?: string | null
        }
        Update: {
          client_id?: string
          id?: string
          opted_back_in_at?: string | null
          opted_out_at?: string | null
          phone_number?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_opt_outs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          event_id: string
          event_type: string
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          processed_at?: string
        }
        Relationships: []
      }
      suggestion_generation_lock: {
        Row: {
          client_id: string
          expires_at: string
          locked_at: string
        }
        Insert: {
          client_id: string
          expires_at?: string
          locked_at?: string
        }
        Update: {
          client_id?: string
          expires_at?: string
          locked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_generation_lock_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      test_runs: {
        Row: {
          client_id: string | null
          failed: number | null
          id: string
          passed: number | null
          ran_at: string | null
          results: Json | null
          total: number | null
          triggered_by: string | null
        }
        Insert: {
          client_id?: string | null
          failed?: number | null
          id?: string
          passed?: number | null
          ran_at?: string | null
          results?: Json | null
          total?: number | null
          triggered_by?: string | null
        }
        Update: {
          client_id?: string | null
          failed?: number | null
          id?: string
          passed?: number | null
          ran_at?: string | null
          results?: Json | null
          total?: number | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      test_scenarios: {
        Row: {
          caller_phone: string | null
          client_id: string | null
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          expected_status: string
          id: string
          name: string
          tags: string[] | null
          transcript: Json
          updated_at: string | null
        }
        Insert: {
          caller_phone?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          expected_status: string
          id?: string
          name: string
          tags?: string[] | null
          transcript: Json
          updated_at?: string | null
        }
        Update: {
          caller_phone?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          expected_status?: string
          id?: string
          name?: string
          tags?: string[] | null
          transcript?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "test_scenarios_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      agent_registry: {
        Row: {
          active_prompt_version_id: string | null
          agent_voice_id: string | null
          claude_knowledge_path: string | null
          client_slug: string | null
          status: string | null
          tools_config: Json | null
          twilio_number: string | null
          ultravox_agent_id: string | null
        }
        Insert: {
          active_prompt_version_id?: string | null
          agent_voice_id?: string | null
          claude_knowledge_path?: string | null
          client_slug?: string | null
          status?: string | null
          tools_config?: Json | null
          twilio_number?: string | null
          ultravox_agent_id?: string | null
        }
        Update: {
          active_prompt_version_id?: string | null
          agent_voice_id?: string | null
          claude_knowledge_path?: string | null
          client_slug?: string | null
          status?: string | null
          tools_config?: Json | null
          twilio_number?: string | null
          ultravox_agent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_active_prompt_version_id_fkey"
            columns: ["active_prompt_version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_advisor_credits: {
        Args: { p_amount_cents: number; p_user_id: string }
        Returns: undefined
      }
      auto_resolve_similar_gaps: {
        Args: {
          p_client_id: string
          p_max_resolve?: number
          p_query_embedding: string
          p_similarity_threshold?: number
          p_source_query: string
        }
        Returns: {
          resolved_count: number
          resolved_queries: string[]
        }[]
      }
      bump_knowledge_gap_priority: {
        Args: { p_client_id: string; p_topics: string[] }
        Returns: number
      }
      deduct_advisor_credits: {
        Args: { p_amount_cents: number; p_user_id: string }
        Returns: boolean
      }
      dial_out_update_lead: {
        Args: { p_lead_id: string; p_now: string }
        Returns: undefined
      }
      hybrid_match_knowledge: {
        Args: {
          full_text_weight?: number
          match_client_id: string
          match_count?: number
          query_embedding: string
          query_text: string
          rrf_k?: number
          semantic_weight?: number
        }
        Returns: {
          chunk_type: string
          content: string
          id: string
          keyword_rank: number
          metadata: Json
          rrf_score: number
          semantic_rank: number
          similarity: number
          source: string
          source_run_id: string
          status: string
          trust_tier: string
        }[]
      }
      increment_chunk_hits: {
        Args: { chunk_ids: string[] }
        Returns: undefined
      }
      increment_seconds_used: {
        Args: { p_client_id: string; p_seconds: number }
        Returns: undefined
      }
      match_knowledge: {
        Args: {
          match_client_id: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          chunk_type: string
          content: string
          id: string
          metadata: Json
          similarity: number
          source: string
          source_run_id: string
        }[]
      }
      try_preemptive_gap_resolve: {
        Args: {
          p_client_id: string
          p_query_embedding: string
          p_query_log_id: string
          p_similarity_threshold?: number
        }
        Returns: boolean
      }
      upsert_client_contact: {
        Args: {
          p_booked?: boolean
          p_call_status?: string
          p_caller_email?: string
          p_caller_name?: string
          p_client_id: string
          p_key_topics?: string[]
          p_phone: string
          p_sentiment?: string
          p_service_requested?: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
