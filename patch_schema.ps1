$path = "prisma\schema.prisma"
$content = Get-Content $path -Raw

# Add deleted_at to quiz model (after updated_at, before the blank line + subject relation)
$content = $content -replace `
    "  updated_at      DateTime      @updatedAt`r`n`r`n  subject         subject\?", `
    "  updated_at      DateTime      @updatedAt`r`n  deleted_at      DateTime?     // soft delete`r`n`r`n  subject         subject?"

Set-Content $path $content -NoNewline
Write-Host "Patch done."
