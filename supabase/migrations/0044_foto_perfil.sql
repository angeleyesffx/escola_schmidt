-- Escola Schmidt - foto de perfil
-- Bucket publico para avatares; o caminho e gravado no perfil por RPC restrita.

alter table perfis add column avatar_path text;

create or replace function atualizar_avatar_perfil(p_avatar_path text) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_avatar_path is not null and p_avatar_path <> auth.uid()::text || '/avatar' then
    raise exception 'Caminho de avatar invalido.';
  end if;

  update perfis
     set avatar_path = p_avatar_path
   where id = auth.uid();
end;
$$;

grant execute on function atualizar_avatar_perfil(text) to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

create policy avatar_leitura_publica on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatar_upload_proprio on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatar_atualiza_proprio on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatar_remove_proprio on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
