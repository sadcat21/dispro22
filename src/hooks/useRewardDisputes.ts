import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface RewardDispute {
  id: string;
  worker_id: string;
  points_log_id: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  branch_id: string | null;
  created_at: string;
}

export const useWorkerDisputes = (workerId?: string) => {
  return useQuery({
    queryKey: ['reward-disputes', workerId],
    enabled: !!workerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reward_disputes' as any)
        .select('*')
        .eq('worker_id', workerId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as RewardDispute[];
    },
  });
};

export const useAllDisputes = () => {
  const { activeBranch } = useAuth();
  return useQuery({
    queryKey: ['all-reward-disputes', activeBranch?.id],
    queryFn: async () => {
      let query = supabase
        .from('reward_disputes' as any)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (activeBranch?.id) query = query.eq('branch_id', activeBranch.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RewardDispute[];
    },
  });
};

export const useCreateDispute = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dispute: { worker_id: string; points_log_id: string; reason: string; branch_id?: string | null }) => {
      const { error } = await supabase.from('reward_disputes' as any).insert(dispute as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-disputes'] });
      toast.success('تم إرسال الاعتراض بنجاح');
    },
  });
};

export const useReviewDispute = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, status, review_notes }: { id: string; status: 'approved' | 'rejected'; review_notes?: string }) => {
      const { error } = await supabase
        .from('reward_disputes' as any)
        .update({
          status,
          review_notes: review_notes || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-reward-disputes'] });
      queryClient.invalidateQueries({ queryKey: ['reward-disputes'] });
      toast.success('تم مراجعة الاعتراض');
    },
  });
};
