cask "lifemirror-desktop" do
  arch arm: "aarch64", intel: "x64"

  version "1.4.2"
  sha256 arm:   "dbc7c2849c247583da28663fa0b6f619b7376084a34aa6aad37a13b411475045",
         intel: "df077fc54daf30647f5522bac4262fbdfc0f9a3fe48dcfa2f2c3bec8d21ecc2d"

  url "https://github.com/PieApps/lifemirror-desktop/releases/download/v#{version}/lifemirror-desktop_#{version}_#{arch}.dmg"
  name "LifeMirror Desktop"
  desc "Privacy-first, local-focused productivity reflection utility"
  homepage "https://github.com/PieApps/lifemirror-desktop"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "LifeMirror Desktop.app"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/LifeMirror Desktop.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/com.lifemirror.desktop",
    "~/Library/Caches/com.lifemirror.desktop",
    "~/Library/WebKit/com.lifemirror.desktop",
  ]
end

