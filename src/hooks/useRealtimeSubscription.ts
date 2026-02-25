import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Subscribe to realtime changes on one or more tables and invalidate related query keys.
 */
export const useRealtimeSubscription = (
  channelName: string,
  tables: { table: string; filter?: string }[],
  queryKeys: string[][],
  enabled: boolean = true
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || tables.length === 0) return;

    let channel = supabase.channel(channelName);

    for (const { table, filter } of tables) {
      const opts: any = { event: '*', schema: 'public', table };
      if (filter) opts.filter = filter;
      channel = channel.on('postgres_changes', opts, () => {
        for (const key of queryKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      });
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, enabled, queryClient]);
};
