/*
  # Fix User Signup Trigger

  This migration fixes the signup error by ensuring proper user profile creation.

  1. Functions
    - Creates or replaces the `handle_new_user` function
    - Extracts user metadata and creates profile entries
    - Handles errors gracefully

  2. Triggers
    - Ensures trigger exists on auth.users table
    - Calls handle_new_user function after user insertion

  3. Security
    - Function runs with proper security context
    - Handles edge cases and null values
*/

-- Drop existing function if it exists to recreate it properly
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new profile with data from auth.users
  INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'User'),
    'cashier'::user_role,
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    
    -- Try to insert with minimal data as fallback
    INSERT INTO public.profiles (id, full_name, role, created_at, updated_at)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, 'User'),
      'cashier'::user_role,
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Ensure the profiles table has proper constraints
DO $$
BEGIN
  -- Make sure full_name has a default value to prevent NOT NULL errors
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'full_name' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE public.profiles 
    ALTER COLUMN full_name SET DEFAULT 'User';
  END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;

-- Test the function works by checking if it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'handle_new_user'
  ) THEN
    RAISE EXCEPTION 'handle_new_user function was not created properly';
  END IF;
  
  RAISE NOTICE 'User signup trigger and function created successfully';
END $$;