$ErrorActionPreference = 'Stop'
$siteRoot = $PSScriptRoot
$port = 8765
$python = Get-Command py -ErrorAction SilentlyContinue
if ($python) {
    $serve = Start-Process -FilePath $python.Source -ArgumentList @('-3', '-m', 'http.server', "$port", '--bind', '127.0.0.1', '--directory', $siteRoot) -PassThru -WindowStyle Hidden
} else {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if (-not $python) {
        Write-Host 'Chưa tìm thấy Python. Hãy cài Python 3 hoặc dùng một máy chủ web tĩnh để chạy thư mục này.' -ForegroundColor Yellow
        Read-Host 'Nhấn Enter để đóng'
        exit 1
    }
    $serve = Start-Process -FilePath $python.Source -ArgumentList @('-m', 'http.server', "$port", '--bind', '127.0.0.1', '--directory', $siteRoot) -PassThru -WindowStyle Hidden
}
Start-Sleep -Milliseconds 800
try {
    Start-Process "http://127.0.0.1:$port/"
    Write-Host "CoLearn đang chạy tại http://127.0.0.1:$port/"
    Write-Host 'Giữ cửa sổ này mở khi học. Nhấn Enter để dừng máy chủ.'
    Read-Host | Out-Null
} finally {
    if ($serve -and -not $serve.HasExited) { Stop-Process -Id $serve.Id -Force }
}
