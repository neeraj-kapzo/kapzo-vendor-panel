export type VendorStatus = 'pending' | 'active' | 'banned'

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'packing'
  | 'packed'
  | 'dispatched'
  | 'delivered'
  | 'rejected'
  | 'cancelled'
  


  
export interface Database {
  public: {
    Tables: {
      vendors: {
        Row: {
          id: string
          user_id: string
          pharmacy_name: string
          email: string
          phone: string
          license_url: string | null
          contact_person: string
          address: string
          status: VendorStatus
          is_online: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          pharmacy_name: string
          email: string
          phone: string
          license_url?: string | null
          contact_person: string
          address: string
          status?: VendorStatus
          is_online?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          pharmacy_name?: string
          email?: string
          phone?: string
          license_url?: string | null
          contact_person?: string
          address?: string
          status?: VendorStatus
          is_online?: boolean
          created_at?: string
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          id: string
          name: string
          salt_name: string | null
          image_url: string | null
          mrp: number
          created_by_admin: boolean
        }
        Insert: {
          id?: string
          name: string
          salt_name?: string | null
          image_url?: string | null
          mrp: number
          created_by_admin?: boolean
        }
        Update: {
          id?: string
          name?: string
          salt_name?: string | null
          image_url?: string | null
          mrp?: number
          created_by_admin?: boolean
        }
        Relationships: []
      }
      vendor_inventory: {
        Row: {
          id: string
          vendor_id: string
          catalog_item_id: string
          is_available: boolean
          stock_qty: number
          vendor_price: number
        }
        Insert: {
          id?: string
          vendor_id: string
          catalog_item_id: string
          is_available?: boolean
          stock_qty?: number
          vendor_price: number
        }
        Update: {
          id?: string
          vendor_id?: string
          catalog_item_id?: string
          is_available?: boolean
          stock_qty?: number
          vendor_price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'vendor_inventory_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'vendor_inventory_catalog_item_id_fkey'
            columns: ['catalog_item_id']
            isOneToOne: false
            referencedRelation: 'catalog_items'
            referencedColumns: ['id']
          }
        ]
      }
      orders: {
        Row: {
          id: string
          vendor_id: string
          customer_id: string
          rider_id: string | null
          status: OrderStatus
          total_amount: number
          created_at: string
          updated_at: string
          rejection_reason: string | null
          prescription_verified: boolean
        }
        Insert: {
          id?: string
          vendor_id: string
          customer_id: string
          rider_id?: string | null
          status?: OrderStatus
          total_amount: number
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          prescription_verified?: boolean
        }
        Update: {
          id?: string
          vendor_id?: string
          customer_id?: string
          rider_id?: string | null
          status?: OrderStatus
          total_amount?: number
          created_at?: string
          updated_at?: string
          rejection_reason?: string | null
          prescription_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'orders_vendor_id_fkey'
            columns: ['vendor_id']
            isOneToOne: false
            referencedRelation: 'vendors'
            referencedColumns: ['id']
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          type: string
          title: string
          message: string
          data: Record<string, unknown> | null
          recipient_role: string
          recipient_id: string | null  // uuid in DB
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          title: string
          message: string
          data?: Record<string, unknown> | null
          recipient_role?: string
          recipient_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          title?: string
          message?: string
          data?: Record<string, unknown> | null
          recipient_role?: string
          recipient_id?: string | null
          is_read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          catalog_item_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          catalog_item_id: string
          quantity: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          catalog_item_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'order_items_catalog_item_id_fkey'
            columns: ['catalog_item_id']
            isOneToOne: false
            referencedRelation: 'catalog_items'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, {
      Row: Record<string, unknown>
      Relationships: []
    }>
    Functions: Record<string, {
      Args: Record<string, unknown>
      Returns: unknown
    }>
    Enums: {
      vendor_status: VendorStatus
      order_status: OrderStatus
    }
    CompositeTypes: Record<string, Record<string, unknown>>
  }
}

/* ─── Convenience row types ─── */
export type Vendor = Database['public']['Tables']['vendors']['Row']
export type CatalogItem = Database['public']['Tables']['catalog_items']['Row']
export type VendorInventory = Database['public']['Tables']['vendor_inventory']['Row']
export type Order = Database['public']['Tables']['orders']['Row']
export type OrderItem = Database['public']['Tables']['order_items']['Row']

/* ─── Joined / extended types ─── */
export type OrderWithItems = Order & {
  order_items: (OrderItem & { catalog_item: CatalogItem })[]
}

export type InventoryWithCatalog = VendorInventory & {
  catalog_item: CatalogItem
}
