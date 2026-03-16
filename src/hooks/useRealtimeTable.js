import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Generic hook that:
 * 1. Fetches all rows from a Supabase table
 * 2. Subscribes to realtime INSERT/UPDATE/DELETE events
 * 3. Returns rows + CRUD helpers
 *
 * @param {string} table   Supabase table name
 * @param {object} options { orderBy, ascending, filter }
 */
export function useRealtimeTable(table, options = {}) {
  const { orderBy = 'created_at', ascending = true, filter } = options
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    let query = supabase.from(table).select('*').order(orderBy, { ascending })
    if (filter) query = query.match(filter)
    const { data, error } = await query
    if (error) setError(error.message)
    else setRows(data || [])
    setLoading(false)
  }, [table, orderBy, ascending, JSON.stringify(filter)])

  useEffect(() => {
    fetch()

    const channel = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, payload => {
        if (payload.eventType === 'INSERT') {
          setRows(prev => [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setRows(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
        } else if (payload.eventType === 'DELETE') {
          setRows(prev => prev.filter(r => r.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetch])

  async function insert(record) {
    const { data, error } = await supabase.from(table).insert(record).select().single()
    if (error) throw error
    return data
  }

  async function update(id, changes) {
    const { data, error } = await supabase.from(table).update(changes).eq('id', id).select().single()
    if (error) throw error
    return data
  }

  async function remove(id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  }

  return { rows, loading, error, insert, update, remove, refetch: fetch }
}
