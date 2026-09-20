// Escola Schmidt — convida um aluno/responsável por e-mail, criando o login
// (auth.users, via trigger cria a linha em perfis) e vinculando ao registro
// já existente em `alunos`. Precisa da service_role key (bypassa RLS), por
// isso roda numa Edge Function em vez de RPC — auth.admin.* só existe na API
// HTTP do GoTrue, não é chamável de dentro do Postgres.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@^2/cors';

const REDIRECT_TO = 'escolaschmidt://reset-password';

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

      if (perfilError || !perfilChamador || !['dono', 'professor'].includes(perfilChamador.papel)) {
        return Response.json(
          { ok: false, error: 'Sem permissão para convidar aluno.' },
          { status: 403, headers: corsHeaders }
        );
      }

      const corpo = await req.json().catch(() => null);
      const alunoId = corpo?.aluno_id;
      const email = corpo?.email;
      if (!alunoId || !email) {
        return Response.json(
          { ok: false, error: 'Informe aluno_id e email.' },
          { status: 400, headers: corsHeaders }
        );
      }

      // Daqui pra baixo usa service_role — bypassa RLS de propósito, mas só
      // depois de já ter validado acima que quem chamou é equipe.
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      const { data: aluno, error: alunoError } = await supabaseAdmin
        .from('alunos')
        .select('id, nome, perfil_id')
        .eq('id', alunoId)
        .single();

      if (alunoError || !aluno) {
        return Response.json({ ok: false, error: 'Aluno não encontrado.' }, { status: 404, headers: corsHeaders });
      }

      if (aluno.perfil_id) {
        return Response.json(
          { ok: false, error: 'Esse aluno já tem acesso ao aplicativo.' },
          { status: 409, headers: corsHeaders }
        );
      }

      const { data: convite, error: conviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: { nome: aluno.nome },
        redirectTo: REDIRECT_TO,
      });

      if (conviteError || !convite.user) {
        return Response.json(
          { ok: false, error: conviteError?.message ?? 'Não foi possível enviar o convite.' },
          { status: 400, headers: corsHeaders }
        );
      }

      const { error: vinculoError } = await supabaseAdmin
        .from('alunos')
        .update({ perfil_id: convite.user.id })
        .eq('id', alunoId);

      if (vinculoError) {
        return Response.json(
          { ok: false, error: 'Convite enviado, mas não foi possível vincular o perfil ao aluno.' },
          { status: 500, headers: corsHeaders }
        );
      }

      // Mesmo critério do vínculo automático por e-mail (0030): quem loga
      // vinculado a um registro de aluno é, por padrão, o responsável por
      // ele — não o próprio atleta. cria_perfil_novo_usuario() já inseriu
      // 'aluno' (default seguro); corrige aqui pro papel real.
      const { error: papelError } = await supabaseAdmin
        .from('perfis')
        .update({ papel: 'responsavel' })
        .eq('id', convite.user.id);

      if (papelError) {
        return Response.json(
          { ok: false, error: 'Aluno vinculado, mas não foi possível ajustar o papel da conta.' },
          { status: 500, headers: corsHeaders }
        );
      }

      return Response.json({ ok: true, perfil_id: convite.user.id }, { headers: corsHeaders });
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : String(err);
      return Response.json({ ok: false, error: mensagem }, { status: 500, headers: corsHeaders });
    }
  },
};
