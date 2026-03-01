import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface RewardNotification {
  id: string;
  target_worker_id: string;
  notification_type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  related_entity_id: string | null;
  branch_id: string | null;
  created_at: string;
}

export const useRewardNotifications = () => {
  const { workerId } = useAuth();
  return useQuery({
    queryKey: ['reward-notifications', workerId],
    enabled: !!workerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reward_notifications' as any)
        .select('*')
        .eq('target_worker_id', workerId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as RewardNotification[];
    },
  });
};

export const useUnreadNotificationCount = () => {
  const { workerId } = useAuth();
  return useQuery({
    queryKey: ['reward-notifications-unread', workerId],
    enabled: !!workerId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('reward_notifications' as any)
        .select('*', { count: 'exact', head: true })
        .eq('target_worker_id', workerId!)
        .eq('is_read', false);
      if (error) throw error;
      return count || 0;
    },
  });
};

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reward_notifications' as any)
        .update({ is_read: true } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['reward-notifications-unread'] });
    },
  });
};

export const useCreateNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notification: { target_worker_id: string; notification_type: string; title: string; message?: string; related_entity_id?: string; branch_id?: string | null }) => {
      const { error } = await supabase.from('reward_notifications' as any).insert(notification as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-notifications'] });
    },
  });
};
