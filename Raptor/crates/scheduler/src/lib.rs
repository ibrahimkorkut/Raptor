use serde::{Deserialize, Serialize};
use tracing::info;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PostCompletionAction {
    DoNothing,
    ExitApplication,
    DisconnectNetwork,
    SleepSystem,
    ShutdownSystem,
}

pub struct SystemPowerManager;

impl SystemPowerManager {
    pub fn trigger_action(action: PostCompletionAction) {
        info!("Executing post-completion action: {:?}", action);
        match action {
            PostCompletionAction::DoNothing => {}
            PostCompletionAction::ExitApplication => {
                std::process::exit(0);
            }
            PostCompletionAction::DisconnectNetwork => {
                // Implementation for network adapter disconnect
            }
            PostCompletionAction::SleepSystem => {
                #[cfg(windows)]
                {
                    // Call SetSystemPowerState or SetSuspendState
                }
            }
            PostCompletionAction::ShutdownSystem => {
                #[cfg(windows)]
                {
                    use windows::core::PCWSTR;
                    use windows::Win32::System::Shutdown::InitiateSystemShutdownExW;
                    unsafe {
                        let _ = InitiateSystemShutdownExW(
                            PCWSTR::null(),
                            PCWSTR::null(),
                            0,
                            true,
                            false,
                            windows::Win32::System::Shutdown::SHTDN_REASON_FLAG_PLANNED,
                        );
                    }
                }
            }
        }
    }
}
