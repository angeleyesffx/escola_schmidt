// Escola Schmidt — convida um novo usuário (dono/professor/aluno) por e-mail,
// criando o login (auth.users, via trigger cria a linha em perfis) e já
// corrigindo o papel escolhido. Precisa da service_role key (bypassa RLS),
// por isso roda numa Edge Function em vez de RPC — auth.admin.* só existe na
// API HTTP do GoTrue, não é chamável de dentro do Postgres.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors';

const REDIRECT_TO = 'escolaschmidt://reset-password';
const PAPEIS_VALIDOS = ['dono', 'professor', 'aluno', 'responsavel'];

export default {
  fetch: async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return Response.json({ ok: false, error: 'Não autenticado.' }, { status: 401, headers: corsHeaders });
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      // Cliente com o JWT de quem chamou — só pra identificar o usuário e
      // conferir o papel dele (via RLS normal, sem privilégio nenhum).
      const supabaseChamador = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: userError } = await supabaseChamador.auth.getUser();
      if (userError || !userData.user) {
        return Response.json({ ok: false, error: 'Sessão inválida.' }, { status: 401, headers: corsHeaders });
      }

      const { data: perfilChamador, error: perfilError } = await supabaseChamador
        .from('perfis')
        .select('papel')
        .eq('id', userData.user.id)
        .single();

      // Dono convida qualquer papel. Professor também convida (pedido da
      // escola: equipe cresce sem depender só do dono), mas nunca outro dono
      // — validado abaixo, depois de saber o papel pedido.
      if (perfilError || !perfilChamador || !['dono', 'professor'].includes(perfilChamador.papel)) {
        return Response.json(
          { ok: false, error: 'Somente dono ou professor podem convidar novos usuários.' },
          { status: 403, headers: corsHeaders }
        );
      }

      const corpo = await req.json().catch(() => null);
      const email = corpo?.email;
      const nome = corpo?.nome;
      const papel = corpo?.papel;

      if (!email || !nome || !papel) {
        return Response.json(
          { ok: false, error: 'Informe email, nome e papel.' },
          { status: 400, headers: corsHeaders }
        );
      }
      if (!PAPEIS_VALIDOS.includes(papel)) {
        return Response.json({ ok: false, error: 'Papel inválido.' }, { status: 400, headers: corsHeaders });
      }
      if (perfilChamador.papel === 'professor' && papel === 'dono') {
        return Response.json(
          { ok: false, error: 'Professor não pode convidar um dono.' },
          { status: 403, headers: corsHeaders }
        );
      }

      // Daqui pra baixo usa service_role — bypassa RLS de propósito, mas só
      // depois de já ter validado acima quem pode chamar e qual papel pode pedir.
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      const { data: convite, error: conviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { nome },
        redirectTo: REDIRECT_TO,
      });

      if (conviteError || !convite.user) {
        return Response.json(
          { ok: false, error: conviteError?.message ?? 'Não foi possível enviar o convite.' },
          { status: 400, headers: corsHeaders }
        );
      }

      // O trigger cria_perfil_novo_usuario() já inseriu a linha com papel
      // 'aluno' (default seguro); corrigimos aqui pro papel escolhido no
      // convite. `and papel = 'aluno'` evita sobrescrever o papel de uma
      // conta que já existia antes deste convite — inviteUserByEmail pode
      // reaproveitar o user.id de um convite pendente não confirmado pra
      // esse mesmo e-mail (o GoTrue não erra nesse caso), e sem essa guarda
      // um professor conseguiria rebaixar o papel de outra conta (ex.: um
      // dono ainda não confirmado) só reconvidando o e-mail dela.
      const { data: papelAtualizado, error: papelError } = await supabaseAdmin
        .from('perfis')
        .update({ papel })
        .eq('id', convite.user.id)
        .eq('papel', 'aluno')
        .select('id');

      if (papelError) {
        return Response.json(
          { ok: false, error: 'Convite enviado, mas não foi possível definir o papel do usuário.' },
          { status: 500, headers: corsHeaders }
        );
      }

      if (!papelAtualizado || papelAtualizado.length === 0) {
        return Response.json(
          {
            ok: false,
            error: 'Esse e-mail já pertence a uma conta existente com outro papel. Fale com o suporte.',
          },
          { status: 409, headers: corsHeaders }
        );
      }

      return Response.json({ ok: true, perfil_id: convite.user.id }, { headers: corsHeaders });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, error: mensagem }, { status: 500, headers: corsHeaders });
    }
  },
};
