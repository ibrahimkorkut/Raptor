; Script generated for Raptor Download Manager
; Professional IDM-Style Modern Windows Setup Installer

#define MyAppName "Raptor Download Manager"
#define MyAppVersion "1.1.0"
#define MyAppPublisher "Raptor Team (İbrahim Korkut)"
#define MyAppURL "https://github.com/ibrahimkorkut"
#define MyAppExeName "Raptor.exe"

[Setup]
AppId={{8B1D4F92-4C10-4822-9654-RAPTOR001000}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\Raptor
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=..\Release\Setup
OutputBaseFilename=Raptor_Setup
SetupIconFile=..\Release\icon.ico
UninstallDisplayIcon={app}\icon.ico
UninstallDisplayName={#MyAppName} {#MyAppVersion}
Compression=lzma2/max
SolidCompression=yes
VersionInfoVersion=1.1.0.0
VersionInfoCompany=Raptor Team (İbrahim Korkut)
VersionInfoDescription=Raptor Download Manager Installer
VersionInfoTextVersion=1.1.0.0
VersionInfoCopyright=Copyright (C) 2026 Raptor Team
VersionInfoProductName=Raptor Download Manager
VersionInfoProductVersion=1.1.0.0
VersionInfoOriginalFileName=Raptor_Setup.exe
WizardStyle=modern
WizardResizable=no
PrivilegesRequiredOverridesAllowed=dialog
CloseApplications=force

[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce
Name: "startup"; Description: "Windows başladığında otomatik başlat"; GroupDescription: "Sistem Seçenekleri:"; Flags: checkedonce
Name: "browserext"; Description: "Tarayıcı Entegrasyonunu (Chrome, Edge, Brave) otomatik yapılandır"; GroupDescription: "Tarayıcı Entegrasyonu:"; Flags: checkedonce

[Files]
Source: "..\Release\Raptor.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Release\raptor-host.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Release\raptor-cli.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Release\WebView2Loader.dll"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Release\icon.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\Release\browser-extension\*"; DestDir: "{app}\browser-extension"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Raptor"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Registry]
; Windows Başlangıçta Otomatik Başlat
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "Raptor"; ValueData: """{app}\{#MyAppExeName}"" --minimized"; Tasks: startup; Flags: uninsdeletevalue

; Chrome Native Messaging Host (com.raptor.native & com.hyperdownload.native)
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\com.raptor.native"; ValueType: string; ValueData: "{app}\com.raptor.native.json"; Tasks: browserext; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\com.hyperdownload.native"; ValueType: string; ValueData: "{app}\com.raptor.native.json"; Tasks: browserext; Flags: uninsdeletekey

; Microsoft Edge Native Messaging Host
Root: HKCU; Subkey: "Software\Microsoft\Edge\NativeMessagingHosts\com.raptor.native"; ValueType: string; ValueData: "{app}\com.raptor.native.json"; Tasks: browserext; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Microsoft\Edge\NativeMessagingHosts\com.hyperdownload.native"; ValueType: string; ValueData: "{app}\com.raptor.native.json"; Tasks: browserext; Flags: uninsdeletekey

; Brave Browser Native Messaging Host
Root: HKCU; Subkey: "Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.raptor.native"; ValueType: string; ValueData: "{app}\com.raptor.native.json"; Tasks: browserext; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.hyperdownload.native"; ValueType: string; ValueData: "{app}\com.raptor.native.json"; Tasks: browserext; Flags: uninsdeletekey

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
// Kurulum tamamlandığında doğru dosya yollarına sahip Native Messaging JSON dosyasını oluşturur
procedure CurStepChanged(CurStep: TSetupStep);
var
  JsonContent: String;
  HostPath: String;
  JsonFile: String;
  LegacyJsonFile: String;
begin
  if CurStep = ssPostInstall then
  begin
    HostPath := ExpandConstant('{app}\raptor-host.exe');
    StringChangeEx(HostPath, '\', '\\', True);
    
    JsonContent := '{' + #13#10 +
      '  "name": "com.raptor.native",' + #13#10 +
      '  "description": "Raptor High-Performance Native Messaging Host",' + #13#10 +
      '  "path": "' + HostPath + '",' + #13#10 +
      '  "type": "stdio",' + #13#10 +
      '  "allowed_origins": [' + #13#10 +
      '    "chrome-extension://knldjmfmopnpolahpmmgbagdohdnhkik/",' + #13#10 +
      '    "chrome-extension://*"' + #13#10 +
      '  ]' + #13#10 +
      '}';
      
    JsonFile := ExpandConstant('{app}\com.raptor.native.json');
    LegacyJsonFile := ExpandConstant('{app}\com.hyperdownload.native.json');
    SaveStringToFile(JsonFile, JsonContent, False);
    SaveStringToFile(LegacyJsonFile, JsonContent, False);
  end;
end;
