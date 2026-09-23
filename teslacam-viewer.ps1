# TeslaCam 뷰어를 http://localhost 로 띄운다.
#
# 왜 이게 필요한가
#   HTML 을 그냥 더블클릭하면 주소가 file:// 이 된다. 크롬은 file:// 페이지에는
#   폴더 접근 권한을 오래 주지 않는다 — "이 폴더에는 시스템 파일이 포함되어 있으므로
#   file:/// 에서 열 수 없습니다" 가 그것이다. 그래서 새로고침하면 폴더를 다시 골라야 한다.
#   진짜 주소(http://localhost)로 열면 그 제약이 사라지고, 한 번 고른 폴더를 크롬이 기억한다.
#   주소 조회(Nominatim)도 Referer 가 붙어 도로명까지 잘 나온다.
#
# 설치할 것 없다. 윈도우에 있는 PowerShell 만 쓴다. 관리자 권한도 필요 없다.
# 이 창을 닫으면 서버도 같이 꺼진다. 영상은 여전히 브라우저 안에서만 열린다.

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $PSCommandPath
$page = Join-Path $here 'teslacam-viewer.html'

if (-not (Test-Path $page)) {
    Write-Host "teslacam-viewer.html 을 찾지 못했습니다." -ForegroundColor Red
    Write-Host "  찾은 위치: $page"
    Write-Host "  이 스크립트와 같은 폴더에 두세요."
    Read-Host "엔터를 누르면 닫습니다"
    exit 1
}

$listener = New-Object System.Net.HttpListener
$port = 0
foreach ($p in 8787..8797) {
    try {
        $listener.Prefixes.Clear()
        $listener.Prefixes.Add("http://localhost:$p/")
        $listener.Start()
        $port = $p
        break
    } catch {
        $listener = New-Object System.Net.HttpListener   # 실패한 것은 버리고 새로
    }
}

if ($port -eq 0) {
    Write-Host "포트를 열지 못했습니다 (8787~8797 이 모두 사용 중이거나 막혀 있습니다)." -ForegroundColor Red
    Write-Host "  그냥 teslacam-viewer.html 을 더블클릭해도 쓸 수 있습니다."
    Write-Host "  다만 그때는 새로고침할 때마다 폴더를 다시 골라야 합니다."
    Read-Host "엔터를 누르면 닫습니다"
    exit 1
}

$url = "http://localhost:$port/"
Write-Host ""
Write-Host "  TeslaCam 뷰어" -ForegroundColor Green
Write-Host "  $url"
Write-Host ""
Write-Host "  브라우저가 열립니다. 다 보셨으면 이 창을 닫으세요." -ForegroundColor DarkGray
Write-Host ""

Start-Process $url

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $res = $ctx.Response
        try {
            # 한 장짜리 앱이라 어떤 경로로 와도 같은 파일을 준다.
            $bytes = [System.IO.File]::ReadAllBytes($page)
            $res.ContentType = 'text/html; charset=utf-8'
            $res.Headers.Add('Cache-Control', 'no-store')   # 고친 게 바로 보이게
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } catch {
            $res.StatusCode = 500
        } finally {
            $res.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
