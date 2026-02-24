import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_THRESHOLD = 100;

export const useLocationThreshold = () => {
  return useQuery({
    queryKey: ['location-threshold'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'location_threshold_meters')
        .maybeSingle();

      if (error) throw error;
      return data ? parseInt(data.value, 10) : DEFAULT_THRESHOLD;
    },
  });
};

export const useUpdateLocationThreshold = () => {
  const queryClient = useQueryClient();
  const { workerId } = useAuth();

  return useMutation({
    mutationFn: async (meters: number) => {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'location_threshold_meters')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: meters.toString(), updated_by: workerId })
          .eq('key', 'location_threshold_meters');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({ key: 'location_threshold_meters', value: meters.toString(), updated_by: workerId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-threshold'] });
    },
  });
};
