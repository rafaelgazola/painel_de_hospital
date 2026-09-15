# Painel de Atendimento Hospitalar

Painel de chamadas de pacientes em tempo real para UBS/hospital. A recepção gera senhas e insere os pacientes na fila; uma tela de TV exibe a chamada atual em destaque, histórico lateral, relógio e anúncio por voz.

## On-line no RENDER:

Abra no navegador:
   - Recepção: https://painel-de-hospital.onrender.com/views/atendente.html
   - Painel TV: https://painel-de-hospital.onrender.com/views/painel.html

## Tecnologias

- **PHP** 8.2 — endpoints de configuração e proxy REST para o Supabase
- **JavaScript** (Vanilla) — lógica das duas telas, Supabase client e Realtime
- **HTML5 / CSS3** — páginas estáticas em `views/` e estilos em `assets/`
- **Supabase** — banco (PostgreSQL) e Realtime via supabase-js v2
- **Docker** — imagem `php:8.2-apache`
- **Render** — deploy

## Configuração de Ambiente

Crie um arquivo `.env` na raiz (não é versionado) com as credenciais anon públicas do Supabase:

```
SUPABASE_URL="https://SEU_PROJETO.supabase.co/"
SUPABASE_KEY="sb_publishable_..."
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | sim | URL do projeto Supabase |
| `SUPABASE_KEY` | sim | Chave anon/publishable pública |


No Render, defina as mesmas variáveis no painel de environment variables em vez de usar `.env`.

## Estrutura de Pastas

```
.
├── api/
│   ├── get_config.php      # GET — serve url/key do Supabase ao browser
│   └── chamar_senha.php    # POST/PATCH — marca senha como chamada no banco
├── config/
│   └── database.php        # helper: supabaseRequest() e jsonResponse()
├── views/
│   ├── atendente.html      # tela da recepção
│   └── painel.html         # tela TV
├── assets/
│   ├── js/                 # atendente.js e painel.js
│   └── css/                # estilo.css e atendente.css
├── Dockerfile
└── .env                    # credenciais (não versionado)
```

## Como Rodar Localmente

1. Clone o repositório e entre na pasta.
2. Crie o `.env` com as credenciais (ver seção acima).
3. Inicie o servidor embutido do PHP na raiz:

   ```bash
   php -S localhost:8000
   ```

4. Abra no navegador:
   - Recepção: `http://localhost:8000/views/atendente.html`
   - Painel TV: `http://localhost:8000/views/painel.html`

Opcional, via Docker:

```bash
docker build -t painel .
docker run -p 80:80 painel
```