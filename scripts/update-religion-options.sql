-- Update religion options to include specific Christian denominations
-- Run this in the Supabase SQL Editor

-- First, drop the existing check constraint
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_religion_check;

-- Add the new check constraint with expanded religion options (alphabetized)
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_religion_check 
CHECK (religion IN (
  'Agnostic',
  'Atheist',
  'Baha''i',
  'Buddhist',
  'Christian - Anglican',
  'Christian - Baptist',
  'Christian - Eastern Orthodox',
  'Christian - Evangelical',
  'Christian - Lutheran',
  'Christian - Methodist',
  'Christian - Non-denominational',
  'Christian - Other',
  'Christian - Pentecostal',
  'Christian - Presbyterian',
  'Christian - Protestant',
  'Christian - Roman Catholic',
  'Hindu',
  'Jain',
  'Jewish',
  'Muslim',
  'Other',
  'Prefer not to say',
  'Shinto',
  'Sikh',
  'Taoist',
  'Zoroastrian'
));

-- Verify the constraint was added successfully
SELECT conname, consrc 
FROM pg_constraint 
WHERE conname = 'profiles_religion_check';
