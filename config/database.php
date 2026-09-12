<?php

declare(strict_types=1);

/**
 * Configuração mínima para consumo da API REST do Supabase.
 * As credenciais devem ser definidas no ambiente do servidor, nunca versionadas.
 */
define('SUPABASE_URL', rtrim((string) getenv('SUPABASE_URL'), '/'));
define('SUPABASE_KEY', (string) getenv('SUPABASE_KEY'));

/**
 * Executa uma requisição autenticada contra o Supabase.
 * Erros de transporte e respostas HTTP de erro são convertidos em exceções
 * para que cada endpoint possa devolver um JSON padronizado.
 *
 * @return array<int, mixed>
 */
function supabaseRequest(string $method, string $endpoint, ?array $payload = null): array
{
    if (SUPABASE_URL === '' || SUPABASE_KEY === '') {
        throw new RuntimeException(
            'As variáveis SUPABASE_URL e SUPABASE_KEY não foram configuradas.'
        );
    }

    $url = SUPABASE_URL . '/' . ltrim($endpoint, '/');
    $curl = curl_init($url);

    if ($curl === false) {
        throw new RuntimeException('Não foi possível inicializar o cURL.');
    }

    $headers = [
        'apikey: ' . SUPABASE_KEY,
        'Authorization: Bearer ' . SUPABASE_KEY,
        'Accept: application/json',
        'Content-Type: application/json',
        'Prefer: return=representation',
    ];

    $options = [
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 30,
    ];

    if ($payload !== null) {
        $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_THROW_ON_ERROR);
    }

    if (!curl_setopt_array($curl, $options)) {
        curl_close($curl);
        throw new RuntimeException('Não foi possível configurar a requisição cURL.');
    }
    $response = curl_exec($curl);
    $curlError = curl_error($curl);
    $httpCode = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);

    if ($response === false || $curlError !== '') {
        throw new RuntimeException('Erro de comunicação com o Supabase: ' . $curlError);
    }

    $decoded = json_decode($response, true);
    $decoded = is_array($decoded) ? $decoded : [];

    if ($httpCode < 200 || $httpCode >= 300) {
        $message = $decoded['message'] ?? $decoded['error'] ?? 'A API do Supabase retornou um erro.';
        throw new RuntimeException((string) $message, $httpCode);
    }

    return $decoded;
}

/** Devolve respostas JSON com os cabeçalhos e o status HTTP corretos. */
function jsonResponse(array $body, int $statusCode = 200): never
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
