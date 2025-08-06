/*
  # Fix foreign key constraint for user deletion

  1. Changes
    - Drop existing foreign key constraint on sales.created_by
    - Recreate the constraint with ON DELETE SET NULL
    - This allows user deletion while preserving sales records
    - The created_by field will be set to NULL when a user is deleted

  2. Security
    - No changes to RLS policies needed
    - Maintains data integrity while allowing user deletion
*/

-- Drop the existing foreign key constraint
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_created_by_fkey;

-- Recreate the constraint with ON DELETE SET NULL
ALTER TABLE sales 
ADD CONSTRAINT sales_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;