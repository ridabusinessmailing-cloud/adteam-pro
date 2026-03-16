import { useRealtimeTable } from './useRealtimeTable'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

/**
 * Inventory hook with stock movement logic.
 * Wraps useRealtimeTable for both 'inventory' and 'stock_history'.
 */
export function useInventory() {
  const { userName } = useAuth()
  const inventory = useRealtimeTable('inventory', { orderBy: 'product' })
  const history = useRealtimeTable('stock_history', { orderBy: 'created_at', ascending: false })

  /**
   * Record a stock movement and update the inventory row atomically.
   * movement_type: 'Requested' | 'Received' | 'Sale' | 'Adjustment'
   */
  async function recordMovement(inventoryRow, movementType, quantity, notes = '') {
    const qty = parseInt(quantity)
    if (!qty || isNaN(qty)) throw new Error('Invalid quantity')

    const today = new Date().toISOString().slice(0, 10)
    let patch = { last_update: today }

    switch (movementType) {
      case 'Requested':
        patch.requested_stock = (inventoryRow.requested_stock || 0) + qty
        break
      case 'Received':
        patch.available_stock = (inventoryRow.available_stock || 0) + qty
        patch.incoming_stock  = Math.max(0, (inventoryRow.incoming_stock || 0) - qty)
        break
      case 'Sale':
        patch.available_stock = Math.max(0, (inventoryRow.available_stock || 0) - qty)
        patch.total_sold      = (inventoryRow.total_sold || 0) + qty
        break
      case 'Adjustment':
        patch.available_stock = Math.max(0, (inventoryRow.available_stock || 0) + qty)
        break
      default:
        throw new Error('Unknown movement type')
    }

    // Update inventory
    const { error: invErr } = await supabase
      .from('inventory')
      .update(patch)
      .eq('id', inventoryRow.id)

    if (invErr) throw invErr

    // Append to stock_history (never deleted)
    const histRecord = {
      date: today,
      product: inventoryRow.product,
      quantity_change: movementType === 'Sale' ? -qty : qty,
      movement_type: movementType,
      updated_by: userName,
      notes,
    }

    const { error: histErr } = await supabase.from('stock_history').insert(histRecord)
    if (histErr) throw histErr
  }

  return {
    inventory,
    history,
    recordMovement,
  }
}
