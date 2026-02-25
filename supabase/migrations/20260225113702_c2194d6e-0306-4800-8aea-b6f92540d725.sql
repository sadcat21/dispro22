
-- Enable realtime for core tables
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_debts;
ALTER PUBLICATION supabase_realtime ADD TABLE debt_collections;
ALTER PUBLICATION supabase_realtime ADD TABLE debt_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE receipts;
ALTER PUBLICATION supabase_realtime ADD TABLE receipt_modifications;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE customer_approval_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE sectors;
ALTER PUBLICATION supabase_realtime ADD TABLE promos;
