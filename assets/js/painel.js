(function () {
    'use strict';

    const config = window.PAINEL_CONFIG || {};
    const limiteHistorico = Number(config.historicoLimite) || 8;
    const elementos = {
        relogio: document.getElementById('relogio'),
        cartao: document.getElementById('cartao-chamada'),
        nome: document.getElementById('nome-paciente'),
        senha: document.getElementById('senha-paciente'),
        historico: document.getElementById('lista-historico'),
        contador: document.getElementById('contador-historico'),
        status: document.getElementById('status-conexao')
    };
    const historico = [];
    let ultimoPacienteId = null;
    let timerReconexao = null;

    function atualizarRelogio() {
        const agora = new Date();
        elementos.relogio.textContent = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        elementos.relogio.dateTime = agora.toISOString();
    }

    function pacienteValido(paciente) {
        return paciente && paciente.id !== undefined && paciente.name !== undefined && paciente.senha !== undefined;
    }

    function textoSeguro(valor) {
        return String(valor).trim() || '—';
    }

    function renderizarHistorico() {
        elementos.historico.replaceChildren();
        if (historico.length === 0) {
            const vazio = document.createElement('li');
            vazio.className = 'historico-vazio';
            vazio.textContent = 'Nenhuma chamada registrada.';
            elementos.historico.appendChild(vazio);
        } else {
            historico.forEach(function (paciente) {
                const item = document.createElement('li');
                item.className = 'item-historico';
                const nome = document.createElement('span');
                nome.className = 'historico-nome';
                nome.textContent = textoSeguro(paciente.name);
                const senha = document.createElement('strong');
                senha.className = 'historico-senha';
                senha.textContent = textoSeguro(paciente.senha);
                item.append(nome, senha);
                elementos.historico.appendChild(item);
            });
        }
        elementos.contador.textContent = String(historico.length);
    }

    function falarChamada(paciente) {
        if (typeof window.responsiveVoice !== 'undefined' && typeof window.responsiveVoice.speak === 'function') {
            if (typeof window.responsiveVoice.cancel === 'function') {
                window.responsiveVoice.cancel();
            }
            window.responsiveVoice.speak(
                `Senha ${paciente.senha}, ${paciente.name}, favor dirigir-se ao atendimento.`,
                'Brazilian Portuguese Female'
            );
        }
    }

    function exibirChamada(paciente, anunciar) {
        if (!pacienteValido(paciente)) return;
        elementos.cartao.classList.add('atualizando');
        elementos.nome.textContent = textoSeguro(paciente.name);
        elementos.senha.textContent = textoSeguro(paciente.senha);
        window.setTimeout(function () {
            elementos.cartao.classList.remove('atualizando');
        }, 180);

        const indiceExistente = historico.findIndex(function (item) { return String(item.id) === String(paciente.id); });
        if (indiceExistente >= 0) historico.splice(indiceExistente, 1);
        historico.unshift({ id: paciente.id, name: paciente.name, senha: paciente.senha });
        historico.splice(limiteHistorico);
        ultimoPacienteId = paciente.id;
        renderizarHistorico();
        if (anunciar) falarChamada(paciente);
    }

    function processarNovaChamada(paciente) {
        if (!pacienteValido(paciente) || String(paciente.id) === String(ultimoPacienteId)) return;
        exibirChamada(paciente, true);
    }

    async function carregarHistorico(supabase) {
        const resultado = await supabase.from('pacientes').select('id, name, senha').order('id', { ascending: false }).limit(limiteHistorico);
        if (resultado.error) throw resultado.error;
        (resultado.data || []).reverse().forEach(function (paciente) { exibirChamada(paciente, false); });
    }

    async function carregarConfiguracao() {
        const resposta = await fetch('../api/get_config.php', { headers: { Accept: 'application/json' } });
        if (!resposta.ok) throw new Error('Configuração do painel indisponível.');
        const dados = await resposta.json();
        if (!dados.url || !dados.key) throw new Error('Configuração pública incompleta.');
        return dados;
    }

    function assinarAtualizacoes(cliente) {
        const canal = cliente.channel('pacientes-painel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pacientes' }, function (evento) {
                processarNovaChamada(evento.new);
            })
            .subscribe(function (status) {
                if (status === 'SUBSCRIBED') elementos.status.textContent = 'Painel conectado e atualizado em tempo real.';
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                    elementos.status.textContent = 'Conexão em tempo real indisponível. Tentando reconectar...';
                    if (timerReconexao === null) {
                        timerReconexao = window.setTimeout(function () {
                            timerReconexao = null;
                            canal.unsubscribe();
                            assinarAtualizacoes(cliente);
                        }, 3000);
                    }
                }
            });
        return canal;
    }

    async function verificarUltimaChamada(supabase) {
        const resultado = await supabase
            .from('pacientes')
            .select('id, name, senha')
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (resultado.error) {
            console.warn('Não foi possível verificar a última chamada:', resultado.error);
            return;
        }

        processarNovaChamada(resultado.data);
    }

    async function iniciar() {
        atualizarRelogio();
        window.setInterval(atualizarRelogio, 1000);
        renderizarHistorico();
        try {
            if (!window.supabase) throw new Error('Biblioteca do Supabase indisponível.');
            const credenciais = await carregarConfiguracao();
            const cliente = window.supabase.createClient(credenciais.url, credenciais.key);
            assinarAtualizacoes(cliente);
            await carregarHistorico(cliente);
            window.setInterval(function () {
                verificarUltimaChamada(cliente);
            }, 3000);
            elementos.status.textContent = 'Painel conectado e atualizado em tempo real.';
        } catch (erro) {
            console.error('Falha ao carregar o painel:', erro);
            elementos.status.textContent = 'Não foi possível conectar ao painel. Verifique a configuração e a conexão.';
        }
    }

    iniciar();
}());
