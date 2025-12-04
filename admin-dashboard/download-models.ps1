# Download face-api.js models
$ModelsPath = "public/models"

# Create models directory if it doesn't exist
if (-not (Test-Path $ModelsPath)) {
    New-Item -ItemType Directory -Path $ModelsPath -Force
}

# Base URL for face-api.js models
$BaseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"

# List of model files to download
$Models = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

Write-Host "Downloading face-api.js models..." -ForegroundColor Cyan

foreach ($Model in $Models) {
    $Url = "$BaseUrl/$Model"
    $OutputPath = "$ModelsPath/$Model"
    
    Write-Host "Downloading $Model..." -ForegroundColor Yellow
    
    try {
        Invoke-WebRequest -Uri $Url -OutFile $OutputPath -UseBasicParsing
        Write-Host "  ✓ Downloaded $Model" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Failed to download $Model" -ForegroundColor Red
        Write-Host "    Error: $_" -ForegroundColor Red
    }
}

Write-Host "`nAll models downloaded successfully!" -ForegroundColor Green
Write-Host "Models are in: $ModelsPath" -ForegroundColor Cyan
