<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit(0);

$action = $_GET['action'] ?? '';

if (!file_exists(__DIR__ . '/uploads')) mkdir(__DIR__ . '/uploads', 0777, true);

switch ($action) {
    case 'upload':     handleUpload();    break;
    case 'swap':       handleSwap();      break;
    case 'color':      handleColor();     break;
    case 'health':     handleHealth();    break;
    case 'send_otp':   handleSendOtp();   break;
    case 'verify_otp': handleVerifyOtp(); break;
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

// ── OTP (stored in a simple JSON file on disk) ──────────────────────────────
function getOtpStore() {
    $path = __DIR__ . '/otp_store.json';
    if (!file_exists($path)) return [];
    return json_decode(file_get_contents($path), true) ?: [];
}

function saveOtpStore($store) {
    file_put_contents(__DIR__ . '/otp_store.json', json_encode($store));
}

function handleSendOtp() {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'] ?? '';

    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['success' => false, 'error' => 'Invalid email.']);
        exit;
    }

    // Generate 6-digit OTP
    $otp = str_pad(random_int(100000, 999999), 6, '0', STR_PAD_LEFT);

    // Store OTP with expiry (5 minutes)
    $store = getOtpStore();
    $store[$email] = [
        'otp' => $otp,
        'expires' => time() + 300
    ];
    saveOtpStore($store);

    // Send email via SMTP (configure credentials via environment variables)
    $smtpEmail = getenv('SMTP_EMAIL') ?: '';
    $smtpPass  = getenv('SMTP_PASSWORD') ?: '';

    if (empty($smtpEmail) || empty($smtpPass)) {
        // Fallback: use PHP mail() function
        $subject = "Trekky - Your OTP Code";
        $message = "Hello!\n\nYour OTP for Trekky Virtual Hair Studio is: $otp\n\nThis code expires in 5 minutes.\n\n— Trekky Team";
        $headers = "From: noreply@trekky.app\r\nReply-To: noreply@trekky.app\r\n";

        if (@mail($email, $subject, $message, $headers)) {
            echo json_encode(['success' => true]);
        } else {
            // If mail() also fails, still succeed (OTP is stored, user can use it)
            // In production, configure SMTP properly
            echo json_encode(['success' => true, 'note' => 'OTP generated. Check server logs if email not received.']);
        }
        exit;
    }

    // SMTP via stream socket (Gmail)
    $sent = sendGmailSmtp($smtpEmail, $smtpPass, $email, $otp);
    echo json_encode($sent ? ['success' => true] : ['success' => false, 'error' => 'Failed to send email.']);
}

function sendGmailSmtp($from, $pass, $to, $otp) {
    $subject = "Trekky - Your OTP Code";
    $body = "Hello!\n\nYour OTP for Trekky Virtual Hair Studio is: $otp\n\nThis code expires in 5 minutes.\n\n— Trekky Team";

    // Base64 encode for AUTH LOGIN
    $fromB64 = base64_encode($from);
    $passB64 = base64_encode($pass);

    $headers = "From: $from\r\n";
    $headers .= "To: $to\r\n";
    $headers .= "Subject: $subject\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "\r\n$body";

    $ctx = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]);
    $sock = @stream_socket_client("ssl://smtp.gmail.com:465", $errno, $errstr, 30, STREAM_CLIENT_CONNECT, $ctx);
    if (!$sock) return false;

    $cmds = [
        null, // read greeting
        "EHLO trekky.app",
        "AUTH LOGIN",
        $fromB64,
        $passB64,
        "MAIL FROM:<$from>",
        "RCPT TO:<$to>",
        "DATA",
        $headers . "\r\n.",
        "QUIT"
    ];

    foreach ($cmds as $cmd) {
        if ($cmd === null) { fgets($sock, 512); continue; }
        fwrite($sock, $cmd . "\r\n");
        $resp = fgets($sock, 512);
        if ($resp === false) { fclose($sock); return false; }
    }
    fclose($sock);
    return true;
}

function handleVerifyOtp() {
    $input = json_decode(file_get_contents('php://input'), true);
    $email = $input['email'] ?? '';
    $otp   = $input['otp'] ?? '';

    $store = getOtpStore();

    if (!isset($store[$email])) {
        echo json_encode(['success' => false, 'error' => 'No OTP found. Please request one first.']);
        exit;
    }

    $entry = $store[$email];

    if (time() > $entry['expires']) {
        unset($store[$email]);
        saveOtpStore($store);
        echo json_encode(['success' => false, 'error' => 'OTP expired. Please request a new one.']);
        exit;
    }

    if ($entry['otp'] !== $otp) {
        echo json_encode(['success' => false, 'error' => 'Invalid OTP.']);
        exit;
    }

    // OTP valid — clean up
    unset($store[$email]);
    saveOtpStore($store);
    echo json_encode(['success' => true]);
}

// ── Hairstyle swap ───────────────────────────────────────────────────────────
function handleSwap() {
    set_time_limit(0);
    $input     = json_decode(file_get_contents('php://input'), true);
    $imageUrl  = $input['image_url']  ?? '';
    $hairstyle = $input['hairstyle']  ?? '';
    $gender    = $input['gender']     ?? 'male';

    if (empty($imageUrl)) { echo json_encode(['success' => false, 'error' => 'Missing image.']); exit; }

    $imagePath = __DIR__ . '/' . $imageUrl;
    if (!file_exists($imagePath)) { echo json_encode(['success' => false, 'error' => 'Image not found.']); exit; }

    $mime    = mime_content_type($imagePath);
    $b64     = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($imagePath));
    $payload = ['source_image' => $b64, 'gender' => $gender];
    if (!empty($hairstyle)) $payload['hairstyle'] = $hairstyle;

    $resp = @file_get_contents('http://localhost:5000/api/swap', false,
        stream_context_create(['http' => [
            'header'        => "Content-Type: application/json\r\n",
            'method'        => 'POST',
            'content'       => json_encode($payload),
            'ignore_errors' => true,
            'timeout'       => 300,
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
    $gender   = $input['gender']    ?? 'male';

    if (empty($imageUrl)) { echo json_encode(['success' => false, 'error' => 'Missing image.']); exit; }

    $imagePath = __DIR__ . '/' . $imageUrl;
    if (!file_exists($imagePath)) { echo json_encode(['success' => false, 'error' => 'Image not found.']); exit; }

    $mime    = mime_content_type($imagePath);
    $b64     = 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($imagePath));
    $payload = ['source_image' => $b64, 'gender' => $gender];

    $resp = @file_get_contents('http://localhost:5000/api/color', false,
        stream_context_create(['http' => [
            'header'        => "Content-Type: application/json\r\n",
            'method'        => 'POST',
            'content'       => json_encode($payload),
            'ignore_errors' => true,
            'timeout'       => 300,
        ]]));

    if ($resp === false) { echo json_encode(['success' => false, 'error' => 'Backend not running.']); exit; }

    $data = json_decode($resp, true);
    echo isset($data['color_analysis'])
        ? json_encode(['success' => true, 'color_analysis' => $data['color_analysis'], 'result_url' => $data['result_url'] ?? null])
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
