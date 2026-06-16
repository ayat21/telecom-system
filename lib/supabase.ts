import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  "https://zuesijlqpdpcrltqvzml.supabase.co";

const supabaseKey =
  "sb_publishable_XG7TEzQBKVnZPMKhqEem8g_5mvq7B8y";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);