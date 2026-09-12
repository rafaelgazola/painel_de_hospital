<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['erro' => 'Método HTTP não permitido.'], JSON_UNESCAPED_UNICODE);
    exit;
}

/** Lê somente as configurações públicas necessárias ao painel. */
function lerConfiguracaoPublica(string $arquivo): array
{
    if (!is_readable($arquivo)) {
        throw new RuntimeException('Arquivo de configuração indisponível.');
    }

    $configuracao = [
        'SUPABASE_URL' => '',
        'SUPABASE_ANON_KEY' => '',
        'SUPABASE_KEY' => '',
    ];

    foreach (file($arquivo, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linha) {
        if (preg_match('/^\s*(SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_KEY)\s*=\s*(.*?)\s*$/', $linha, $partes) !== 1) {
            continue;
        }

        $valor = trim($partes[2]);
        if (strlen($valor) >= 2 && (($valor[0] === '"' && $valor[-1] === '"') || ($valor[0] === "'" && $valor[-1] === "'"))) {
            $valor = substr($valor, 1, -1);
        }
        $configuracao[$partes[1]] = trim($valor);
    }

    if ($configuracao['SUPABASE_ANON_KEY'] === '' && $configuracao['SUPABASE_KEY'] !== '') {
        $configuracao['SUPABASE_ANON_KEY'] = $configuracao['SUPABASE_KEY'];
    }

    return $configuracao;
}

try {
    $configuracao = lerConfiguracaoPublica(__DIR__ . '/../.env');
    if ($configuracao['SUPABASE_URL'] === '' || $configuracao['SUPABASE_ANON_KEY'] === '') {
        throw new RuntimeException('Chave publica do Supabase nao encontrada no arquivo .env');
    }

    echo json_encode([
        'url' => $configuracao['SUPABASE_URL'],
        'key' => $configuracao['SUPABASE_ANON_KEY'],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $erro) {
    error_log($erro->getMessage());
    http_response_code(500);
    echo json_encode(['erro' => 'Chave publica do Supabase nao encontrada no arquivo .env'], JSON_UNESCAPED_UNICODE);
}
