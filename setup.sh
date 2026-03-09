#!/bin/bash

FAILED_COMMANDS=()
OS_TYPE=$(uname)

run_command() {
        echo "Running: $*"
        bash -c "$*" || {
                echo -e "\033[0;31mCommand failed: $*\033[0m"
                FAILED_COMMANDS+=("$*")
        }
}

# Install nix
if [ -f /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]; then
    echo "nix is already installed"
else
    echo "Installing nix and direnv"
    run_command "curl --proto '=https' --tlsv1.2 -ssf --progress-bar -L https://install.determinate.systems/nix -o install-nix.sh"
    echo "Download successful, installing now, this will take a moment"
    run_command "sh install-nix.sh install --determinate --no-confirm --verbose"
fi

if [ -f /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh ]; then
    echo "Sourcing nix-daemon..."
    run_command ". /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh && nix profile install nixpkgs#direnv && direnv allow"
    
    # source directly in shell as well
    . /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh
    export PATH="$HOME/.nix-profile/bin:$PATH"

    # Try to install direnv, fix permissions if it fails
    if ! run_command "nix profile install nixpkgs#direnv && direnv allow"; then
        echo -e "\033[0;31mFailed to install direnv. Attempting to fix Nix permissions...\033[0m"
        sudo chown -R "$(whoami)" /nix
    fi
    run_command "nix profile install nixpkgs#direnv && direnv allow"
else
    echo -e "\033[0;31mFailed to source nix-daemon. Nix-related commands will not be executed.\033[0m"
    return 1
fi

# Hook direnv into shell
echo "Configuring direnv for the current shell..."
case "$SHELL" in
*/bash)
        echo "Detected Bash shell."
        run_command "echo 'eval \"\$(direnv hook bash)\"' >> ~/.bashrc"
        run_command "echo 'eval \"\$(direnv hook bash)\"' >> ~/.bash_profile"
        eval "$(direnv hook bash)"
        source ~/.bashrc
        ;;
*/zsh)
        echo "Detected Zsh shell."
        if [ -d "${ZSH:-}" ]; then
                echo "Detected Oh My Zsh."
                if ! grep -q "direnv" ~/.zshrc; then
                        run_command "sed -i '' '/plugins=(/ s/)/ direnv)/' ~/.zshrc || echo -e '\nplugins=(direnv)' >> ~/.zshrc"
                fi
        fi
        run_command "echo 'eval \"\$(direnv hook zsh)\"' >> ~/.zshrc"
        eval "$(direnv hook zsh)"
        source ~/.zshrc
        ;;
*/fish)
        echo "Detected Fish shell."
        run_command "echo 'direnv hook fish | source' >> ~/.config/fish/config.fish"
        direnv hook fish | source
        ;;
*/csh | */tcsh)
        echo "Detected TCSH shell."
        run_command "echo 'eval \`direnv hook tcsh\`' >> ~/.cshrc"
        eval `direnv hook tcsh`
        source ~/.cshrc
        ;;
*/elvish)
        echo "Detected Elvish shell."
        run_command "mkdir -p ~/.config/elvish/lib && direnv hook elvish > ~/.config/elvish/lib/direnv.elv && echo 'use direnv' >> ~/.config/elvish/rc.elv"
        use direnv
        ;;
*/nu)
        echo "Detected Nushell."
        NU_CONFIG_FILE="${HOME}/.config/nushell/config.nu"
        NU_HOOK="{ || if (which direnv | is-empty) { return } direnv export json | from json | default {} | load-env }"
        run_command "echo \"\$env.config.hooks.env_change.PWD += $NU_HOOK\" >> $NU_CONFIG_FILE"
        ;;
*/murex)
        echo "Detected Murex shell."
        run_command "echo 'direnv hook murex -> source' >> ~/.murex_profile"
        direnv hook murex -> source
        ;;
*)
        echo -e "\033[0;33mShell not recognized. Please configure direnv manually for your shell.\033[0m"
        echo "Refer to the official documentation: https://direnv.net/docs/hook.html"
        ;;
esac

# Check if any command failed in the second phase
if [ ${#FAILED_COMMANDS[@]} -gt 0 ]; then
        echo -e "\n\033[0;31mThe following commands failed during the second setup phase:\033[0m\n"
        for cmd in "${FAILED_COMMANDS[@]}"; do
                echo -e "  - \033[0;31m$cmd\033[0m"
        done
        echo -e "\nPlease address these issues and rerun the script."
        exit 1
else
        echo -e "\033[0;32mSetup completed successfully! Project dependencies will now be installed.\033[0m"
fi
