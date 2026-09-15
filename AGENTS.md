# AGENTS.md — Painel de Atendimento Hospitalar

## 1. Visão Geral

Sistema web de chamadas hospitalares (UBS) em PHP puro + HTML/CSS/JS estático + Supabase. Duas telas:

- `views/atendente.html` (recepção): gera a próxima senha e insere o paciente na fila.
- `views/painel.html` (TV): exibe a chamada atual em destaque, histórico lateral, relógio e anúncio por voz (ResponsiveVoice, pt-BR).

Não há `composer.json`, `package.json`, testes, lint nem build. Todo o JavaScript é Vanilla, carregado via `<script>`, e o Supabase é consumido diretamente pelo browser (supabase-js v2 via CDN). O papel do PHP é apenas **servir config** e (opcionalmente) **atuar como proxy REST** para o Supabase.

## 2. Arquitetura e Fluxo

```
[atendente.html]  → atendente.js → supabase-js (REST/Realtime)
                                      │ INSERT em "pacientes"
[painel.html]     → painel.js   ←─── postgres_changes INSERT + polling 3s
                                      │ (fallback se Realtime indisponível)
                                      └ ResponsiveVoice.speak(...)
        │
        └── GET ../api/get_config.php  → { url, key } (credenciais p/ o browser)
```

**Banco (tabela real usada pelo frontend):** `pacientes`
- `id` (serial, PK)
- `name` (varchar 50)
- `senha` (integer) — gerada como `MAX(senha)+1`

**Fluxo principal:**
1. `atendente.js::obterProximaSenha()` → `SELECT senha ORDER BY senha DESC LIMIT 1` +1.
2. `atendente.js::submeter()` → `INSERT { name, senha }`, atualiza a lista local.
3. `painel.js` reage ao INSERT via Realtime (`channel('pacientes-painel')`, `postgres_changes` INSERT em `public.pacientes`) e, como fallback, faz polling de 3s (`verificarUltimaChamada`).
4. Painel renderiza o histórico (limite configurável em `window.PAINEL_CONFIG.historicoLimite`, padrão 8) e anuncia por voz.

**Credenciais no browser:** ambos os JS chamam `fetch('../api/get_config.php')` e fazem `supabase.createClient(url, key)` com a **chave anon pública**. Depende de RLS no Supabase (não há auth de verdade).

## 3. Especificação dos Endpoints

### `api/get_config.php` — GET
- **Método:** `GET` (outro método → `405`, header `Allow: GET`).
- **Entrada:** nenhuma.
- **Resposta 200:**
  ```json
  { "url": "https://xxxx.supabase.co/", "key": "sb_publishable_..." }
  ```
- **Resposta 405:** `{ "erro": "Método HTTP não permitido." }`
- **Resposta 500:** `{ "erro": "Configurações do Supabase indisponíveis." }`
- **Fonte das credenciais (em ordem):** variáveis de ambiente `SUPABASE_URL`/`SUPABASE_KEY`/`SUPABASE_ANON_KEY` → arquivo `.env` na raiz (lido manualmente por regex; suporta aspas simples/duplas).
- Envia headers `Cache-Control: no-store` e `Content-Type: application/json; charset=utf-8`.

### `api/chamar_senha.php` — POST/PATCH
- **Método:** `POST` ou `PATCH` (outro → `405`, header `Allow: POST, PATCH`).
- **Entrada:** JSON (`Content-Type: application/json`) ou `application/x-www-form-urlencoded`. Campos obrigatórios:
  - `codigo_senha` (string ou int)
  - `local_destino_id` (string ou int)
- **Comportamento:** faz `PATCH` na API REST do Supabase (`/rest/v1/senhas?codigo_senha=eq.X&local_destino_id=eq.Y`) gravando `status = 'Chamado'` e `data_chamada` (ISO-8601 UTC).
- **Resposta 200:**
  ```json
  {
    "sucesso": true,
    "mensagem": "Senha chamada com sucesso.",
    "chamada": { "codigo_senha": "...", "local_destino_id": "...", "status": "Chamado", "data_chamada": "...", "texto_voz": "Senha X, dirigir-se ao local Y." }
  }
  ```
- **Resposta 400:** `{ "sucesso": false, "erro": "Os parâmetros codigo_senha e local_destino_id são obrigatórios." }`
- **Resposta 404:** `{ "sucesso": false, "erro": "Nenhuma senha encontrada para os dados informados." }`
- **Resposta 405:** `{ "sucesso": false, "erro": "Método HTTP não permitido." }`
- **Resposta 500:** `{ "sucesso": false, "erro": "..." }`
- Usa `config/database.php` (helper `jsonResponse()` e `supabaseRequest()`).

### `config/database.php` — helper compartilhado (não é endpoint)
- Define `SUPABASE_URL`/`SUPABASE_KEY` **apenas via `getenv()`** (NÃO lê o `.env` — ao contrário de `get_config.php`).
- `supabaseRequest(method, endpoint, ?payload): array` — requisição autenticada via cURL; converte erros de transporte/HTTP em `RuntimeException`; espera JSON; assume `Prefer: return=representation`.
- `jsonResponse(array $body, int $statusCode = 200): never` — emite JSON (`JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES`) e `exit`.

## 4. Instruções de Execução

- **Ambiente:** `php:8.2-apache` (Docker). Rodar local: `php -S localhost:8000` na raiz e abrir `views/atendente.html` / `views/painel.html`. Docker: `docker build -t painel .` + `docker run -p 80:80 painel`.
- **Setup:** `.env` na raiz (ignorado pelo git) com `SUPABASE_URL` e `SUPABASE_KEY`. **Nunca commitar o `.env`.** Requer extensão `curl` do PHP nos endpoints que usam `supabaseRequest`.
- **Convenções:**
  - PHP: `declare(strict_types=1)` no topo; respostas JSON via helper único; `error_log()` antes de retornar 500; nomes e mensagens em pt-BR.
  - JS: IIFE com `'use strict'`; nomes de funções/variáveis em pt-BR; acesso ao DOM por `getElementById`.
  - Ao adicionar rota nova: aceitar JSON e form data, validar campos obrigatórios, responder sempre com o formato JSON padronizado de sucesso/erro e status HTTP correto (400/404/405/500).
- **Gotchas / inconsistências conhecidas:**
  - O frontend (atendente.js/painel.js) usa a tabela `pacientes`; `chamar_senha.php` usa a tabela `senhas` (com colunas `codigo_senha`, `local_destino_id`, `status`, `data_chamada`) — são modelos de dados diferentes. Verifique qual tabela a feature em questão deve usar antes de alterar.
  - `config/database.php` não lê o `.env`; `get_config.php` lê. Endpoints que usam `supabaseRequest` exigem variáveis de ambiente reais (ou `set` via Render).
  - Chave do ResponsiveVoice está hardcoded no `views/painel.html` (`responsivevoice.js?key=LxubS8SO`).