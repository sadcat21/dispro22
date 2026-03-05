import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const useAppUpdateUrl = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: appUpdateUrl, isLoading } = useQuery({
    queryKey: ['app-update-url'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_update_url')
        .is('branch_id', null)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      return data?.value || '';
    },
  });

  const updateAppUpdateUrl = useMutation({
    mutationFn: async (url: string) => {
      // First check if setting exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'app_update_url')
        .is('branch_id', null)
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('app_settings')
          .update({ value: url, updated_by: user?.id })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('app_settings')
          .insert({ key: 'app_update_url', value: url, updated_by: user?.id });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-update-url'] });
      toast.success('تم حفظ رابط التحديث');
    },
    onError: (error) => {
      console.error('Error updating app update URL:', error);
      toast.error('فشل في حفظ رابط التحديث');
    },
  });

  return {
    appUpdateUrl: appUpdateUrl || '',
    isLoading,
    updateAppUpdateUrl: updateAppUpdateUrl.mutate,
    isUpdating: updateAppUpdateUrl.isPending,
  };
};