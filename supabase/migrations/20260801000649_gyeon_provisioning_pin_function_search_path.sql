-- Pin an empty function-local search_path on the three GYEON provisioning
-- functions to resolve the Security Advisor function_search_path_mutable
-- findings. All relation references in the function bodies are already
-- schema-qualified; built-ins resolve via the implicit pg_catalog lookup.
-- SECURITY INVOKER, ownership, bodies, argument types, and grants unchanged.

alter function public.claim_gyeon_provisioning(uuid, text) set search_path = '';

alter function public.complete_gyeon_shop_profile(uuid, text, text, text) set search_path = '';

alter function public.import_gyeon_provisioning(uuid, jsonb) set search_path = '';
