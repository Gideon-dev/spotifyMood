import { createClient } from "@supabase/supabase-js";
import { Database } from "../db/types/supabase";


export const supabaseServer = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false }
    }
)