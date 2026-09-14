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

// 1. Pega do Render (Environment Variables que aparecem na sua foto)
$url = getenv('SUPABASE_URL') ?: ($_ENV['SUPABASE_URL'] ?? '');
$key = getenv('SUPABASE_KEY') ?: getenv('SUPABASE_ANON_KEY') ?: ($_ENV['SUPABASE_KEY'] ?? $_ENV['SUPABASE_ANON_KEY'] ?? '');

// 2. Se estiver no PC local e tiver o arquivo .env, lê dele
$arquivoEnv = __DIR__ . '/../.env';
if (($url === '' || $key === '') && is_readable($arquivoEnv)) {
    foreach (file($arquivoEnv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linha) {
        if (preg_match('/^\s*(SUPABASE_URL|SUPABASE_ANON_KEY|SUPABASE_KEY)\s*=\s*(.*?)\s*$/', $linha, $partes) === 1) {
            $chave = $partes[1];
            $valor = trim($partes[2]);
            if (strlen($valor) >= 2 && (($valor[0] === '"' && $valor[-1] === '"') || ($valor[0] === "'" && $valor[-1] === "'"))) {
                $valor = substr($valor, 1, -1);
            }
            if ($chave === 'SUPABASE_URL' && $url === '') $url = trim($valor);
            if (($chave === 'SUPABASE_KEY' || $chave === 'SUPABASE_ANON_KEY') && $key === '') $key = trim($valor);
        }
    }
}

try {
    if ($url === '' || $key === '') {
        throw new RuntimeException('Variáveis SUPABASE_URL ou SUPABASE_KEY não foram encontradas.');
    }

    echo json_encode([
        'url' => $url,
        'key' => $key,
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $erro) {
    error_log($erro->getMessage());
    http_response_code(500);
    echo json_encode(['erro' => 'Configurações do Supabase indisponíveis.'], JSON_UNESCAPED_UNICODE);
}