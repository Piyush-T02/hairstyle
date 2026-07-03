<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

$action = $_GET['action'] ?? '';

if (!file_exists(__DIR__ . '/uploads')) mkdir(__DIR__ . '/uploads', 0777, true);

switch ($action) {
    case 'upload':  handleUpload(); break;
    case 'swap':    handleSwap();   break;
    case 'color':   handleColor();  break;
    case 'health':  handleHealth(); break;
    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action.']);
}

// ── Health ───────────────────────────────────────────────────────────────────
function handleHealth() {
    $r = @file_get_contents('http://localhost:5000/api/health', false,
        stream_context_create(['http' => ['timeout' => 3, 'ignore_errors' => true]]));
    echo json_encode($r === false
        ? ['success' => false, 'python_running' => false]
        : ['success' => true, 'python_running' => true]);
}

// ── Hairstyle swap ───────────────────────────────────────────────────────────
function handleSwap() {
    set_time_limit(0);
    $input     = json_decode(file_get_contents('php://input'), true);
    $imageUrl  = $input['image_url']  ?? '';
    $hairstyle = $input['hairstyle']  ?? '';

    if (empty($imageUrl)) { echo json_encode(['success' => false, 'error' => 'Missing image.']); exit; }

    $imagePath = __DIR__ . '/' . $imageUrl;
    if (!file_exists($imagePath)) { echo json_encode(['success' => false, 'error' => 'Image not found.']); exit; }

    $mime    = mime_content_type($imagePath);
    $b64     = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($imagePath));
    $payload = ['source_image' => $b64];
    if (!empty($hairstyle)) $payload['hairstyle'] = $hairstyle;

    $resp = @file_get_contents('http://localhost:5000/api/swap', false,
        stream_context_create(['http' => [
            'header'        => "Content-Type: application/json\r\n",
            'method'        => 'POST',
            'content'       => json_encode($payload),
            'ignore_errors' => true,
            'timeout'       => 180,
        ]]));

    if ($resp === false) { echo json_encode(['success' => false, 'error' => 'Backend not running.']); exit; }

    $data = json_decode($resp, true);
    echo isset($data['result_url'])
        ? json_encode(['success' => true, 'result_url' => $data['result_url']])
        : json_encode(['success' => false, 'error' => $data['error'] ?? 'No result.']);
}

// ── Color analysis ───────────────────────────────────────────────────────────
function handleColor() {
    set_time_limit(0);
    $input    = json_decode(file_get_contents('php://input'), true);
    $imageUrl = $input['image_url'] ?? '';

    if (empty($imageUrl)) { echo json_encode(['success' => false, 'error' => 'Missing image.']); exit; }

    $imagePath = __DIR__ . '/' . $imageUrl;
    if (!file_exists($imagePath)) { echo json_encode(['success' => false, 'error' => 'Image not found.']); exit; }

    $mime    = mime_content_type($imagePath);
    $b64     = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($imagePath));
    $payload = ['source_image' => $b64];

    $resp = @file_get_contents('http://localhost:5000/api/color', false,
        stream_context_create(['http' => [
            'header'        => "Content-Type: application/json\r\n",
            'method'        => 'POST',
            'content'       => json_encode($payload),
            'ignore_errors' => true,
            'timeout'       => 60,
        ]]));

    if ($resp === false) { echo json_encode(['success' => false, 'error' => 'Backend not running.']); exit; }

    $data = json_decode($resp, true);
    echo isset($data['color_analysis'])
        ? json_encode(['success' => true, 'color_analysis' => $data['color_analysis']])
        : json_encode(['success' => false, 'error' => $data['error'] ?? 'Analysis failed.']);
}

// ── Upload ───────────────────────────────────────────────────────────────────
function handleUpload() {
    if (!isset($_FILES['image'])) { echo json_encode(['success' => false, 'error' => 'No image.']); exit; }

    $file = $_FILES['image'];
    if ($file['error'] !== UPLOAD_ERR_OK) { echo json_encode(['success' => false, 'error' => 'Upload failed.']); exit; }
    if ($file['size'] > 30 * 1024 * 1024) { echo json_encode(['success' => false, 'error' => 'Max 30 MB.']); exit; }

    $mime    = mime_content_type($file['tmp_name']);
    $allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($mime, $allowed)) { echo json_encode(['success' => false, 'error' => 'JPG/PNG/WEBP only.']); exit; }

    $ext  = ['image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? 'jpg';
    $name = 'user_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    $path = __DIR__ . '/uploads/' . $name;

    echo move_uploaded_file($file['tmp_name'], $path)
        ? json_encode(['success' => true, 'image_url' => 'uploads/' . $name])
        : json_encode(['success' => false, 'error' => 'Save failed.']);
}
?>
