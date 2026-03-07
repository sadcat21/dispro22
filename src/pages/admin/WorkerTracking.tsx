import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSearchParams } from 'react-router-dom';
import WorkerTrackingMap from '@/components/map/WorkerTrackingMap';
import { Switch } from '@/components/ui/switch';
import { Users } from 'lucide-react';

const WorkerTracking: React.FC = () => {
  const { t, dir } = useLanguage();
  const [searchParams] = useSearchParams();
  const highlightWorkerId = searchParams.get('worker') || undefined;
  const [showAll, setShowAll] = useState(!highlightWorkerId);

  return (
    <div className="p-4 space-y-4">
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
      <WorkerTrackingMap
        key={highlightWorkerId || '__all__'}
        highlightWorkerId={highlightWorkerId}
        showOnlyHighlighted={!!highlightWorkerId && !showAll}
      />
    </div>
  );
};

export default WorkerTracking;
