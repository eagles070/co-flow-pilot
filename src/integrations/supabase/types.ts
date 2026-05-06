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
      activity_logs: {
        Row: {
          action: Database["public"]["Enums"]["activity_action"]
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["activity_action"]
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["activity_action"]
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      blacklist: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          phone: string
          reason: string | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          phone: string
          reason?: string | null
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          phone?: string
          reason?: string | null
        }
        Relationships: []
      }
      call_attempts: {
        Row: {
          agent_id: string
          created_at: string
          duration_seconds: number | null
          id: string
          note: string | null
          order_id: string
          outcome: Database["public"]["Enums"]["call_outcome"]
          recall_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          note?: string | null
          order_id: string
          outcome: Database["public"]["Enums"]["call_outcome"]
          recall_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          note?: string | null
          order_id?: string
          outcome?: Database["public"]["Enums"]["call_outcome"]
          recall_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_attempts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_flow: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          occurred_at: string
          source: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          occurred_at?: string
          source: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          occurred_at?: string
          source?: string
          type?: string
        }
        Relationships: []
      }
      cities: {
        Row: {
          ameex_city_id: string | null
          created_at: string
          delivery_cost: number
          id: string
          is_active: boolean
          name: string
          return_cost: number
          updated_at: string
        }
        Insert: {
          ameex_city_id?: string | null
          created_at?: string
          delivery_cost?: number
          id?: string
          is_active?: boolean
          name: string
          return_cost?: number
          updated_at?: string
        }
        Update: {
          ameex_city_id?: string | null
          created_at?: string
          delivery_cost?: number
          id?: string
          is_active?: boolean
          name?: string
          return_cost?: number
          updated_at?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          carrier: string
          created_at: string
          delivered_at: string | null
          id: string
          notes: string | null
          order_id: string
          picked_up_at: string | null
          provider_id: string | null
          return_cost: number
          returned_at: string | null
          shipping_cost: number
          status: Database["public"]["Enums"]["delivery_status"]
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          carrier?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          picked_up_at?: string | null
          provider_id?: string | null
          return_cost?: number
          returned_at?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["delivery_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          picked_up_at?: string | null
          provider_id?: string | null
          return_cost?: number
          returned_at?: string | null
          shipping_cost?: number
          status?: Database["public"]["Enums"]["delivery_status"]
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "delivery_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_providers: {
        Row: {
          api_id: string
          api_key: string
          base_url: string
          business_id: string | null
          created_at: string
          created_by: string | null
          id: string
          last_sync_at: string | null
          name: string
          provider_type: string
          status: string
          updated_at: string
          webhook_token: string
        }
        Insert: {
          api_id: string
          api_key: string
          base_url?: string
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_sync_at?: string | null
          name: string
          provider_type?: string
          status?: string
          updated_at?: string
          webhook_token: string
        }
        Update: {
          api_id?: string
          api_key?: string
          base_url?: string
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string
          provider_type?: string
          status?: string
          updated_at?: string
          webhook_token?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string | null
          description: string | null
          expense_date: string
          id: string
          product_id: string | null
          store_id: string | null
        }
        Insert: {
          amount: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          product_id?: string | null
          store_id?: string | null
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          product_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sheets_integrations: {
        Row: {
          access_token: string | null
          column_mapping: Json
          created_at: string
          created_by: string | null
          direction: string
          google_email: string | null
          id: string
          last_sync_at: string | null
          name: string
          refresh_token: string | null
          sheet_name: string
          spreadsheet_id: string
          status: string
          store_id: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          column_mapping?: Json
          created_at?: string
          created_by?: string | null
          direction?: string
          google_email?: string | null
          id?: string
          last_sync_at?: string | null
          name: string
          refresh_token?: string | null
          sheet_name?: string
          spreadsheet_id: string
          status?: string
          store_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          column_mapping?: Json
          created_at?: string
          created_by?: string | null
          direction?: string
          google_email?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string
          refresh_token?: string | null
          sheet_name?: string
          spreadsheet_id?: string
          status?: string
          store_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_sheets_integrations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_logs: {
        Row: {
          created_at: string
          direction: string
          endpoint: string | null
          error: string | null
          http_status: number | null
          id: string
          payload: Json | null
          provider_id: string | null
          provider_type: string
          status: string
        }
        Insert: {
          created_at?: string
          direction: string
          endpoint?: string | null
          error?: string | null
          http_status?: number | null
          id?: string
          payload?: Json | null
          provider_id?: string | null
          provider_type: string
          status?: string
        }
        Update: {
          created_at?: string
          direction?: string
          endpoint?: string | null
          error?: string | null
          http_status?: number | null
          id?: string
          payload?: Json | null
          provider_id?: string | null
          provider_type?: string
          status?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          alert_key: string
          email: boolean
          enabled: boolean
          id: string
          in_app: boolean
          threshold: number | null
          updated_at: string
        }
        Insert: {
          alert_key: string
          email?: boolean
          enabled?: boolean
          id?: string
          in_app?: boolean
          threshold?: number | null
          updated_at?: string
        }
        Update: {
          alert_key?: string
          email?: boolean
          enabled?: boolean
          id?: string
          in_app?: boolean
          threshold?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: string
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          agent_id: string | null
          attempts: number
          city: string | null
          comment_colis: string | null
          confirmed_at: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          customer_phone_alt: string | null
          delivered_at: string | null
          delivery_cost: number
          discount_amount: number
          external_order_id: string | null
          extra_amount: number
          id: string
          notes: string | null
          reference: string
          region: string | null
          returned_at: string | null
          shipped_at: string | null
          shipping_address: string | null
          source: Database["public"]["Enums"]["order_source"]
          status: Database["public"]["Enums"]["order_status"]
          store_id: string | null
          total_amount: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          attempts?: number
          city?: string | null
          comment_colis?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          customer_phone_alt?: string | null
          delivered_at?: string | null
          delivery_cost?: number
          discount_amount?: number
          external_order_id?: string | null
          extra_amount?: number
          id?: string
          notes?: string | null
          reference?: string
          region?: string | null
          returned_at?: string | null
          shipped_at?: string | null
          shipping_address?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          attempts?: number
          city?: string | null
          comment_colis?: string | null
          confirmed_at?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          customer_phone_alt?: string | null
          delivered_at?: string | null
          delivery_cost?: number
          discount_amount?: number
          external_order_id?: string | null
          extra_amount?: number
          id?: string
          notes?: string | null
          reference?: string
          region?: string | null
          returned_at?: string | null
          shipped_at?: string | null
          shipping_address?: string | null
          source?: Database["public"]["Enums"]["order_source"]
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          cost_price: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          lead_time_days: number | null
          low_stock_threshold: number | null
          name: string
          sell_price: number
          sku: string | null
          sku_ameex: string | null
          stock: number
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          lead_time_days?: number | null
          low_stock_threshold?: number | null
          name: string
          sell_price?: number
          sku?: string | null
          sku_ameex?: string | null
          stock?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          lead_time_days?: number | null
          low_stock_threshold?: number | null
          name?: string
          sell_price?: number
          sku?: string | null
          sku_ameex?: string | null
          stock?: number
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          max_concurrent_orders: number | null
          max_orders_per_day: number | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          last_login_at?: string | null
          max_concurrent_orders?: number | null
          max_orders_per_day?: number | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          max_concurrent_orders?: number | null
          max_orders_per_day?: number | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_paid: number
          converted_to_product_id: string | null
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          notes: string | null
          product_id: string | null
          product_name: string | null
          purchase_date: string
          quantity: number
          status: Database["public"]["Enums"]["purchase_status"]
          stock_applied: boolean
          supplier_id: string | null
          total_cost: number
          transport_type: Database["public"]["Enums"]["transport_type"]
          unit_cost: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          converted_to_product_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          purchase_date?: string
          quantity: number
          status?: Database["public"]["Enums"]["purchase_status"]
          stock_applied?: boolean
          supplier_id?: string | null
          total_cost?: number
          transport_type?: Database["public"]["Enums"]["transport_type"]
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          converted_to_product_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          product_id?: string | null
          product_name?: string | null
          purchase_date?: string
          quantity?: number
          status?: Database["public"]["Enums"]["purchase_status"]
          stock_applied?: boolean
          supplier_id?: string | null
          total_cost?: number
          transport_type?: Database["public"]["Enums"]["transport_type"]
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_converted_to_product_id_fkey"
            columns: ["converted_to_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_stores: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          id: string
          last_sync_at: string | null
          name: string
          status: string
          store_id: string | null
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          id?: string
          last_sync_at?: string | null
          name: string
          status?: string
          store_id?: string | null
          updated_at?: string
          webhook_secret: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          id?: string
          last_sync_at?: string | null
          name?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopify_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      status_configs: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string | null
          product_id: string
          quantity: number
          reference: string | null
          supplier_id: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          product_id: string
          quantity: number
          reference?: string | null
          supplier_id?: string | null
          type: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string | null
          product_id?: string
          quantity?: number
          reference?: string | null
          supplier_id?: string | null
          type?: Database["public"]["Enums"]["stock_movement_type"]
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          external_id: string | null
          id: string
          is_active: boolean
          name: string
          owner_id: string | null
          type: Database["public"]["Enums"]["store_type"]
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          owner_id?: string | null
          type?: Database["public"]["Enums"]["store_type"]
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          external_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string | null
          type?: Database["public"]["Enums"]["store_type"]
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_action:
        | "create"
        | "update"
        | "delete"
        | "assign"
        | "status_change"
        | "login"
        | "export"
        | "import"
      app_role: "admin" | "moderator" | "agent" | "media_buyer"
      call_outcome:
        | "confirmed"
        | "cancelled"
        | "no_reply"
        | "wrong_number"
        | "postponed"
        | "duplicate"
        | "callback_requested"
        | "voicemail"
      delivery_status:
        | "pending"
        | "picked_up"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "returned"
        | "refused"
        | "lost"
      expense_category:
        | "ads"
        | "salaries"
        | "rent"
        | "shipping"
        | "inventory"
        | "tools"
        | "other"
      order_source: "shopify" | "google_sheet" | "manual" | "landing_page"
      order_status:
        | "new"
        | "assigned"
        | "confirmed"
        | "no_reply"
        | "cancelled"
        | "duplicate"
        | "shipped"
        | "in_transit"
        | "delivered"
        | "returned"
        | "refused"
        | "postponed"
      purchase_status: "ordered" | "in_transit" | "received"
      stock_movement_type:
        | "purchase"
        | "sale"
        | "return"
        | "adjustment"
        | "damaged"
      store_type: "shopify" | "google_sheet" | "manual"
      transport_type: "air" | "sea" | "other"
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
      activity_action: [
        "create",
        "update",
        "delete",
        "assign",
        "status_change",
        "login",
        "export",
        "import",
      ],
      app_role: ["admin", "moderator", "agent", "media_buyer"],
      call_outcome: [
        "confirmed",
        "cancelled",
        "no_reply",
        "wrong_number",
        "postponed",
        "duplicate",
        "callback_requested",
        "voicemail",
      ],
      delivery_status: [
        "pending",
        "picked_up",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "returned",
        "refused",
        "lost",
      ],
      expense_category: [
        "ads",
        "salaries",
        "rent",
        "shipping",
        "inventory",
        "tools",
        "other",
      ],
      order_source: ["shopify", "google_sheet", "manual", "landing_page"],
      order_status: [
        "new",
        "assigned",
        "confirmed",
        "no_reply",
        "cancelled",
        "duplicate",
        "shipped",
        "in_transit",
        "delivered",
        "returned",
        "refused",
        "postponed",
      ],
      purchase_status: ["ordered", "in_transit", "received"],
      stock_movement_type: [
        "purchase",
        "sale",
        "return",
        "adjustment",
        "damaged",
      ],
      store_type: ["shopify", "google_sheet", "manual"],
      transport_type: ["air", "sea", "other"],
    },
  },
} as const
