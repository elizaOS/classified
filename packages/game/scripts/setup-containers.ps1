# Simple Windows/PowerShell container setup for ELIZA

Write-Host "🚀 ELIZA Container Setup (Windows)" -ForegroundColor Green
Write-Host "Platform: Windows PowerShell" -ForegroundColor Cyan

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

# Check for WSL2
function Test-WSL {
    try {
        $wslVersion = wsl --version 2>$null
        if ($wslVersion) {
            Write-Host "✅ WSL2 is installed" -ForegroundColor Green
            return $true
        }
    } catch {
        Write-Host "❌ WSL2 not found" -ForegroundColor Red
        return $false
    }
}

# Check for container runtimes
function Test-ContainerRuntime {
    Write-Host "`n📦 Checking container runtimes..." -ForegroundColor Yellow
    
    # Check for Podman
    try {
        $podmanVersion = podman --version 2>$null
        if ($podmanVersion) {
            Write-Host "✅ Podman found: $podmanVersion" -ForegroundColor Green
            
            # Test podman connectivity
            try {
                podman ps 2>$null | Out-Null
                Write-Host "✅ Podman is working" -ForegroundColor Green
                return "podman"
            } catch {
                Write-Host "⚠️ Podman found but not working" -ForegroundColor Yellow
            }
        }
    } catch {
        Write-Host "❌ Podman not found" -ForegroundColor Red
    }
    
    # Check for Docker
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            Write-Host "✅ Docker found: $dockerVersion" -ForegroundColor Green
            
            # Test docker connectivity
            try {
                docker ps 2>$null | Out-Null
                Write-Host "✅ Docker is working" -ForegroundColor Green
                return "docker"
            } catch {
                Write-Host "❌ Docker found but not working" -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "❌ Docker not found" -ForegroundColor Red
    }
    
    # Installation suggestions
    Write-Host "`n❌ No working container runtime found!" -ForegroundColor Red
    Write-Host "`n📋 Installation options:" -ForegroundColor Yellow
    Write-Host "1. Podman Desktop: https://podman-desktop.io/downloads" -ForegroundColor Cyan
    Write-Host "2. Docker Desktop: https://docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host "`nOr run as administrator and we'll try to install for you:" -ForegroundColor Yellow
    
    if ($isAdmin) {
        $choice = Read-Host "`nInstall Podman Desktop automatically? (y/n)"
        if ($choice -eq "y" -or $choice -eq "Y") {
            Install-PodmanDesktop
        }
    } else {
        Write-Host "Run as administrator to enable automatic installation" -ForegroundColor Yellow
    }
    
    exit 1
}

# Install Podman Desktop using winget
function Install-PodmanDesktop {
    Write-Host "`n📥 Installing Podman Desktop..." -ForegroundColor Yellow
    
    try {
        winget install RedHat.Podman-Desktop
        Write-Host "✅ Podman Desktop installed" -ForegroundColor Green
        Write-Host "Please restart this script after launching Podman Desktop" -ForegroundColor Yellow
        exit 0
    } catch {
        Write-Host "❌ Failed to install Podman Desktop" -ForegroundColor Red
        Write-Host "Please install manually from: https://podman-desktop.io/downloads" -ForegroundColor Yellow
        exit 1
    }
}

# Create container environment file
function New-ContainerEnv {
    Write-Host "`n⚙️ Creating container environment..." -ForegroundColor Yellow
    
    $envContent = @"
# ELIZA Container Environment
POSTGRES_PASSWORD=eliza_secure_password_2024
POSTGRES_USER=eliza
POSTGRES_DB=eliza
OLLAMA_HOST=http://localhost:11434
REDIS_PASSWORD=eliza_redis_password_2024
PGADMIN_DEFAULT_EMAIL=admin@eliza.local
PGADMIN_DEFAULT_PASSWORD=eliza_admin_2024
"@

    $envPath = Join-Path $PSScriptRoot "..\src-backend\sandbox\.env"
    $envContent | Out-File -FilePath $envPath -Encoding UTF8
    Write-Host "✅ Container environment created" -ForegroundColor Green
}

# Start containers
function Start-Containers {
    param($engine)
    
    Write-Host "`n🐳 Starting containers with $engine..." -ForegroundColor Yellow
    
    $sandboxDir = Join-Path $PSScriptRoot "..\src-backend\sandbox"
    $composeFile = Join-Path $sandboxDir "steam-container-bundle.yaml"
    
    if (!(Test-Path $composeFile)) {
        Write-Host "❌ Container bundle not found" -ForegroundColor Red
        Write-Host "Run the container orchestration setup first" -ForegroundColor Yellow
        exit 1
    }
    
    # Use appropriate compose command
    $composeCmd = if ($engine -eq "podman") { "podman-compose" } else { "docker-compose" }
    
    # Check if compose tool exists
    try {
        & $composeCmd --version 2>$null | Out-Null
    } catch {
        Write-Host "Installing $composeCmd..." -ForegroundColor Yellow
        if ($engine -eq "podman") {
            pip install podman-compose
        }
    }
    
    # Change to sandbox directory and start containers
    Push-Location $sandboxDir
    try {
        & $composeCmd -f steam-container-bundle.yaml up -d
        Write-Host "✅ Containers started" -ForegroundColor Green
    } finally {
        Pop-Location
    }
    
    # Wait for startup
    Write-Host "⏳ Waiting for services to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
    
    Test-ContainerHealth
}

# Check container health
function Test-ContainerHealth {
    Write-Host "`n🔍 Checking container health..." -ForegroundColor Yellow
    
    $services = @(
        @{name="PostgreSQL"; port=7771},
        @{name="Ollama"; port=11434},
        @{name="Redis"; port=6379},
        @{name="pgAdmin"; port=5050}
    )
    
    foreach ($service in $services) {
        try {
            $connection = Test-NetConnection -ComputerName localhost -Port $service.port -InformationLevel Quiet
            if ($connection) {
                Write-Host "✅ $($service.name) (port $($service.port))" -ForegroundColor Green
            } else {
                Write-Host "❌ $($service.name) (port $($service.port)) - not responding" -ForegroundColor Red
            }
        } catch {
            Write-Host "❌ $($service.name) (port $($service.port)) - not responding" -ForegroundColor Red
        }
    }
    
    Write-Host "`n🎉 Container setup complete!" -ForegroundColor Green
    Write-Host "`n📋 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Run: npm run dev:backend" -ForegroundColor Cyan
    Write-Host "2. Run: npm run dev:frontend" -ForegroundColor Cyan
    Write-Host "3. Open: http://localhost:1420" -ForegroundColor Cyan
    
    Write-Host "`n🔗 Container Services:" -ForegroundColor Yellow
    Write-Host "- ELIZA API: http://localhost:7777" -ForegroundColor Cyan
    Write-Host "- pgAdmin: http://localhost:5050" -ForegroundColor Cyan
    Write-Host "- Ollama: http://localhost:11434" -ForegroundColor Cyan
}

# Main execution
function Main {
    Write-Host "Starting simple container setup...`n" -ForegroundColor Yellow
    
    # Check WSL2 (recommended but not required)
    if (!(Test-WSL)) {
        Write-Host "⚠️ WSL2 not found. Some container features may be limited." -ForegroundColor Yellow
        Write-Host "To install WSL2: wsl --install" -ForegroundColor Cyan
        $continue = Read-Host "Continue anyway? (y/n)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            exit 1
        }
    }
    
    # Setup container runtime
    $engine = Test-ContainerRuntime
    
    # Create environment
    New-ContainerEnv
    
    # Start containers
    Start-Containers $engine
}

# Run main function
Main