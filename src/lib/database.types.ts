
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "demo_mode": boolean,"id": number,"payment_window_minutes": number,"seller_fee": number,"service_fee": number,"sold_out_response_minutes": number,"updated_at": string,"vapid_public_key": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "demo_mode"?: boolean,"id"?: number,"payment_window_minutes"?: number,"seller_fee"?: number,"service_fee"?: number,"sold_out_response_minutes"?: number,"updated_at"?: string,"vapid_public_key"?: string | null
                  }
                  Update: {
                    "demo_mode"?: boolean,"id"?: number,"payment_window_minutes"?: number,"seller_fee"?: number,"service_fee"?: number,"sold_out_response_minutes"?: number,"updated_at"?: string,"vapid_public_key"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": NonNullable<Json>,"id": number,"target_id": string | null,"target_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: NonNullable<Json>,"id"?: never,"target_id"?: string | null,"target_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_log_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"daily_counters": {
                  Row: {
                    "last_number": number,"orders_count": number,"pickup_date": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "last_number"?: number,"orders_count"?: number,"pickup_date": string,"tenant_id": string
                  }
                  Update: {
                    "last_number"?: number,"orders_count"?: number,"pickup_date"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_counters_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_categories": {
                  Row: {
                    "id": string,"is_active": boolean,"name": string,"sort_order": number,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"is_active"?: boolean,"name": string,"sort_order"?: number,"tenant_id": string
                  }
                  Update: {
                    "id"?: string,"is_active"?: boolean,"name"?: string,"sort_order"?: number,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_categories_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"menu_items": {
                  Row: {
                    "category_id": string | null,"created_at": string,"daily_stock": number | null,"description": string | null,"id": string,"is_active": boolean,"name": string,"photo_path": string | null,"prep_minutes": number,"price": number,"sold_out_date": string | null,"sold_out_indefinite": boolean,"sort_order": number,"tags": (string)[],"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category_id"?: string | null,"created_at"?: string,"daily_stock"?: number | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name": string,"photo_path"?: string | null,"prep_minutes": number,"price": number,"sold_out_date"?: string | null,"sold_out_indefinite"?: boolean,"sort_order"?: number,"tags"?: (string)[],"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"created_at"?: string,"daily_stock"?: number | null,"description"?: string | null,"id"?: string,"is_active"?: boolean,"name"?: string,"photo_path"?: string | null,"prep_minutes"?: number,"price"?: number,"sold_out_date"?: string | null,"sold_out_indefinite"?: boolean,"sort_order"?: number,"tags"?: (string)[],"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "menu_items_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "menu_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "menu_items_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"deliver_after": string | null,"id": string,"kind": string,"params": NonNullable<Json>,"push_status": string,"read_at": string | null,"url": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deliver_after"?: string | null,"id"?: string,"kind": string,"params"?: NonNullable<Json>,"push_status"?: string,"read_at"?: string | null,"url"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"deliver_after"?: string | null,"id"?: string,"kind"?: string,"params"?: NonNullable<Json>,"push_status"?: string,"read_at"?: string | null,"url"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"option_groups": {
                  Row: {
                    "id": string,"item_id": string,"max_select": number,"min_select": number,"name": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"item_id": string,"max_select"?: number,"min_select"?: number,"name": string,"sort_order"?: number
                  }
                  Update: {
                    "id"?: string,"item_id"?: string,"max_select"?: number,"min_select"?: number,"name"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "option_groups_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    }
                  ]
                },"options": {
                  Row: {
                    "group_id": string,"id": string,"is_active": boolean,"name": string,"price_delta": number,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"is_active"?: boolean,"name": string,"price_delta"?: number,"sort_order"?: number
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"is_active"?: boolean,"name"?: string,"price_delta"?: number,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "options_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "option_groups"
      referencedColumns: ["id"]
    }
                  ]
                },"order_items": {
                  Row: {
                    "created_at": string,"id": string,"line_total": number,"menu_item_id": string | null,"name": string,"options": NonNullable<Json>,"order_id": string,"prep_minutes": number,"quantity": number,"refunded_amount": number,"replaces_item_id": string | null,"resolution_deadline": string | null,"sold_out_flagged_at": string | null,"status": Database["public"]['Enums']["status_item"],"unit_price": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"line_total": number,"menu_item_id"?: string | null,"name": string,"options"?: NonNullable<Json>,"order_id": string,"prep_minutes"?: number,"quantity": number,"refunded_amount"?: number,"replaces_item_id"?: string | null,"resolution_deadline"?: string | null,"sold_out_flagged_at"?: string | null,"status"?: Database["public"]['Enums']["status_item"],"unit_price": number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"line_total"?: number,"menu_item_id"?: string | null,"name"?: string,"options"?: NonNullable<Json>,"order_id"?: string,"prep_minutes"?: number,"quantity"?: number,"refunded_amount"?: number,"replaces_item_id"?: string | null,"resolution_deadline"?: string | null,"sold_out_flagged_at"?: string | null,"status"?: Database["public"]['Enums']["status_item"],"unit_price"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_items_menu_item_id_fkey"
      columns: ["menu_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_items_replaces_item_id_fkey"
      columns: ["replaces_item_id"]
isOneToOne: false
      referencedRelation: "order_items"
      referencedColumns: ["id"]
    }
                  ]
                },"order_messages": {
                  Row: {
                    "body": string,"created_at": string,"from_tenant": boolean,"id": string,"order_id": string,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"from_tenant": boolean,"id"?: string,"order_id": string,"sender_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"from_tenant"?: boolean,"id"?: string,"order_id"?: string,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "order_messages_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "order_messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"orders": {
                  Row: {
                    "buyer_id": string,"buyer_name": string,"buyer_whatsapp": string | null,"cancelled_at": string | null,"cancelled_by": string | null,"completed_at": string | null,"completed_by": string | null,"created_at": string,"cutlery": boolean,"dining": Database["public"]['Enums']["cara_makan"],"end_reason": string | null,"id": string,"is_sample": boolean,"jaminin_fee_returned": boolean,"max_prep_minutes": number,"needs_buyer_action": boolean,"not_ready_notified_at": string | null,"note": string | null,"order_number": number | null,"original_pickup_at": string | null,"paid_at": string | null,"pay_deadline": string,"payment_code": string,"payout_id": string | null,"pickup_at": string,"pickup_code": string | null,"pickup_date": string,"pickup_name": string,"pickup_time": string,"preparing_at": string | null,"promo_discount": number,"promo_id": string | null,"ready_at": string | null,"refunded_total": number,"reminder_sent_at": string | null,"rescheduled_count": number,"seller_fee": number,"service_fee": number,"status": Database["public"]['Enums']["status_pesanan"],"subtotal": number,"tenant_id": string,"total_paid": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"buyer_name": string,"buyer_whatsapp"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"cutlery"?: boolean,"dining": Database["public"]['Enums']["cara_makan"],"end_reason"?: string | null,"id"?: string,"is_sample"?: boolean,"jaminin_fee_returned"?: boolean,"max_prep_minutes"?: number,"needs_buyer_action"?: boolean,"not_ready_notified_at"?: string | null,"note"?: string | null,"order_number"?: number | null,"original_pickup_at"?: string | null,"paid_at"?: string | null,"pay_deadline": string,"payment_code": string,"payout_id"?: string | null,"pickup_at": string,"pickup_code"?: string | null,"pickup_date": string,"pickup_name": string,"pickup_time": string,"preparing_at"?: string | null,"promo_discount"?: number,"promo_id"?: string | null,"ready_at"?: string | null,"refunded_total"?: number,"reminder_sent_at"?: string | null,"rescheduled_count"?: number,"seller_fee": number,"service_fee": number,"status"?: Database["public"]['Enums']["status_pesanan"],"subtotal": number,"tenant_id": string,"total_paid": number,"updated_at"?: string
                  }
                  Update: {
                    "buyer_id"?: string,"buyer_name"?: string,"buyer_whatsapp"?: string | null,"cancelled_at"?: string | null,"cancelled_by"?: string | null,"completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"cutlery"?: boolean,"dining"?: Database["public"]['Enums']["cara_makan"],"end_reason"?: string | null,"id"?: string,"is_sample"?: boolean,"jaminin_fee_returned"?: boolean,"max_prep_minutes"?: number,"needs_buyer_action"?: boolean,"not_ready_notified_at"?: string | null,"note"?: string | null,"order_number"?: number | null,"original_pickup_at"?: string | null,"paid_at"?: string | null,"pay_deadline"?: string,"payment_code"?: string,"payout_id"?: string | null,"pickup_at"?: string,"pickup_code"?: string | null,"pickup_date"?: string,"pickup_name"?: string,"pickup_time"?: string,"preparing_at"?: string | null,"promo_discount"?: number,"promo_id"?: string | null,"ready_at"?: string | null,"refunded_total"?: number,"reminder_sent_at"?: string | null,"rescheduled_count"?: number,"seller_fee"?: number,"service_fee"?: number,"status"?: Database["public"]['Enums']["status_pesanan"],"subtotal"?: number,"tenant_id"?: string,"total_paid"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "orders_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_payout_fk"
      columns: ["payout_id"]
isOneToOne: false
      referencedRelation: "payouts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_promo_id_fkey"
      columns: ["promo_id"]
isOneToOne: false
      referencedRelation: "promos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "orders_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount": number,"code": string,"created_at": string,"order_id": string,"paid_at": string | null,"provider": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"code": string,"created_at"?: string,"order_id": string,"paid_at"?: string | null,"provider"?: string,"status"?: string
                  }
                  Update: {
                    "amount"?: number,"code"?: string,"created_at"?: string,"order_id"?: string,"paid_at"?: string | null,"provider"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"payouts": {
                  Row: {
                    "account_holder": string | null,"account_number": string | null,"amount": number,"bank_name": string | null,"gross_sales": number,"id": string,"is_sample": boolean,"orders_count": number,"payout_date": string,"promo_total": number,"refunds_charged": number,"seller_fee_total": number,"sent_at": string,"status": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_holder"?: string | null,"account_number"?: string | null,"amount": number,"bank_name"?: string | null,"gross_sales": number,"id"?: string,"is_sample"?: boolean,"orders_count": number,"payout_date": string,"promo_total": number,"refunds_charged": number,"seller_fee_total": number,"sent_at"?: string,"status"?: string,"tenant_id": string
                  }
                  Update: {
                    "account_holder"?: string | null,"account_number"?: string | null,"amount"?: number,"bank_name"?: string | null,"gross_sales"?: number,"id"?: string,"is_sample"?: boolean,"orders_count"?: number,"payout_date"?: string,"promo_total"?: number,"refunds_charged"?: number,"seller_fee_total"?: number,"sent_at"?: string,"status"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "payouts_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"is_demo": boolean,"is_suspended": boolean,"language": string,"profile_completed_at": string | null,"reminder_minutes": number,"status": Database["public"]['Enums']["status_pengguna"] | null,"updated_at": string,"whatsapp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string,"id": string,"is_demo"?: boolean,"is_suspended"?: boolean,"language"?: string,"profile_completed_at"?: string | null,"reminder_minutes"?: number,"status"?: Database["public"]['Enums']["status_pengguna"] | null,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"is_demo"?: boolean,"is_suspended"?: boolean,"language"?: string,"profile_completed_at"?: string | null,"reminder_minutes"?: number,"status"?: Database["public"]['Enums']["status_pengguna"] | null,"updated_at"?: string,"whatsapp"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"promos": {
                  Row: {
                    "created_at": string,"end_time": string,"id": string,"is_active": boolean,"kind": Database["public"]['Enums']["jenis_promo"],"start_time": string,"tenant_id": string,"value": number,"weekdays": (number)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_time": string,"id"?: string,"is_active"?: boolean,"kind": Database["public"]['Enums']["jenis_promo"],"start_time": string,"tenant_id": string,"value": number,"weekdays": (number)[]
                  }
                  Update: {
                    "created_at"?: string,"end_time"?: string,"id"?: string,"is_active"?: boolean,"kind"?: Database["public"]['Enums']["jenis_promo"],"start_time"?: string,"tenant_id"?: string,"value"?: number,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "promos_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"user_agent"?: string | null,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ratings": {
                  Row: {
                    "buyer_id": string,"comment": string | null,"created_at": string,"order_id": string,"tenant_id": string,"thumbs_up": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"comment"?: string | null,"created_at"?: string,"order_id": string,"tenant_id": string,"thumbs_up": boolean
                  }
                  Update: {
                    "buyer_id"?: string,"comment"?: string | null,"created_at"?: string,"order_id"?: string,"tenant_id"?: string,"thumbs_up"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "ratings_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ratings_order_id_fkey"
      columns: ["order_id"]
isOneToOne: true
      referencedRelation: "orders"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ratings_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"refunds": {
                  Row: {
                    "amount": number,"bearer": Database["public"]['Enums']["penanggung"],"charged_payout_id": string | null,"created_at": string,"created_by": string | null,"id": string,"is_manual": boolean,"jaminin_charge": number,"kind": string,"order_id": string,"reason_code": string,"reason_text": string | null,"status": string,"tenant_charge": number
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"bearer": Database["public"]['Enums']["penanggung"],"charged_payout_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_manual"?: boolean,"jaminin_charge"?: number,"kind": string,"order_id": string,"reason_code": string,"reason_text"?: string | null,"status"?: string,"tenant_charge"?: number
                  }
                  Update: {
                    "amount"?: number,"bearer"?: Database["public"]['Enums']["penanggung"],"charged_payout_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"is_manual"?: boolean,"jaminin_charge"?: number,"kind"?: string,"order_id"?: string,"reason_code"?: string,"reason_text"?: string | null,"status"?: string,"tenant_charge"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "refunds_charged_payout_id_fkey"
      columns: ["charged_payout_id"]
isOneToOne: false
      referencedRelation: "payouts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "refunds_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"report_replies": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"report_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"report_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"report_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "report_replies_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "report_replies_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "buyer_id": string,"category": Database["public"]['Enums']["kategori_laporan"],"created_at": string,"id": string,"order_id": string,"photo_path": string | null,"status": Database["public"]['Enums']["status_laporan"],"story": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "buyer_id": string,"category": Database["public"]['Enums']["kategori_laporan"],"created_at"?: string,"id"?: string,"order_id": string,"photo_path"?: string | null,"status"?: Database["public"]['Enums']["status_laporan"],"story": string,"updated_at"?: string
                  }
                  Update: {
                    "buyer_id"?: string,"category"?: Database["public"]['Enums']["kategori_laporan"],"created_at"?: string,"id"?: string,"order_id"?: string,"photo_path"?: string | null,"status"?: Database["public"]['Enums']["status_laporan"],"story"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_buyer_id_fkey"
      columns: ["buyer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_order_id_fkey"
      columns: ["order_id"]
isOneToOne: false
      referencedRelation: "orders"
      referencedColumns: ["id"]
    }
                  ]
                },"slot_usage": {
                  Row: {
                    "pickup_date": string,"pickup_time": string,"tenant_id": string,"used": number
                  }
                  ComputedFields: never
                  Insert: {
                    "pickup_date": string,"pickup_time": string,"tenant_id": string,"used"?: number
                  }
                  Update: {
                    "pickup_date"?: string,"pickup_time"?: string,"tenant_id"?: string,"used"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "slot_usage_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"stock_usage": {
                  Row: {
                    "menu_item_id": string,"pickup_date": string,"used": number
                  }
                  ComputedFields: never
                  Insert: {
                    "menu_item_id": string,"pickup_date": string,"used"?: number
                  }
                  Update: {
                    "menu_item_id"?: string,"pickup_date"?: string,"used"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "stock_usage_menu_item_id_fkey"
      columns: ["menu_item_id"]
isOneToOne: false
      referencedRelation: "menu_items"
      referencedColumns: ["id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "added_by": string | null,"created_at": string,"role": Database["public"]['Enums']["peran_tim"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"created_at"?: string,"role": Database["public"]['Enums']["peran_tim"],"user_id": string
                  }
                  Update: {
                    "added_by"?: string | null,"created_at"?: string,"role"?: Database["public"]['Enums']["peran_tim"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_bank": {
                  Row: {
                    "account_holder": string,"account_number": string,"bank_name": string,"tenant_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_holder": string,"account_number": string,"bank_name": string,"tenant_id": string,"updated_at"?: string
                  }
                  Update: {
                    "account_holder"?: string,"account_number"?: string,"bank_name"?: string,"tenant_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_bank_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: true
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_day_closings": {
                  Row: {
                    "closed_at": string,"date": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string,"date": string,"tenant_id": string
                  }
                  Update: {
                    "closed_at"?: string,"date"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_day_closings_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_hours": {
                  Row: {
                    "close_time": string,"id": string,"open_time": string,"tenant_id": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "close_time": string,"id"?: string,"open_time": string,"tenant_id": string,"weekday": number
                  }
                  Update: {
                    "close_time"?: string,"id"?: string,"open_time"?: string,"tenant_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_hours_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_members": {
                  Row: {
                    "created_at": string,"role": Database["public"]['Enums']["peran_tenant"],"tenant_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": Database["public"]['Enums']["peran_tenant"],"tenant_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: Database["public"]['Enums']["peran_tenant"],"tenant_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_members_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tenant_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_quota_rules": {
                  Row: {
                    "end_time": string,"id": string,"quota": number,"start_time": string,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "end_time": string,"id"?: string,"quota": number,"start_time": string,"tenant_id": string
                  }
                  Update: {
                    "end_time"?: string,"id"?: string,"quota"?: number,"start_time"?: string,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_quota_rules_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenant_special_hours": {
                  Row: {
                    "close_time": string | null,"date": string,"id": string,"is_closed": boolean,"note": string | null,"open_time": string | null,"tenant_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "close_time"?: string | null,"date": string,"id"?: string,"is_closed"?: boolean,"note"?: string | null,"open_time"?: string | null,"tenant_id": string
                  }
                  Update: {
                    "close_time"?: string | null,"date"?: string,"id"?: string,"is_closed"?: boolean,"note"?: string | null,"open_time"?: string | null,"tenant_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenant_special_hours_tenant_id_fkey"
      columns: ["tenant_id"]
isOneToOne: false
      referencedRelation: "tenants"
      referencedColumns: ["id"]
    }
                  ]
                },"tenants": {
                  Row: {
                    "announcement": string | null,"base_quota": number,"contact_person": string,"created_at": string,"created_by": string | null,"daily_order_limit": number | null,"description": string | null,"id": string,"is_sample": boolean,"kiosk_location": string,"logo_path": string | null,"managed_by": Database["public"]['Enums']["pengelola_tenant"],"manager_name": string | null,"name": string,"order_cutoff_minutes": number,"paused_indefinitely": boolean,"paused_until": string | null,"payout_time": string | null,"reject_reason": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"slug": string,"status": Database["public"]['Enums']["status_tenant"],"submitted_at": string | null,"terms_accepted_at": string | null,"type": Database["public"]['Enums']["jenis_tenant"],"updated_at": string,"whatsapp": string
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement"?: string | null,"base_quota": number,"contact_person": string,"created_at"?: string,"created_by"?: string | null,"daily_order_limit"?: number | null,"description"?: string | null,"id"?: string,"is_sample"?: boolean,"kiosk_location": string,"logo_path"?: string | null,"managed_by"?: Database["public"]['Enums']["pengelola_tenant"],"manager_name"?: string | null,"name": string,"order_cutoff_minutes"?: number,"paused_indefinitely"?: boolean,"paused_until"?: string | null,"payout_time"?: string | null,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"slug": string,"status"?: Database["public"]['Enums']["status_tenant"],"submitted_at"?: string | null,"terms_accepted_at"?: string | null,"type": Database["public"]['Enums']["jenis_tenant"],"updated_at"?: string,"whatsapp": string
                  }
                  Update: {
                    "announcement"?: string | null,"base_quota"?: number,"contact_person"?: string,"created_at"?: string,"created_by"?: string | null,"daily_order_limit"?: number | null,"description"?: string | null,"id"?: string,"is_sample"?: boolean,"kiosk_location"?: string,"logo_path"?: string | null,"managed_by"?: Database["public"]['Enums']["pengelola_tenant"],"manager_name"?: string | null,"name"?: string,"order_cutoff_minutes"?: number,"paused_indefinitely"?: boolean,"paused_until"?: string | null,"payout_time"?: string | null,"reject_reason"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"slug"?: string,"status"?: Database["public"]['Enums']["status_tenant"],"submitted_at"?: string | null,"terms_accepted_at"?: string | null,"type"?: Database["public"]['Enums']["jenis_tenant"],"updated_at"?: string,"whatsapp"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tenants_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tenants_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_delete_sample_data":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"admin_update_fees":
{ Args: { "p_seller_fee": number,"p_service_fee": number }; Returns: undefined
                           },
"buyer_cancel_order":
{ Args: { "p_order": string }; Returns: undefined
                           },
"buyer_confirm_received":
{ Args: { "p_order": string }; Returns: undefined
                           },
"buyer_rate_order":
{ Args: { "p_comment": string,"p_order": string,"p_thumbs_up": boolean }; Returns: undefined
                           },
"buyer_reschedule_order":
{ Args: { "p_date": string,"p_order": string,"p_time": string }; Returns: undefined
                           },
"buyer_resolve_sold_out":
{ Args: { "p_action": string,"p_option_ids"?: Json,"p_order_item": string,"p_replacement"?: string }; Returns: undefined
                           },
"create_order":
{ Args: { "p_cutlery": boolean,"p_dining": Database["public"]['Enums']["cara_makan"],"p_items": Json,"p_note": string,"p_pickup_date": string,"p_pickup_name": string,"p_pickup_time": string,"p_tenant": string }; Returns: {
              "order_id": string,"pay_deadline": string,"payment_code": string,"total_paid": number
            }[]
                           },
"demo_panel":
{ Args: Record<PropertyKey, never>; Returns: {
              "demo_role": string,"email": string,"full_name": string,"user_id": string
            }[]
                           },
"demo_reset":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"demo_set_mode":
{ Args: { "p_on": boolean }; Returns: undefined
                           },
"get_slots":
{ Args: { "p_date": string,"p_max_prep": number,"p_tenant": string }; Returns: {
              "promo_id": string,"promo_kind": Database["public"]['Enums']["jenis_promo"],"promo_value": number,"quota": number,"remaining": number,"slot_time": string,"status": string
            }[]
                           },
"home_tenants":
{ Args: Record<PropertyKey, never>; Returns: {
              "announcement": string,"description": string,"earliest_date": string,"earliest_time": string,"fastest_prep": number,"id": string,"is_sample": boolean,"kiosk_location": string,"logo_path": string,"name": string,"open_now": boolean,"paused": boolean,"slug": string,"today_ranges": Json
            }[]
                           },
"internal_confirm_payment":
{ Args: { "p_code": string }; Returns: Json
                           },
"internal_push_payload":
{ Args: { "p_notification": string,"p_secret": string }; Returns: Json
                           },
"internal_push_result":
{ Args: { "p_gone_ids": (string)[],"p_notification": string,"p_secret": string,"p_status": string }; Returns: undefined
                           },
"internal_secret_check":
{ Args: { "p_secret": string }; Returns: boolean
                           },
"internal_set_vapid":
{ Args: { "p_keys_json": string,"p_public": string }; Returns: boolean
                           },
"my_tenants":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"name": string,"reject_reason": string,"role": Database["public"]['Enums']["peran_tenant"],"slug": string,"status": Database["public"]['Enums']["status_tenant"]
            }[]
                           },
"owner_clear_special_day":
{ Args: { "p_date": string,"p_tenant": string }; Returns: undefined
                           },
"owner_set_hours":
{ Args: { "p_hours": Json,"p_tenant": string }; Returns: undefined
                           },
"owner_set_quota_rules":
{ Args: { "p_rules": Json,"p_tenant": string }; Returns: undefined
                           },
"owner_set_special_day":
{ Args: { "p_closed": boolean,"p_date": string,"p_note": string,"p_ranges": Json,"p_tenant": string }; Returns: number
                           },
"owner_special_day_preview":
{ Args: { "p_closed": boolean,"p_date": string,"p_ranges": Json,"p_tenant": string }; Returns: number
                           },
"payout_details":
{ Args: { "p_payout": string }; Returns: Json
                           },
"register_tenant":
{ Args: { "p": Json }; Returns: string
                           },
"resubmit_tenant":
{ Args: { "p_tenant": string }; Returns: undefined
                           },
"save_push_subscription":
{ Args: { "p_auth": string,"p_endpoint": string,"p_p256dh": string,"p_user_agent": string }; Returns: undefined
                           },
"seller_buyer_history":
{ Args: { "p_buyer": string,"p_tenant": string }; Returns: {
              "cancelled": number,"completed": number,"not_picked_up": number
            }[]
                           },
"seller_find_by_code":
{ Args: { "p_code": string,"p_tenant": string }; Returns: string
                           },
"seller_flag_item_sold_out":
{ Args: { "p_order_item": string }; Returns: undefined
                           },
"seller_handover":
{ Args: { "p_code": string,"p_order": string }; Returns: undefined
                           },
"seller_pause":
{ Args: { "p_minutes": number,"p_tenant": string }; Returns: undefined
                           },
"seller_set_menu_availability":
{ Args: { "p_item": string,"p_mode": string }; Returns: {
              "order_id": string,"order_item_id": string,"order_number": number,"pickup_date": string,"pickup_time": string,"quantity": number
            }[]
                           },
"seller_update_slot":
{ Args: { "p_date": string,"p_status": Database["public"]['Enums']["status_pesanan"],"p_tenant": string,"p_time": string }; Returns: number
                           },
"seller_update_status":
{ Args: { "p_order": string,"p_status": Database["public"]['Enums']["status_pesanan"] }; Returns: undefined
                           },
"send_order_message":
{ Args: { "p_body": string,"p_order": string }; Returns: string
                           },
"slot_status_all":
{ Args: { "p_date": string,"p_time": string }; Returns: {
              "remaining": number,"status": string,"tenant_id": string
            }[]
                           },
"team_add_member":
{ Args: { "p_email": string,"p_role": Database["public"]['Enums']["peran_tim"] }; Returns: undefined
                           },
"team_cancel_order":
{ Args: { "p_order": string,"p_reason": string }; Returns: undefined
                           },
"team_dashboard":
{ Args: { "p_days"?: number }; Returns: {
              "active_tenants": number,"cancelled": number,"day": string,"gross": number,"is_sample": boolean,"jaminin_revenue": number,"not_picked_up": number,"orders": number
            }[]
                           },
"team_list_members":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"email": string,"full_name": string,"role": Database["public"]['Enums']["peran_tim"],"user_id": string
            }[]
                           },
"team_pending_payments":
{ Args: Record<PropertyKey, never>; Returns: {
              "amount": number,"created_at": string,"order_id": string,"pay_deadline": string,"payment_code": string,"pickup_name": string,"tenant_name": string
            }[]
                           },
"team_refund":
{ Args: { "p_amount": number,"p_bearer": Database["public"]['Enums']["penanggung"],"p_full": boolean,"p_order": string,"p_reason": string }; Returns: undefined
                           },
"team_reply_report":
{ Args: { "p_body": string,"p_report": string,"p_status": Database["public"]['Enums']["status_laporan"] }; Returns: undefined
                           },
"team_review_tenant":
{ Args: { "p_approve": boolean,"p_reason": string,"p_tenant": string }; Returns: undefined
                           },
"team_set_tenant_suspended":
{ Args: { "p_reason": string,"p_suspend": boolean,"p_tenant": string }; Returns: number
                           },
"team_suspension_preview":
{ Args: { "p_tenant": string }; Returns: number
                           },
"team_update_member":
{ Args: { "p_role": Database["public"]['Enums']["peran_tim"],"p_user": string }; Returns: undefined
                           },
"tenant_day_ranges":
{ Args: { "p_date": string,"p_tenant": string }; Returns: {
              "close_time": string,"open_time": string
            }[]
                           }
          }
          Enums: {
            "cara_makan": "makan_di_sini"|"bungkus","jenis_promo": "persen"|"rupiah","jenis_tenant": "makanan"|"minuman"|"keduanya","kategori_laporan": "pesanan_salah"|"uang_belum_kembali"|"lainnya","penanggung": "aturan"|"tenant"|"jaminin","pengelola_tenant": "mandiri"|"pihak_kantin","peran_tenant": "pemilik"|"karyawan","peran_tim": "admin"|"staf","status_item": "normal"|"habis_menunggu"|"diganti"|"dihapus","status_laporan": "baru"|"diproses"|"selesai","status_pengguna": "mahasiswa"|"dosen"|"staf_binus"|"tamu"|"pekerja_kantin","status_pesanan": "menunggu_bayar"|"kedaluwarsa"|"diterima"|"disiapkan"|"siap"|"selesai"|"tidak_diambil"|"dibatalkan","status_tenant": "menunggu"|"disetujui"|"ditolak"|"ditangguhkan"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "cara_makan": ["makan_di_sini", "bungkus"],"jenis_promo": ["persen", "rupiah"],"jenis_tenant": ["makanan", "minuman", "keduanya"],"kategori_laporan": ["pesanan_salah", "uang_belum_kembali", "lainnya"],"penanggung": ["aturan", "tenant", "jaminin"],"pengelola_tenant": ["mandiri", "pihak_kantin"],"peran_tenant": ["pemilik", "karyawan"],"peran_tim": ["admin", "staf"],"status_item": ["normal", "habis_menunggu", "diganti", "dihapus"],"status_laporan": ["baru", "diproses", "selesai"],"status_pengguna": ["mahasiswa", "dosen", "staf_binus", "tamu", "pekerja_kantin"],"status_pesanan": ["menunggu_bayar", "kedaluwarsa", "diterima", "disiapkan", "siap", "selesai", "tidak_diambil", "dibatalkan"],"status_tenant": ["menunggu", "disetujui", "ditolak", "ditangguhkan"]
          }
        }
} as const
