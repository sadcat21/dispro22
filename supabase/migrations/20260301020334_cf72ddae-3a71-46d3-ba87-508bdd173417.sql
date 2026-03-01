
-- Create disputes table for worker appeals
CREATE TABLE public.reward_disputes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.workers(id),
  points_log_id UUID NOT NULL REFERENCES public.employee_points_log(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.workers(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can view own disputes" ON public.reward_disputes
  FOR SELECT USING (worker_id = get_worker_id());

CREATE POLICY "Workers can create own disputes" ON public.reward_disputes
  FOR INSERT WITH CHECK (worker_id = get_worker_id());

CREATE POLICY "Admins can manage disputes" ON public.reward_disputes
  FOR ALL USING (is_admin() OR is_branch_admin());

-- Create reward notifications table
CREATE TABLE public.reward_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_worker_id UUID NOT NULL REFERENCES public.workers(id),
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_entity_id UUID,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workers can view own notifications" ON public.reward_notifications
  FOR SELECT USING (target_worker_id = get_worker_id());

CREATE POLICY "Workers can update own notifications" ON public.reward_notifications
  FOR UPDATE USING (target_worker_id = get_worker_id());

CREATE POLICY "Admins can manage notifications" ON public.reward_notifications
  FOR ALL USING (is_admin() OR is_branch_admin());
