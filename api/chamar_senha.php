<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';

// O endpoint aceita POST para ações do painel e PATCH para clientes REST.
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? '');
if (!in_array($method, ['POST', 'PATCH'], true)) {
    header('Allow: POST, PATCH');
    jsonResponse(['sucesso' => false, 'erro' => 'Método HTTP não permitido.'], 405);
}

/** Lê JSON quando enviado; caso contrário, utiliza os campos do formulário. */
$input = [];
$rawBody = file_get_contents('php://input');
if (is_string($rawBody) && trim($rawBody) !== '') {
    $decoded = json_decode($rawBody, true);
    if (is_array($decoded)) {
        $input = $decoded;
    }
}

/**
 * Aceita texto e inteiros (úteis para IDs), rejeitando arrays, objetos e booleanos.
 */
function readRequiredString(mixed $value): ?string
{
    if (!is_string($value) && !is_int($value)) {
        return null;
    }

    $value = trim((string) $value);
    return $value === '' ? null : $value;
}

$codigoSenha = readRequiredString(
    $input['codigo_senha'] ?? $_POST['codigo_senha'] ?? null
);
$localDestinoId = readRequiredString(
    $input['local_destino_id'] ?? $_POST['local_destino_id'] ?? null
);

if ($codigoSenha === null || $localDestinoId === null) {
    jsonResponse([
        'sucesso' => false,
        'erro' => 'Os parâmetros codigo_senha e local_destino_id são obrigatórios.',
    ], 400);
}

$dataChamada = gmdate('Y-m-d\\TH:i:s\\Z');
$filtro = http_build_query([
    'codigo_senha' => 'eq.' . $codigoSenha,
    'local_destino_id' => 'eq.' . $localDestinoId,
]);

try {
    $resultado = supabaseRequest('PATCH', '/rest/v1/senhas?' . $filtro, [
        'status' => 'Chamado',
        'data_chamada' => $dataChamada,
    ]);

    if ($resultado === []) {
        jsonResponse([
            'sucesso' => false,
            'erro' => 'Nenhuma senha encontrada para os dados informados.',
        ], 404);
    }

    $senha = is_array($resultado[0] ?? null) ? $resultado[0] : [];
    $textoVoz = sprintf(
        'Senha %s, dirigir-se ao local %s.',
        $codigoSenha,
        $localDestinoId
    );

    jsonResponse([
        'sucesso' => true,
        'mensagem' => 'Senha chamada com sucesso.',
        'chamada' => [
            'codigo_senha' => $senha['codigo_senha'] ?? $codigoSenha,
            'local_destino_id' => $senha['local_destino_id'] ?? $localDestinoId,
            'status' => $senha['status'] ?? 'Chamado',
            'data_chamada' => $senha['data_chamada'] ?? $dataChamada,
            'texto_voz' => $textoVoz,
        ],
    ]);
} catch (JsonException $exception) {
    jsonResponse(['sucesso' => false, 'erro' => 'Falha ao preparar a requisição.'], 500);
} catch (Throwable $exception) {
    error_log($exception->getMessage());
    jsonResponse([
        'sucesso' => false,
        'erro' => 'Não foi possível atualizar a senha no Supabase.',
    ], 500);
}
