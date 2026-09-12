(function () {
    'use strict';

    const config = window.ATENDENTE_CONFIG || {};
    const limiteHistorico = Number(config.historicoLimite) || 10;
    const pacientes = [];
    const elementos = {
        formulario: document.getElementById('form-atendimento'),
        nome: document.getElementById('nome-paciente'),
        botao: document.getElementById('botao-enviar'),
        excluirUltimo: document.getElementById('botao-excluir-ultimo'),
        excluirTodos: document.getElementById('botao-excluir-todos'),
        status: document.getElementById('mensagem-status'),
        lista: document.getElementById('lista-recentes'),
        contador: document.getElementById('contador-registros')
    };
    let clienteSupabase = null;

    function mostrarStatus(mensagem, tipo) {
        elementos.status.textContent = mensagem;
        elementos.status.className = 'mensagem-status ' + (tipo || '');
    }

    function limparErros() {
        document.querySelectorAll('.mensagem-campo').forEach(function (item) {
            item.textContent = '';
        });
        elementos.nome.classList.remove('erro');
    }

    function validarFormulario() {
        limparErros();
        const nome = elementos.nome.value.trim();

        if (!nome) {
            document.querySelector('[data-erro="name"]').textContent = 'Informe o nome do paciente.';
            elementos.nome.classList.add('erro');
            return null;
        }

        return { name: nome };
    }

    function renderizarPacientes() {
        elementos.lista.replaceChildren();

        if (pacientes.length === 0) {
            const vazio = document.createElement('tr');
            const celula = document.createElement('td');
            celula.colSpan = 2;
            celula.className = 'tabela-vazia';
            celula.textContent = 'Nenhum atendimento registrado.';
            vazio.appendChild(celula);
            elementos.lista.appendChild(vazio);
        } else {
            pacientes.forEach(function (paciente) {
                const linha = document.createElement('tr');
                const nome = document.createElement('td');
                const senha = document.createElement('td');
                nome.textContent = paciente.name;
                senha.textContent = paciente.senha;
                linha.append(nome, senha);
                elementos.lista.appendChild(linha);
            });
        }

        elementos.contador.textContent = String(pacientes.length);
        elementos.excluirUltimo.disabled = pacientes.length === 0;
        elementos.excluirTodos.disabled = pacientes.length === 0;
    }

    function adicionarPaciente(paciente, destacar) {
        const indice = pacientes.findIndex(function (item) {
            return String(item.id) === String(paciente.id);
        });

        if (indice >= 0) pacientes.splice(indice, 1);
        pacientes.unshift({ id: paciente.id, name: paciente.name, senha: paciente.senha });
        pacientes.splice(limiteHistorico);
        renderizarPacientes();

        if (destacar && elementos.lista.firstElementChild) {
            elementos.lista.firstElementChild.classList.add('linha-nova');
        }
    }

    async function carregarConfiguracao() {
        const resposta = await fetch('../api/get_config.php', {
            headers: { Accept: 'application/json' }
        });
        if (!resposta.ok) throw new Error('Não foi possível carregar a configuração do Supabase.');
        const dados = await resposta.json();
        if (!dados.url || !dados.key) throw new Error('Configuração pública do Supabase incompleta.');
        return dados;
    }

    async function carregarRecentes() {
        const resultado = await clienteSupabase
            .from('pacientes')
            .select('id, name, senha')
            .order('id', { ascending: false })
            .limit(limiteHistorico);

        if (resultado.error) throw resultado.error;
        (resultado.data || []).reverse().forEach(function (paciente) { adicionarPaciente(paciente, false); });
    }

    async function obterProximaSenha() {
        const resultado = await clienteSupabase
            .from('pacientes')
            .select('senha')
            .order('senha', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (resultado.error) throw resultado.error;
        return (Number(resultado.data && resultado.data.senha) || 0) + 1;
    }

    async function excluirUltimoPaciente() {
        if (!window.confirm('Deseja excluir o último paciente cadastrado?')) return;

        elementos.excluirUltimo.disabled = true;
        mostrarStatus('Excluindo o último paciente...', '');

        try {
            const busca = await clienteSupabase
                .from('pacientes')
                .select('id')
                .order('id', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (busca.error) throw busca.error;
            if (!busca.data) {
                mostrarStatus('Não há pacientes cadastrados para excluir.', 'erro');
                return;
            }

            const exclusao = await clienteSupabase
                .from('pacientes')
                .delete()
                .eq('id', busca.data.id);

            if (exclusao.error) throw exclusao.error;

            const indice = pacientes.findIndex(function (paciente) {
                return String(paciente.id) === String(busca.data.id);
            });
            if (indice >= 0) pacientes.splice(indice, 1);
            renderizarPacientes();
            mostrarStatus('Último paciente excluído com sucesso.', 'sucesso');
        } catch (erro) {
            console.error('Falha ao excluir o último paciente:', erro);
            mostrarStatus('Não foi possível excluir o último paciente.', 'erro');
        } finally {
            elementos.excluirUltimo.disabled = pacientes.length === 0;
            elementos.excluirTodos.disabled = pacientes.length === 0;
        }
    }

    async function excluirTodosPacientes() {
        const confirmado = window.confirm(
            'A tabela não possui data de atendimento. Esta ação excluirá todos os pacientes cadastrados. Deseja continuar?'
        );
        if (!confirmado) return;

        elementos.excluirTodos.disabled = true;
        mostrarStatus('Excluindo os pacientes cadastrados...', '');

        try {
            const exclusao = await clienteSupabase
                .from('pacientes')
                .delete()
                .neq('id', 0);

            if (exclusao.error) throw exclusao.error;

            pacientes.splice(0, pacientes.length);
            renderizarPacientes();
            mostrarStatus('Todos os pacientes cadastrados foram excluídos.', 'sucesso');
        } catch (erro) {
            console.error('Falha ao excluir os pacientes:', erro);
            mostrarStatus('Não foi possível excluir os pacientes cadastrados.', 'erro');
        } finally {
            elementos.excluirUltimo.disabled = pacientes.length === 0;
            elementos.excluirTodos.disabled = pacientes.length === 0;
        }
    }

    function assinarAtualizacoes() {
        clienteSupabase
            .channel('pacientes-atendente')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pacientes' }, function (evento) {
                if (evento.new && evento.new.id !== undefined) adicionarPaciente(evento.new, true);
            })
            .subscribe();
    }

    async function submeter(evento) {
        evento.preventDefault();
        const dados = validarFormulario();
        if (!dados) {
            mostrarStatus('Revise os campos destacados.', 'erro');
            return;
        }

        elementos.botao.disabled = true;
        const textoOriginalBotao = elementos.botao.textContent;
        elementos.botao.textContent = 'Inserindo...';
        mostrarStatus('Inserindo paciente na fila...', '');

        try {
            const senha = await obterProximaSenha();
            const resultado = await clienteSupabase
                .from('pacientes')
                .insert({ name: dados.name, senha: senha })
                .select('id, name, senha')
                .single();

            if (resultado.error) {
                console.error('Falha ao inserir paciente:', resultado.error);
                mostrarStatus('Não foi possível inserir o paciente. Tente novamente.', 'erro');
                return;
            }

            adicionarPaciente(resultado.data, true);
            elementos.formulario.reset();
            limparErros();
            mostrarStatus('Senha ' + senha + ' gerada e paciente chamado com sucesso.', 'sucesso');
            elementos.nome.focus();
        } catch (erro) {
            console.error('Exceção ao inserir paciente:', erro);
            mostrarStatus('Não foi possível conectar ao sistema. Tente novamente.', 'erro');
        } finally {
            elementos.botao.disabled = false;
            elementos.botao.textContent = textoOriginalBotao;
        }
    }

    async function iniciar() {
        renderizarPacientes();
        elementos.formulario.addEventListener('submit', submeter);
        elementos.excluirUltimo.addEventListener('click', excluirUltimoPaciente);
        elementos.excluirTodos.addEventListener('click', excluirTodosPacientes);

        try {
            if (!window.supabase) throw new Error('Biblioteca do Supabase indisponível.');
            const credenciais = await carregarConfiguracao();
            clienteSupabase = window.supabase.createClient(credenciais.url, credenciais.key);
            assinarAtualizacoes();
            await carregarRecentes();
            elementos.botao.disabled = false;
        } catch (erro) {
            console.error('Falha ao iniciar atendente:', erro);
            mostrarStatus('Sistema indisponível. Verifique a conexão e tente novamente.', 'erro');
            elementos.botao.disabled = true;
        }
    }

    iniciar();
}());
