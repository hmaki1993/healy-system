-- ============================================================
-- COMMUNICATION SUITE - RLS Policy Fix
-- Run this in Supabase SQL Editor AFTER the main migration
-- ============================================================

-- Fix 1: conversations_select policy
-- The original policy only allowed SELECT if the user was in conversation_participants,
-- but this blocked the INSERT...select() pattern used when creating a new conversation.
-- We add 'created_by = auth.uid()' so the creator can always see their own conversation.

DROP POLICY IF EXISTS "conversations_select" ON conversations;

CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    created_by = auth.uid()
    OR
    id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

-- Fix 2: Allow participants to also SELECT their own conversation
-- (already covered by the above OR clause, but being explicit)

-- Fix 3: Messages policy - also allow sender to always select their own messages
DROP POLICY IF EXISTS "messages_select" ON messages;

CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (
    sender_id = auth.uid()
    OR
    conversation_id IN (
      SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid()
    )
  );

SELECT 'RLS Policy fix applied successfully! ✅' AS status;
