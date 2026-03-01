import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, AlertTriangle, TrendingDown, Trophy, Info } from 'lucide-react';
import { useRewardNotifications, useMarkNotificationRead } from '@/hooks/useRewardNotifications';

const typeIcons: Record<string, React.ReactNode> = {
  auto_penalty: <AlertTriangle className="w-4 h-4 text-red-500" />,
  low_performance: <TrendingDown className="w-4 h-4 text-orange-500" />,
  level_up: <Trophy className="w-4 h-4 text-yellow-500" />,
  dispute_result: <Info className="w-4 h-4 text-blue-500" />,
  bonus_calculated: <Trophy className="w-4 h-4 text-green-600" />,
};

const RewardNotificationsTab: React.FC = () => {
  const { data: notifications, isLoading } = useRewardNotifications();
  const markRead = useMarkNotificationRead();

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">الإشعارات</h3>
      </div>

      {(!notifications || notifications.length === 0) ? (
        <div className="text-center py-12 text-muted-foreground">
          <BellOff className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد إشعارات</p>
        </div>
      ) : (
        notifications.map(n => (
          <Card
            key={n.id}
            className={`transition-colors ${!n.is_read ? 'border-primary/40 bg-primary/5' : 'opacity-70'}`}
            onClick={() => !n.is_read && markRead.mutate(n.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{typeIcons[n.notification_type] || <Bell className="w-4 h-4" />}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm truncate">{n.title}</p>
                    {!n.is_read && <Badge className="text-[9px] shrink-0">جديد</Badge>}
                  </div>
                  {n.message && <p className="text-xs text-muted-foreground mt-1">{n.message}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    {new Date(n.created_at).toLocaleDateString('ar-DZ')} - {new Date(n.created_at).toLocaleTimeString('ar-DZ', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};

export default RewardNotificationsTab;
