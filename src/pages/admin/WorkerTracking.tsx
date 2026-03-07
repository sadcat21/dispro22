import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import WorkerTrackingMap from '@/components/map/WorkerTrackingMap';
import { Switch } from '@/components/ui/switch';
import { Users, User } from 'lucide-react';
import { useWorkerLocations } from '@/hooks/useWorkerLocation';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const WorkerTracking: React.FC = () => {
  const { t, dir } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightWorkerId = searchParams.get('worker') || undefined;
  const [showAll, setShowAll] = useState(!highlightWorkerId);
  const { data: workers } = useWorkerLocations();

  const selectWorker = (workerId: string) => {
    if (workerId === highlightWorkerId) {
      // Deselect → show all
      setSearchParams({});
      setShowAll(true);
    } else {
      setSearchParams({ worker: workerId });
      setShowAll(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between" dir={dir}>
        <h2 className="text-xl font-bold">{t('navigation.tracking_title')}</h2>
        {highlightWorkerId && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">كل العمال</span>
            <Switch checked={showAll} onCheckedChange={setShowAll} />
          </div>
        )}
      </div>

      {/* Worker quick-pick strip */}
      {workers && workers.length > 0 && (
        <ScrollArea className="w-full" dir={dir}>
          <div className="flex gap-2 pb-2">
            {workers.map(w => {
              const isSelected = w.worker_id === highlightWorkerId;
              const isActive = w.is_tracking && w.has_location;
              return (
                <button
                  key={w.worker_id}
                  onClick={() => selectWorker(w.worker_id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap transition-colors shrink-0
                    ${isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-accent text-foreground'}
                  `}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  {w.worker_name || w.worker_id.slice(0, 6)}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <WorkerTrackingMap
        key={highlightWorkerId || '__all__'}
        highlightWorkerId={highlightWorkerId}
        showOnlyHighlighted={!!highlightWorkerId && !showAll}
      />
    </div>
  );
};

export default WorkerTracking;
