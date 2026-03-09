{
  description = "sopra-26-template-client";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-24.11";
    nixpkgs-stable.url = "github:nixos/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    nixpkgs-stable,
    flake-utils,
  }:
    flake-utils.lib.eachSystem ["aarch64-darwin" "x86_64-darwin" "x86_64-linux" "aarch64-linux"] (
      system: let
        inherit (nixpkgs) lib;

        pkgs = import nixpkgs {
          inherit system;
        };

        pkgsStable = import nixpkgs-stable {
          inherit system;
        };

        nativeBuildInputs = with pkgs;
          [
            pkgsStable.nodejs_22
            git
            deno
            watchman
          ]
          ++ lib.optionals stdenv.isDarwin [
            xcodes
          ]
          ++ lib.optionals (system == "aarch64-linux") [
            qemu
          ];
      in {
        devShells.default = pkgs.mkShell {
          inherit nativeBuildInputs;

          shellHook = ''
            export HOST_PROJECT_PATH="$(pwd)"
            export COMPOSE_PROJECT_NAME=sopra-fs26-template-client
            
            export PATH="${pkgsStable.nodejs_22}/bin:$PATH"
            export PATH="${pkgs.git}/bin:$PATH"
            export PATH="${pkgs.deno}/bin:$PATH"
            export PATH="${pkgs.watchman}/bin:$PATH"
            
            XCODE_VERSION_OLD="15.3"
            XCODE_VERSION="16.2"
            XCODE_BUILD_OLD="15E204a" 
            XCODE_BUILD="16C5032a"
            if [[ $(uname) == "Darwin" ]] && [ -z "$CI" ]; then
              if ! (xcodes installed | grep "$XCODE_VERSION ($XCODE_BUILD)" -q || xcodes installed | grep "$XCODE_VERSION_OLD ($XCODE_BUILD_OLD)" -q); then
                echo -e "\e[1;33m================================================\e[0m"
                echo -e "\e[1;33mIf you wish to code in XCode, please install $XCODE_VERSION or $XCODE_VERSION_OLD\e[0m"
                echo -e "\e[1;33mYou can install the latest version with \e[0m\e[1;32mxcodes install $XCODE_VERSION\e[0m\e[1;33m\e[0m"
                echo -e "\e[1;33m================================================\e[0m"
              fi
            fi

            if [[ $(uname) == "Darwin" ]]; then
              echo "export NODE_BINARY=\"$(which node)\"" > .xcode.env.local
            fi

            export PATH=$(echo $PATH | tr ':' '\n' | grep -v clang | paste -sd ':' -)

            if [[ -f package.json && ( ! -d node_modules || -z "$(ls -A node_modules)" ) ]]; then
              echo "Running npm install to install dependencies..."
              npm install || echo -e "\e[1;31mFailed to run npm install. Please check your package.json.\e[0m"
            fi

            if [[ ! -f deno.lock ]]; then
              echo "Installing dependencies with deno..."
              deno install --allow-scripts || echo -e "\e[1;31mFailed to run deno install.\e[0m"
            fi
          '';
        };
      }
    );
}
