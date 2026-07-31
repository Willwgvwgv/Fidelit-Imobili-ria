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

  return (data?.value as T) ?? defaultValue;
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
