-- Fix broken chat RLS policies that prevented reading newly created conversations
-- and had invalid self-comparisons (cp.conversation_id = cp.id)

-- Conversations policies
DROP POLICY IF EXISTS "Workers can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;

CREATE POLICY "Workers can view their conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  created_by = public.get_worker_id()
  OR EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.worker_id = public.get_worker_id()
  )
);

CREATE POLICY "Participants can update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.worker_id = public.get_worker_id()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.worker_id = public.get_worker_id()
  )
);

-- Conversation participants policy
DROP POLICY IF EXISTS "Workers can view their participations" ON public.conversation_participants;

CREATE POLICY "Workers can view their participations"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
  worker_id = public.get_worker_id()
  OR EXISTS (
    SELECT 1
    FROM public.conversation_participants me
    WHERE me.conversation_id = conversation_participants.conversation_id
      AND me.worker_id = public.get_worker_id()
  )
);