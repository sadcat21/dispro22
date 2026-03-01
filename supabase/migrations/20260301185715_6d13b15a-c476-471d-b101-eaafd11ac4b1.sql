-- Fix infinite recursion in chat RLS by moving membership checks to SECURITY DEFINER helper

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.worker_id = public.get_worker_id()
  );
$$;

-- Recreate conversation policies to use helper function
DROP POLICY IF EXISTS "Workers can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON public.conversations;

CREATE POLICY "Workers can view their conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  created_by = public.get_worker_id()
  OR public.is_conversation_participant(id)
);

CREATE POLICY "Participants can update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (public.is_conversation_participant(id))
WITH CHECK (public.is_conversation_participant(id));

-- Recreate participants SELECT policy without self-referencing subquery
DROP POLICY IF EXISTS "Workers can view their participations" ON public.conversation_participants;

CREATE POLICY "Workers can view their participations"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (
  worker_id = public.get_worker_id()
  OR public.is_conversation_participant(conversation_id)
);