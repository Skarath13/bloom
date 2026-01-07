import { supabase } from "./supabase";
import { createClient } from "@supabase/supabase-js";

// Create Supabase clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if vault is available (service role key is set)
const hasServiceKey = !!supabaseServiceKey;

// Service role client for vault SQL operations
const serviceClient = supabaseServiceKey
  ? createClient(supabaseUrl || "", supabaseServiceKey)
  : null;

// Use the main supabase client for integrations (already configured for appointments schema)
const appointmentsClient = supabase;

export interface SecretKey {
  key: string;
  label: string;
  description: string;
  required: boolean;
  masked: boolean;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_enabled: boolean;
  secret_keys: SecretKey[];
  config: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface SecretValue {
  key: string;
  value: string;
  exists: boolean;
}

/**
 * Get all integrations with their configuration
 */
export async function getIntegrations(): Promise<Integration[]> {
  const { data, error } = await appointmentsClient
    .from("bloom_integrations")
    .select("*")
    .order("name");

  if (error) throw error;
  return data || [];
}

/**
 * Get a single integration by ID
 */
export async function getIntegration(id: string): Promise<Integration | null> {
  const { data, error } = await appointmentsClient
    .from("bloom_integrations")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

/**
 * Update integration config (non-secret values)
 */
export async function updateIntegrationConfig(
  id: string,
  config: Record<string, string>,
  isEnabled: boolean
): Promise<Integration> {
  const { data, error } = await appointmentsClient
    .from("bloom_integrations")
    .update({
      config,
      is_enabled: isEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create or update a secret in the vault
 */
export async function upsertSecret(
  name: string,
  value: string,
  description?: string
): Promise<void> {
  if (!serviceClient) {
    throw new Error("Vault not configured. Set SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  const { error } = await serviceClient.rpc("upsert_vault_secret", {
    secret_name: name,
    secret_value: value,
    secret_description: description || null,
  });

  if (error) throw error;
}

/**
 * Get a secret value from the vault using SQL
 */
export async function getSecret(name: string): Promise<string | null> {
  if (!serviceClient) {
    return null;
  }

  try {
    const { data, error } = await serviceClient.rpc("get_vault_secret", { secret_name: name });
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Get multiple secrets by names
 */
export async function getSecrets(names: string[]): Promise<Record<string, string | null>> {
  const result: Record<string, string | null> = {};
  for (const name of names) {
    result[name] = await getSecret(name);
  }
  return result;
}

/**
 * Check which secrets exist (without revealing values)
 */
export async function checkSecretsExist(names: string[]): Promise<Record<string, boolean>> {
  if (!serviceClient) {
    const result: Record<string, boolean> = {};
    for (const name of names) {
      result[name] = false;
    }
    return result;
  }

  try {
    const { data, error } = await serviceClient.rpc("check_vault_secrets", { secret_names: names });
    if (error || !data) {
      const result: Record<string, boolean> = {};
      for (const name of names) {
        result[name] = false;
      }
      return result;
    }
    return data;
  } catch {
    const result: Record<string, boolean> = {};
    for (const name of names) {
      result[name] = false;
    }
    return result;
  }
}

/**
 * Delete a secret from the vault
 */
export async function deleteSecret(name: string): Promise<void> {
  if (!serviceClient) {
    throw new Error("Vault not configured. Set SUPABASE_SERVICE_ROLE_KEY environment variable.");
  }

  await serviceClient.rpc("delete_vault_secret", { secret_name: name });
}

/**
 * Check if vault is configured
 */
export function isVaultConfigured(): boolean {
  return hasServiceKey;
}

/**
 * Mask a secret value for display (show first and last 4 chars)
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "****";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
