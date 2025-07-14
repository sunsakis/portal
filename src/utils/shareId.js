import { supabase } from '../services/supabase';

export const generateRandomShareId = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Check if share ID exists in database
export const checkShareIdExists = async (shareId) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('share_id')
      .eq('share_id', shareId)
      .single();

    if (error) {
      // If error is "no rows returned", ID doesn't exist (good!)
      if (error.code === 'PGRST116') {
        return false;
      }
      throw error;
    }

    // If we got data back, ID exists (collision!)
    return true;
  } catch (error) {
    console.error('Error checking share ID:', error);
    throw error;
  }
};

// Generate unique share ID with retry logic
export const generateUniqueShareId = async (maxAttempts = 10) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const shareId = generateRandomShareId();
    
    try {
      const exists = await checkShareIdExists(shareId);
      
      if (!exists) {
        console.log(`✅ Unique share ID generated: ${shareId} (attempt ${attempt})`);
        return shareId;
      }
      
      console.log(`⚠️ Share ID collision: ${shareId} (attempt ${attempt})`);
    } catch (error) {
      console.error(`❌ Error checking share ID on attempt ${attempt}:`, error);
      
      // On last attempt, throw the error
      if (attempt === maxAttempts) {
        throw new Error(`Failed to generate unique share ID after ${maxAttempts} attempts`);
      }
    }
  }
  
  throw new Error(`Failed to generate unique share ID after ${maxAttempts} attempts`);
};