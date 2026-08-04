import { supabase } from "@/supabase";

export async function getPreference<T>(key: string, defaultValue: T): Promise<T> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.error(`Erro ao ler preferência ${key}:`, error);
    return defaultValue;
  }

  if (data?.value != null) {
    return data.value as T;
  }

  // Fallback: check legacy localStorage and migrate
  try {
    const legacy = localStorage.getItem(key);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      console.log(`[migration] ${key} migrated to Supabase`);
      await setPreference(key, parsed);
      localStorage.removeItem(key);
      return parsed as T;
    }
  } catch (e) {
    console.error(`Error reading legacy localStorage for ${key}:`, e);
  }

  return defaultValue;
}

export async function setPreference<T>(key: string, value: T): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        key,
        value: value as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,key" }
    );

  if (error) throw new Error(`Erro ao salvar preferência ${key}: ${error.message}`);
}
