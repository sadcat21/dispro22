import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface StockDiscrepancy {
  id: string;
  worker_id: string;
  product_id: string;
  branch_id: string | null;
  discrepancy_type: 'surplus' | 'deficit';
  quantity: number;
  remaining_quantity: number;
  price_per_unit: number;
  total_value: number;
  pricing_method: string | null;
  source_session_id: string | null;
  accounting_session_id: string | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product?: { name: string; price_gros: number; price_super_gros: number; price_retail: number; price_invoice: number; pieces_per_box: number };
  worker?: { full_name: string };
}

export const useStockDiscrepancies = (workerId?: string | null) => {
  return useQuery({
    queryKey: ['stock-discrepancies', workerId],
    queryFn: async () => {
      let query = supabase
        .from('stock_discrepancies')
        .select('*, product:products(name, price_gros, price_super_gros, price_retail, price_invoice, pieces_per_box)')
        .order('created_at', { ascending: false });
      
      if (workerId) {
        query = query.eq('worker_id', workerId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as StockDiscrepancy[];
    },
    enabled: true,
  });
};

export const usePendingDiscrepancies = (workerId: string | null) => {
  return useQuery({
    queryKey: ['stock-discrepancies-pending', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      const { data, error } = await supabase
        .from('stock_discrepancies')
        .select('*, product:products(name, price_gros, price_super_gros, price_retail, price_invoice, pieces_per_box)')
        .eq('worker_id', workerId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as StockDiscrepancy[];
    },
    enabled: !!workerId,
  });
};

export const useCreateDiscrepancy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      worker_id: string;
      product_id: string;
      branch_id?: string | null;
      discrepancy_type: 'surplus' | 'deficit';
      quantity: number;
      source_session_id?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('stock_discrepancies')
        .insert({
          worker_id: params.worker_id,
          product_id: params.product_id,
          branch_id: params.branch_id || null,
          discrepancy_type: params.discrepancy_type,
          quantity: params.quantity,
          remaining_quantity: params.quantity,
          source_session_id: params.source_session_id || null,
          notes: params.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['stock-discrepancies-pending'] });
    },
  });
};

export const useResolveDiscrepancy = () => {
  const queryClient = useQueryClient();
  const { workerId } = useAuth();
  
  return useMutation({
    mutationFn: async (params: {
      id: string;
      pricing_method?: string;
      price_per_unit?: number;
      total_value?: number;
      status: 'resolved' | 'added_to_stock';
      accounting_session_id?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('stock_discrepancies')
        .update({
          pricing_method: params.pricing_method || null,
          price_per_unit: params.price_per_unit || 0,
          total_value: params.total_value || 0,
          status: params.status,
          accounting_session_id: params.accounting_session_id || null,
          resolved_by: workerId,
          resolved_at: new Date().toISOString(),
          notes: params.notes || null,
        })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['stock-discrepancies-pending'] });
    },
  });
};
