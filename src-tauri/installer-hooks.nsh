; 南枫情报台 0.1.0 与南枫知识库 0.2.0 使用不同产品名。
; Tauri NSIS 以产品名生成卸载注册项，因此改名后默认会并存安装。
; 这里只移除旧版程序文件和卸载注册项；用户数据目录不属于安装目录，不会被处理。
!macro NSIS_HOOK_PREINSTALL
  nsis_tauri_utils::FindProcessCurrentUser "nanfeng-intelligence.exe"
  Pop $R0
  ${If} $R0 = 0
    Abort "请先关闭正在运行的南枫情报台，再继续安装南枫知识库。"
  ${EndIf}

  StrCpy $R8 ""
  ReadRegStr $R8 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\南枫情报台" "UninstallString"
  ${If} $R8 != ""
    DetailPrint "正在安全移除旧版南枫情报台程序（保留用户数据）..."
    ExecWait '$R8 /S' $R9
    ${If} $R9 != 0
      Abort "旧版南枫情报台卸载失败；为避免双安装，已停止安装南枫知识库。"
    ${EndIf}
    ; 卸载器返回后仍需要极短时间自删除并清理注册项。
    Sleep 500
  ${EndIf}
!macroend
